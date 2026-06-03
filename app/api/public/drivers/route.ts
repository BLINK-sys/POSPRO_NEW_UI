import { NextResponse } from "next/server"
import { getApiUrl } from "@/lib/api-address"

/**
 * Прокси GET /api/drivers/public — список публичных драйверов.
 * Используется на /admin/remote в панели «Из системы»: оператор
 * выбирает галочками файлы из админских драйверов и отправляет
 * их клиенту по WebRTC DataChannel.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const r = await fetch(getApiUrl("/api/drivers/public"), {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
    const data = await r.json().catch(() => [])
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
