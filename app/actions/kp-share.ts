"use server"

import { cookies } from "next/headers"
import { API_BASE_URL } from "@/lib/api-address"

// ─────────────────────────── Types ───────────────────────────

export type KpAccessLevel = "view" | "edit"

export interface KpShareEntry {
  id: number
  kp_history_id: number
  shared_with_user_id: number
  access_level: KpAccessLevel
  created_by: number
  created_at: string
  target?: { id: number; email: string; full_name: string } | null
}

export interface KpShareTarget {
  id: number
  email: string
  full_name: string
}

export interface KpSuperAdminAccess {
  id: number
  allowed_user_ids: number[]
  updated_at: string | null
  updated_by_email: string | null
}

export interface KpSuperAdminCheck {
  is_owner: boolean
  is_super_admin: boolean
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

// ─────────────────────────── Sharing per-KP ───────────────────────────

export async function getKpShares(
  kpId: number,
): Promise<{ success: boolean; shares?: KpShareEntry[]; error?: string }> {
  try {
    const res = await authedFetch(`/api/kp-history/${kpId}/shares`)
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось загрузить" }
    return { success: true, shares: data.shares }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function shareKp(
  kpId: number,
  targetUserId: number,
  accessLevel: KpAccessLevel,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authedFetch(`/api/kp-history/${kpId}/share`, {
      method: "POST",
      body: JSON.stringify({ target_user_id: targetUserId, access_level: accessLevel }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось поделиться" }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function revokeKpShare(
  kpId: number,
  targetUserId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authedFetch(
      `/api/kp-history/${kpId}/share/${targetUserId}`,
      { method: "DELETE" },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data.error || "Не удалось отозвать" }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function getKpShareTargets(): Promise<KpShareTarget[]> {
  try {
    const res = await authedFetch(`/api/kp-share/system-users`)
    if (!res.ok) return []
    const data = await res.json()
    return data.users || []
  } catch {
    return []
  }
}

// ─────────────────────────── Super-admin access ───────────────────────────

export async function checkKpSuperAdminAccess(): Promise<KpSuperAdminCheck> {
  try {
    const res = await authedFetch(`/api/admin/kp-super-admin-access/check`)
    if (!res.ok) return { is_owner: false, is_super_admin: false }
    const data = await res.json()
    return {
      is_owner: !!data.is_owner,
      is_super_admin: !!data.is_super_admin,
    }
  } catch {
    return { is_owner: false, is_super_admin: false }
  }
}

export async function getKpSuperAdminConfig(): Promise<{
  success: boolean
  access?: KpSuperAdminAccess
  system_users?: Array<{ id: number; email: string; full_name: string; is_owner: boolean }>
  error?: string
}> {
  try {
    const res = await authedFetch(`/api/admin/kp-super-admin-access`)
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось загрузить" }
    return { success: true, access: data.access, system_users: data.system_users }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function updateKpSuperAdminConfig(
  allowedUserIds: number[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authedFetch(`/api/admin/kp-super-admin-access`, {
      method: "PUT",
      body: JSON.stringify({ allowed_user_ids: allowedUserIds }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || "Не удалось сохранить" }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}
