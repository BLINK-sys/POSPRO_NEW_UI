/**
 * Прокси-скачивание файла с бэка через httpOnly cookie JWT.
 * Прямой `<a href="{prodUrl}/...">` не работает: браузер не отправит JWT
 * cookie на другой origin. Проксируем через Next: подставляем Authorization
 * из cookie, стримим тело клиенту с оригинальными Content-* заголовками.
 */

import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import { API_BASE_URL } from "@/lib/api-address"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fid: string }> },
) {
  const { id, fid } = await params
  const taskId = parseInt(id, 10)
  const fileId = parseInt(fid, 10)
  if (isNaN(taskId) || isNaN(fileId)) return new Response("Bad id", { status: 400 })

  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) return new Response("Unauthorized", { status: 401 })

  const upstreamUrl = `${API_BASE_URL}/api/admin/collector/tasks/${taskId}/files/${fileId}`

  const controller = new AbortController()
  req.signal.addEventListener("abort", () => controller.abort())

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return new Response("Upstream connection failed", { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status })
  }

  // Прокидываем Content-Disposition и Content-Type — важно, иначе браузер
  // не поймёт имя файла и отобразит .xlsx как HTML.
  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("Content-Type") ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }
  const cd = upstream.headers.get("Content-Disposition")
  if (cd) headers["Content-Disposition"] = cd
  const cl = upstream.headers.get("Content-Length")
  if (cl) headers["Content-Length"] = cl

  return new Response(upstream.body, { status: 200, headers })
}
