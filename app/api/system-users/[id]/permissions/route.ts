/**
 * Next-прокси для `PATCH /api/system-users/<id>/permissions` — читает JWT
 * из cookie и проксирует на Flask. Обновляет спец-права SystemUser
 * (is_owner / can_see_all_* / can_manage_pipelines).
 *
 * Использование с фронта — через crmFetch на `/api/system-users/<id>/permissions`.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  const body = await request.text()
  const url = getApiUrl(`/api/system-users/${params.id}/permissions`)
  try {
    const upstream = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body || undefined,
      cache: "no-store",
    })
    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Ошибка соединения", details: e?.message },
      { status: 502 },
    )
  }
}
