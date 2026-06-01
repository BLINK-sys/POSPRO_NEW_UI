import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

/**
 * Прокси POST /auth/heartbeat — обновляет system_users.last_seen для
 * текущего системного пользователя. Зовётся из admin-layout раз в 60 сек
 * пока вкладка с админкой открыта. Для клиентских юзеров — silent no-op
 * (бэк отвечает 200 с tracked:false).
 */
export async function POST() {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ success: false }, { status: 200 })
  }
  try {
    const res = await fetch(getApiUrl("/auth/heartbeat"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
