/**
 * Next-прокси для `GET /api/system-users` — читает JWT из cookie и
 * проксирует на Flask. Flask возвращает плоский массив
 * `[{id, full_name, email, ...}, ...]`, не `{users: [...]}` — учитывать
 * на клиенте.
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
  const url = getApiUrl(`/api/system-users${search ? `?${search}` : ""}`)
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
