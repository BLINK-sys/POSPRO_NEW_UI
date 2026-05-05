"use server"

import { cookies } from "next/headers"
import { API_BASE_URL, getApiUrl } from "@/lib/api-address"

// ---------------------------------------------------------------------------
// Типы (синхронны с бэком — models/ai_logs.py)
// ---------------------------------------------------------------------------

export type ImportLogStatus = "error" | "imported" | "saved"
export type UserRole = "guest" | "client" | "wholesale" | "system" | "admin"

export interface AIImportLog {
  id: number
  created_at: string
  updated_at: string | null
  user_id: number | null
  user_email: string
  user_role: string
  source_url: string
  status: ImportLogStatus
  imported_data: {
    name?: string
    description_length?: number
    characteristics_count?: number
    images_count?: number
  } | null
  product_id: number | null
  product_name: string | null
  error_message: string | null
}

export interface AIChatSession {
  id: number
  client_session_token: string
  started_at: string
  last_message_at: string
  user_role: UserRole
  user_id: number | null
  user_email: string | null
  user_name: string | null
  message_count: number
  messages?: AIChatMessage[]
}

export interface AIChatMessage {
  id: number
  session_id: number
  created_at: string
  role: "user" | "assistant"
  content: string
}

export interface LoggedSystemUser {
  id: number
  email: string
  full_name: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("jwt-token")?.value || null
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

// ---------------------------------------------------------------------------
// Write API — вызывается из формы создания товара
// ---------------------------------------------------------------------------

/**
 * Помечает лог импорта как 'saved' и привязывает product_id. Вызывается
 * после finalizeProduct в product-create-page. Fire-and-forget по
 * назначению — если не удалось залогировать, не валим основной флоу.
 */
export async function markImportLogSaved(
  logId: number,
  productId: number,
  productName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getToken()
    if (!token) return { success: false, error: "Не авторизован" }

    const res = await fetch(getApiUrl(`/api/ai-import-logs/${logId}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "saved",
        product_id: productId,
        product_name: productName,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: data.error || `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e: any) {
    console.error("markImportLogSaved error:", e)
    return { success: false, error: e?.message || "Network error" }
  }
}

// ---------------------------------------------------------------------------
// Admin GET API — для страницы логов в админке
// ---------------------------------------------------------------------------

export interface ImportLogsFilter {
  status?: ImportLogStatus
  user_id?: number
  user_role?: UserRole
  date_from?: string  // ISO date YYYY-MM-DD
  date_to?: string
  search?: string
  page?: number
  per_page?: number
}

export async function listImportLogs(
  filter: ImportLogsFilter = {},
): Promise<PaginatedResponse<AIImportLog>> {
  try {
    const token = await getToken()
    if (!token) return { items: [], total: 0, page: 1, per_page: 25 }

    const url = getApiUrl(`/api/admin/ai-logs/imports${buildQuery(filter as any)}`)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return { items: [], total: 0, page: 1, per_page: 25 }
    return res.json()
  } catch (e) {
    console.error("listImportLogs error:", e)
    return { items: [], total: 0, page: 1, per_page: 25 }
  }
}

export interface ChatLogsFilter {
  user_id?: number
  user_role?: UserRole
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  per_page?: number
}

export async function listChatSessions(
  filter: ChatLogsFilter = {},
): Promise<PaginatedResponse<AIChatSession>> {
  try {
    const token = await getToken()
    if (!token) return { items: [], total: 0, page: 1, per_page: 25 }

    const url = getApiUrl(`/api/admin/ai-logs/chats${buildQuery(filter as any)}`)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return { items: [], total: 0, page: 1, per_page: 25 }
    return res.json()
  } catch (e) {
    console.error("listChatSessions error:", e)
    return { items: [], total: 0, page: 1, per_page: 25 }
  }
}

export async function getChatSession(sessionId: number): Promise<AIChatSession | null> {
  try {
    const token = await getToken()
    if (!token) return null

    const res = await fetch(getApiUrl(`/api/admin/ai-logs/chats/${sessionId}`), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    return res.json()
  } catch (e) {
    console.error("getChatSession error:", e)
    return null
  }
}

export async function listLoggedSystemUsers(): Promise<LoggedSystemUser[]> {
  try {
    const token = await getToken()
    if (!token) return []

    const res = await fetch(getApiUrl("/api/admin/ai-logs/system-users"), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    return res.json()
  } catch (e) {
    console.error("listLoggedSystemUsers error:", e)
    return []
  }
}
