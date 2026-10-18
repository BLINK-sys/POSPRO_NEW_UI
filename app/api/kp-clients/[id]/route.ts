/**
 * Next-прокси для `GET/PUT/DELETE /api/kp-clients/<id>` — читает JWT из
 * cookie и проксирует на Flask. Без этого роута crmPut/crmDelete из
 * `clients-list.tsx` возвращали 404 (у Next не было хендлера под id).
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

type Params = { id: string }

async function forward(
  request: NextRequest,
  { params }: { params: Params },
  method: "GET" | "PUT" | "DELETE",
) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  const url = getApiUrl(`/api/kp-clients/${params.id}`)
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  }
  if (method === "PUT") {
    init.body = await request.text()
  }
  try {
    const upstream = await fetch(url, init)
    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Ошибка соединения", details: e?.message },
      { status: 502 },
    )
  }
}

export const GET = (req: NextRequest, ctx: { params: Params }) =>
  forward(req, ctx, "GET")

export const PUT = (req: NextRequest, ctx: { params: Params }) =>
  forward(req, ctx, "PUT")

export const DELETE = (req: NextRequest, ctx: { params: Params }) =>
  forward(req, ctx, "DELETE")
