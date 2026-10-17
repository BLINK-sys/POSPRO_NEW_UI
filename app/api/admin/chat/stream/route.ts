/**
 * SSE-прокси для CRM-чата. Flask отдаёт `GET /admin/chat/stream` с JWT
 * через `?token=` (EventSource не умеет кастомные заголовки), но у нас
 * JWT в httpOnly cookie — читаем его тут и передаём query-параметром
 * на бэк. Стрим body Flask'а транслируется браузеру как есть.
 *
 * Query-params `since` / `since_reaction` пробрасываются как есть —
 * фронт использует их чтобы при переподключении не читать историю с
 * нуля.
 *
 * Catch-all `/api/admin/[...path]/route.ts` этот путь тоже поймал бы,
 * но там `await response.text()` — что для SSE не подходит (буферизирует
 * весь стрим до закрытия соединения). Поэтому нужен отдельный route.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

// Edge runtime стримит response body в реальном времени без буферизации
// (в отличие от nodejs runtime, где Next 14 App Router буферизует
// upstream.body до конца). Для SSE это критично — иначе клиент не
// получит ни одного event пока стрим не закроется.
export const dynamic = "force-dynamic"
export const runtime = "edge"

export async function GET(request: NextRequest) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const search = request.nextUrl.searchParams
  const params = new URLSearchParams(search)
  params.set("token", token)
  const url = getApiUrl(`/api/admin/chat/stream?${params.toString()}`)

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      signal: request.signal,
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Upstream SSE недоступен" },
        { status: upstream.status || 502 },
      )
    }

    // Ручной pump: читаем reader upstream'а и enqueue в новый
    // ReadableStream. Так мы гарантированно НЕ буферизуем — каждый chunk
    // от Flask сразу летит клиенту. Даже если Edge runtime по какой-то
    // причине попытается буферизовать `upstream.body` как есть — этот
    // pump всё равно даст ровный стрим.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) controller.enqueue(value)
          }
        } catch (e: any) {
          // Клиент отключился — reader кинет AbortError / ResponseAborted,
          // это норма при закрытии EventSource.
          const name = e?.name
          if (name !== "AbortError" && name !== "ResponseAborted") {
            console.error("[chat/stream] pump error:", e)
          }
        } finally {
          controller.close()
          try { reader.releaseLock() } catch {}
        }
      },
      async cancel() {
        // Клиент закрыл EventSource — отменяем upstream reader. Ошибки
        // здесь ожидаемы (stream уже прерван клиентом), не логируем.
        try {
          await upstream.body?.cancel()
        } catch {
          /* silent */
        }
      },
    })

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return new NextResponse(null, { status: 204 })
    }
    console.error("[chat/stream] proxy error:", e)
    return NextResponse.json(
      { error: "Ошибка SSE-прокси", details: e?.message },
      { status: 502 },
    )
  }
}
