/**
 * Next-прокси для `GET /api/kp-clients` — читает JWT из cookie и
 * проксирует на Flask. Fetch напрямую с клиента даёт 401, потому что
 * jwt-token — httpOnly cookie.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

export async function GET(request: NextRequest) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  const search = request.nextUrl.searchParams.toString()
  const url = getApiUrl(`/api/kp-clients${search ? `?${search}` : ""}`)
  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })
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
