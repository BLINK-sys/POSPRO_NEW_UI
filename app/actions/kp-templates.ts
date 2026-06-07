"use server"

import { cookies } from "next/headers"
import { API_BASE_URL } from "@/lib/api-address"

/**
 * KP template = снэпшот настроек («фирменный бланк»). Применяется к
 * локальному kpSettings одним кликом — сам шаблон не меняется.
 *
 * `settings` — произвольный объект, по смыслу это `KPSettings` без `kpName`.
 * Хранится в JSONB на бэке, типа `any` достаточно — TS-проверка нужна
 * только на месте импорта (там приведение к KPSettings).
 */

export interface KpTemplate {
  id: number
  name: string
  description: string | null
  settings: Record<string, any>
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface KpTemplateInput {
  name: string
  description?: string | null
  settings: Record<string, any>
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

export async function listKpTemplates(): Promise<KpTemplate[]> {
  try {
    const res = await authedFetch(`/api/kp-templates`)
    if (!res.ok) return []
    const data = await res.json()
    return data.templates || []
  } catch {
    return []
  }
}

export async function createKpTemplate(
  input: KpTemplateInput,
): Promise<{ success: boolean; template?: KpTemplate; error?: string }> {
  try {
    const res = await authedFetch(`/api/kp-templates`, {
      method: "POST",
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось создать" }
    return { success: true, template: data.template }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function updateKpTemplate(
  id: number,
  input: Partial<KpTemplateInput>,
): Promise<{ success: boolean; template?: KpTemplate; error?: string }> {
  try {
    const res = await authedFetch(`/api/kp-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось обновить" }
    return { success: true, template: data.template }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function deleteKpTemplate(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authedFetch(`/api/kp-templates/${id}`, { method: "DELETE" })
    if (res.ok) return { success: true }
    const data = await res.json().catch(() => ({}))
    return { success: false, error: data.error }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}
