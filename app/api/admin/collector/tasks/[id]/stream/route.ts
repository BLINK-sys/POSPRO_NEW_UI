/**
 * Next.js SSE proxy для /admin/collector/tasks/<id>/stream.
 * См. app/api/admin/integrations/[type]/stream/route.ts — тот же паттерн,
 * причина та же (EventSource без Authorization → кладём JWT в ?token).
 */

import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import { API_BASE_URL } from "@/lib/api-address"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const taskId = parseInt(id, 10)
  if (isNaN(taskId)) return new Response("Bad task id", { status: 400 })

  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) return new Response("Unauthorized", { status: 401 })

  const upstreamUrl =
    `${API_BASE_URL}/api/admin/collector/tasks/${taskId}/stream?token=${encodeURIComponent(token)}`

  const controller = new AbortController()
  req.signal.addEventListener("abort", () => controller.abort())

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    })
  } catch {
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
