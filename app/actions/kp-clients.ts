"use server"

import { cookies } from "next/headers"
import { API_BASE_URL } from "@/lib/api-address"

// Один контакт клиента: телефон + произвольная заметка (например
// «WhatsApp», «секретарь», «после 18:00»). У одного клиента может быть
// несколько контактов.
export interface KpClientContact {
  phone: string
  note: string
}

export interface KpClient {
  id: number
  full_name: string | null
  object: string | null
  contacts: KpClientContact[]
  display_name: string
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface KpClientInput {
  full_name: string
  object?: string | null
  contacts?: KpClientContact[]
}

async function authedFetch(path: string, init?: RequestInit) {
  const token = cookies().get("jwt-token")?.value
  if (!token) throw new Error("Not authenticated")
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
}

export async function listKpClients(query?: string): Promise<KpClient[]> {
  try {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""
    const res = await authedFetch(`/api/kp-clients${qs}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.clients || []
  } catch {
    return []
  }
}

export async function getKpClient(id: number): Promise<KpClient | null> {
  try {
    const res = await authedFetch(`/api/kp-clients/${id}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.client || null
  } catch {
    return null
  }
}

export async function createKpClient(
  input: KpClientInput,
): Promise<{ success: boolean; client?: KpClient; error?: string }> {
  try {
    const res = await authedFetch(`/api/kp-clients`, {
      method: "POST",
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось создать" }
    return { success: true, client: data.client }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function updateKpClient(
  id: number,
  input: KpClientInput,
): Promise<{ success: boolean; client?: KpClient; error?: string }> {
  try {
    const res = await authedFetch(`/api/kp-clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось обновить" }
    return { success: true, client: data.client }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function deleteKpClient(
  id: number,
): Promise<{ success: boolean; error?: string; in_use_count?: number }> {
  try {
    const res = await authedFetch(`/api/kp-clients/${id}`, { method: "DELETE" })
    if (res.status === 204 || res.ok) {
      return { success: true }
    }
    const data = await res.json().catch(() => ({}))
    return { success: false, error: data.error, in_use_count: data.in_use_count }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}
