/**
 * Next-прокси для `/api/user-prefs/<key>` (GET/PUT). JWT в httpOnly cookie
 * нужен бэку — поэтому не fetch напрямую с клиента.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

async function proxy(
  request: NextRequest,
  key: string,
  method: "GET" | "PUT",
) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  const url = getApiUrl(`/api/user-prefs/${encodeURIComponent(key)}`)
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
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Ошибка соединения", details: e?.message },
      { status: 502 },
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } },
) {
  return proxy(request, params.key, "GET")
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } },
) {
  return proxy(request, params.key, "PUT")
}
