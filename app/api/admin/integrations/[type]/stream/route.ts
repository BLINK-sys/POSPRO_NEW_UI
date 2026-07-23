/**
 * Next.js SSE proxy для /admin/integrations/<type>/stream.
 *
 * Причина: `EventSource` не поддерживает custom headers (в частности Authorization).
 * Наш JWT лежит в httpOnly cookie, клиент не имеет к нему доступа.
 *
 * Решение: клиент делает `new EventSource('/api/admin/integrations/bio/stream')` —
 * запрос идёт на этот роут (тот же origin, cookie отправляется), мы читаем токен
 * из cookie и делаем backend-запрос с `?token=<jwt>` в query. Стрим отдаём клиенту
 * прозрачно через ReadableStream.
 */

import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import { API_BASE_URL } from "@/lib/api-address"

export const dynamic = "force-dynamic"
// Streaming: не буферизовать, отдавать по мере получения от бэка.
export const fetchCache = "force-no-store"

const ALLOWED_TYPES = ["bio", "equip"] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!ALLOWED_TYPES.includes(type as any)) {
    return new Response("Unknown type", { status: 404 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) return new Response("Unauthorized", { status: 401 })

  const upstreamUrl = `${API_BASE_URL}/api/admin/integrations/${type}/stream?token=${encodeURIComponent(token)}`

  // Пробрасываем AbortController от клиентского запроса — если клиент закроет
  // вкладку, мы прерываем upstream и освобождаем поток gunicorn.
  const controller = new AbortController()
  req.signal.addEventListener("abort", () => controller.abort())

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    })
  } catch (e) {
    return new Response("Upstream connection failed", { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
