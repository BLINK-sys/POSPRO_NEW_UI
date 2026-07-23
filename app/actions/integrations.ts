"use server"

import { cookies } from "next/headers"
import { API_BASE_URL } from "@/lib/api-address"

// ── Types ────────────────────────────────────────

export type IntegrationType = "bio" | "equip"

export type ScheduleMode = "weekly" | "interval"

// weekly:   {"days": ["mon","fri"], "time": "03:00"}
// interval: {"days": 14, "time": "04:00", "anchor": "2026-07-24"}
export type ScheduleData =
  | { days: string[]; time: string }
  | { days: number; time: string; anchor?: string }

export interface IntegrationSettings {
  id: number
  type: IntegrationType
  enabled: boolean
  schedule_mode: ScheduleMode
  schedule_data: ScheduleData
  last_heartbeat_at: string | null
  updated_at: string | null
}

export interface IntegrationRun {
  id: number
  type: IntegrationType
  trigger: "scheduled" | "manual"
  triggered_by: string | null
  started_at: string
  finished_at: string | null
  status: "running" | "success" | "failed" | "cancelled"
  phase: string | null
  progress: Record<string, any> | null
  error: string | null
  log_excerpt: string | null
}

export interface IntegrationCard {
  type: IntegrationType
  online: boolean
  settings: IntegrationSettings
  last_run: IntegrationRun | null
  active_run: IntegrationRun | null
}

export interface IntegrationDetail {
  type: IntegrationType
  online: boolean
  settings: IntegrationSettings
  active_run: IntegrationRun | null
  history: IntegrationRun[]
}

// ── Helpers ──────────────────────────────────────

async function getToken(): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

// API_BASE_URL = https://pospro-new-server.onrender.com (без /api).
// Blueprint зарегистрирован под /api/admin/integrations.
const BASE = `${API_BASE_URL}/api/admin/integrations`

// ── List / Detail ────────────────────────────────

export async function listIntegrations(): Promise<IntegrationCard[]> {
  const token = await getToken()
  const res = await fetch(`${BASE}/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const body = await res.json()
  return body.data || []
}

export async function getIntegrationDetail(type: IntegrationType): Promise<IntegrationDetail | null> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${type}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  const body = await res.json()
  return body.data || null
}

// ── Settings ─────────────────────────────────────

export async function updateIntegrationSettings(
  type: IntegrationType,
  updates: Partial<Pick<IntegrationSettings, "enabled" | "schedule_mode" | "schedule_data">>,
): Promise<{ success: boolean; message?: string; data?: IntegrationSettings }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${type}/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
    cache: "no-store",
  })
  const body = await res.json()
  if (!res.ok) return { success: false, message: body.message || "Ошибка" }
  return { success: true, data: body.data }
}

// ── Trigger «Запустить сейчас» ───────────────────

export async function triggerIntegration(
  type: IntegrationType,
): Promise<{ success: boolean; message?: string; command_id?: number; active_run_id?: number }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${type}/trigger`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const body = await res.json()
  if (res.status === 409) {
    return { success: false, message: body.message, active_run_id: body.active_run_id }
  }
  if (!res.ok) return { success: false, message: body.message || "Ошибка" }
  return { success: true, command_id: body.command_id, message: body.message }
}

// ── History ──────────────────────────────────────

export async function listIntegrationRuns(
  type: IntegrationType,
  limit = 30,
): Promise<IntegrationRun[]> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${type}/runs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const body = await res.json()
  return body.data || []
}
