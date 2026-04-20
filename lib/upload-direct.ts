"use client"

import { API_BASE_URL } from "@/lib/api-address"
import { ensureClientToken } from "@/app/actions/auth"

function readClientToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)jwt-token-client=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Загружает FormData напрямую с клиента в Flask, минуя Next.js.
 * Нужно для больших файлов — Next.js на free-плане Render падает по OOM
 * при буферизации >100MB через server actions.
 */
export async function uploadFileDirect<T = any>(
  endpoint: string,
  formData: FormData,
  init?: { method?: string },
): Promise<T> {
  let token = readClientToken()
  if (!token) {
    // Старая сессия — попросим сервер выдать клиентский токен
    await ensureClientToken()
    token = readClientToken()
  }
  if (!token) {
    throw new Error("Сессия истекла — войдите заново")
  }

  const r = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: init?.method || "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${r.status}`)
  }

  const ct = r.headers.get("content-type") || ""
  if (ct.includes("application/json")) return r.json()
  return r.text() as unknown as T
}
