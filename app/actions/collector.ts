"use server"

import { cookies } from "next/headers"
import { API_BASE_URL } from "@/lib/api-address"

// ── Types ────────────────────────────────────────

export type TaskStatus = "queued" | "running" | "success" | "failed" | "cancelled"
export type FileStatus = "ok" | "failed" | "skipped" | "stopped"

export interface CollectorFile {
  id: number
  task_id: number
  city: string
  city_name: string | null
  query: string
  url: string
  rel_path: string | null
  filename: string | null
  rows: number
  bytes: number
  attempts: number
  duration_sec: number
  status: FileStatus
  error: string | null
  created_at: string | null
}

export interface CollectorProgress {
  pair_index?: number
  pair_total?: number
  city?: string
  query?: string
  attempt?: number
  records?: number
  message?: string
  kind?: string
}

export interface CollectorTask {
  id: number
  owner_id: number
  name: string
  cities: string[]
  city_names?: string[]
  queries: string[]
  custom_url: string | null
  keep_columns: string[] | null
  drop_other_columns: boolean
  autosize_columns: boolean
  wrap_text: boolean
  networks_min_count: number | null
  sort_by_name: boolean
  max_records: number | null
  file_format: string
  delay_min_ms: number
  delay_max_ms: number
  status: TaskStatus
  phase: string | null
  progress: CollectorProgress | null
  log_excerpt: string | null
  error: string | null
  created_at: string | null
  started_at: string | null
  finished_at: string | null
  files_count?: number
  files_ok?: number
  files?: CollectorFile[]
}

export interface CityCatalogItem {
  code: string
  name: string
  domain: string
}

export interface ColumnsAvailable {
  default: string[]
  extra: string[]
}

// ── Helpers ──────────────────────────────────────

async function getToken(): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

const BASE = `${API_BASE_URL}/api/admin/collector`

// ── Задачи ────────────────────────────────────────

export interface CreateTaskInput {
  name: string
  cities?: string[]
  queries?: string[]
  custom_url?: string | null
  keep_columns?: string[] | null
  drop_other_columns?: boolean
  autosize_columns?: boolean
  wrap_text?: boolean
  networks_min_count?: number | null
  sort_by_name?: boolean
  max_records?: number | null
  file_format?: string
  delay_min_ms?: number
  delay_max_ms?: number
}

export async function createCollectorTask(
  input: CreateTaskInput,
): Promise<{ success: boolean; message?: string; data?: CollectorTask }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })
  const body = await res.json()
  if (!res.ok) return { success: false, message: body.message || "Ошибка" }
  return { success: true, data: body.data }
}

export async function listCollectorTasks(
  status?: TaskStatus,
  limit = 50,
): Promise<{ tasks: CollectorTask[]; online: boolean }> {
  const token = await getToken()
  const params = new URLSearchParams({ limit: String(limit) })
  if (status) params.set("status", status)
  const res = await fetch(`${BASE}/tasks?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return { tasks: [], online: false }
  const body = await res.json()
  return { tasks: body.data || [], online: !!body.online }
}

export async function getCollectorTask(
  id: number,
): Promise<{ task: CollectorTask | null; online: boolean }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/tasks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return { task: null, online: false }
  const body = await res.json()
  return { task: body.data || null, online: !!body.online }
}

export async function cancelCollectorTask(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/tasks/${id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const body = await res.json()
  if (!res.ok) return { success: false, message: body.message || "Не удалось отменить" }
  return { success: true, message: body.message }
}

export async function deleteCollectorTask(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/tasks/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: body.message || "Не удалось удалить" }
  return { success: true, message: body.message }
}

// ── Справочники ───────────────────────────────────

export async function listCatalogCities(country = "kz"): Promise<CityCatalogItem[]> {
  const token = await getToken()
  const res = await fetch(`${BASE}/catalog/cities?country=${encodeURIComponent(country)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const body = await res.json()
  return body.data || []
}

export async function getColumnsAvailable(): Promise<ColumnsAvailable> {
  const token = await getToken()
  const res = await fetch(`${BASE}/columns/available`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return { default: [], extra: [] }
  const body = await res.json()
  return body.data || { default: [], extra: [] }
}

// ── Статус воркера ─────────────────────────────────

export async function getWorkerStatus(): Promise<{ online: boolean; last_heartbeat_at: string | null }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/worker`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return { online: false, last_heartbeat_at: null }
  const body = await res.json()
  return {
    online: !!body.online,
    last_heartbeat_at: body.data?.last_heartbeat_at ?? null,
  }
}
