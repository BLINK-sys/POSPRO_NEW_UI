/**
 * Catch-all прокси для `/api/admin/*` в Flask-бэк.
 *
 * Читает JWT из cookie `jwt-token`, добавляет как Bearer header и
 * проксирует запрос как есть (метод, query, body). Существующие explicit
 * `route.ts` (dashboard-stats, collector/…, system-users и т.п.)
 * перехватывают свои пути сами — catch-all ловит только не-занятые.
 *
 * Поддержка форматов body:
 *  - JSON (application/json) — самый частый случай, читаем text() и
 *    пробрасываем как есть.
 *  - Multipart (multipart/form-data) — для upload'ов файлов. Читаем
 *    formData() и создаём новый FormData для fetch(). Content-Type
 *    сам выставится с правильным boundary — не хардкодим.
 *  - Прочие (text/plain, application/octet-stream и т.п.) — передаём
 *    сырой ArrayBuffer с исходным Content-Type.
 *
 * Ответ:
 *  - Если Flask отдал бинарь (image/*, application/pdf и т.п.) — пробрасываем
 *    как ArrayBuffer с исходными headers (важно для /download).
 *  - Если текст/JSON — text() и обратно.
 *
 * Использование с фронта:
 *   import { crmFetch, crmUpload } from "@/lib/crm-fetch"
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

async function proxy(request: NextRequest, path: string[]) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const cleanPath = path.join("/")
  const search = request.nextUrl.searchParams.toString()
  const url = getApiUrl(`/api/admin/${cleanPath}${search ? `?${search}` : ""}`)
  const method = request.method.toUpperCase()

  const clientCt = request.headers.get("content-type") || ""
  const isMultipart = clientCt.toLowerCase().startsWith("multipart/")
  const isJson = clientCt.toLowerCase().includes("application/json")

  // Собираем body и headers.
  let body: BodyInit | undefined = undefined
  const outHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  if (method !== "GET" && method !== "HEAD" && method !== "DELETE") {
    if (isMultipart) {
      // Multipart — читаем FormData и передаём в fetch как FormData:
      // Node сам выставит Content-Type с правильным boundary.
      try {
        body = await request.formData()
      } catch {
        body = undefined
      }
    } else if (isJson || !clientCt) {
      // JSON или без Content-Type (нередко на пустых POST).
      try {
        const raw = await request.text()
        body = raw || undefined
      } catch {
        body = undefined
      }
      if (body !== undefined) outHeaders["Content-Type"] = "application/json"
    } else {
      // Прочее (text/plain, xml, octet-stream) — сырой ArrayBuffer.
      try {
        body = await request.arrayBuffer()
      } catch {
        body = undefined
      }
      if (body !== undefined) outHeaders["Content-Type"] = clientCt
    }
  }

  try {
    const upstream = await fetch(url, {
      method,
      headers: outHeaders,
      body,
      cache: "no-store",
    })

    const contentType =
      upstream.headers.get("content-type") || "application/json"

    // Бинарные ответы (файлы, картинки) — как ArrayBuffer.
    if (
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/octet-stream" ||
      contentType === "application/pdf"
    ) {
      const buf = await upstream.arrayBuffer()
      const responseHeaders: Record<string, string> = { "Content-Type": contentType }
      const cd = upstream.headers.get("content-disposition")
      if (cd) responseHeaders["Content-Disposition"] = cd
      return new NextResponse(buf, {
        status: upstream.status,
        headers: responseHeaders,
      })
    }

    // Иначе — текст/JSON как строка.
    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    })
  } catch (e: any) {
    console.error(`[/api/admin proxy] ${method} ${url} failed:`, e)
    return NextResponse.json(
      { error: "Ошибка соединения с бэкендом", details: e?.message },
      { status: 502 },
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return proxy(request, path)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return proxy(request, path)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return proxy(request, path)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return proxy(request, path)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return proxy(request, path)
}
