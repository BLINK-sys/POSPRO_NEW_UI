"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

export interface Driver {
  id: number
  name: string
  url: string
  filename: string | null
  mime_type: string | null
  file_size: number | null
  is_active: boolean
  order: number
  created_at: string | null
  updated_at: string | null
  usage_count?: number
}

export interface DriverProduct {
  id: number
  name: string
  article: string
  slug: string
}

const getToken = async () => {
  const cs = await cookies()
  return cs.get("jwt-token")?.value || null
}

export interface PublicDriver {
  id: number
  name: string
  url: string
  filename: string | null
  mime_type: string | null
  file_size: number | null
}

export async function listPublicDrivers(): Promise<PublicDriver[]> {
  try {
    const r = await fetch(`${API_BASE_URL}/api/drivers/public`, {
      cache: "no-store",
    })
    if (!r.ok) return []
    return await r.json()
  } catch {
    return []
  }
}

export async function listDrivers(): Promise<Driver[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const r = await fetch(`${API_BASE_URL}/api/drivers/`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!r.ok) return []
    return await r.json()
  } catch {
    return []
  }
}

export async function getDriverProducts(driverId: number): Promise<DriverProduct[]> {
  const token = await getToken()
  if (!token) return []
  const r = await fetch(`${API_BASE_URL}/api/drivers/${driverId}/products`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!r.ok) return []
  return await r.json()
}

export async function createDriver(formData: FormData): Promise<Driver | { error: string }> {
  const token = await getToken()
  if (!token) return { error: "Not authorized" }
  const r = await fetch(`${API_BASE_URL}/api/drivers/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    return { error: err.error || "Не удалось создать" }
  }
  revalidatePath("/admin/drivers")
  return await r.json()
}

export async function updateDriver(
  id: number,
  payload: { name?: string; is_active?: boolean },
): Promise<Driver | null> {
  const token = await getToken()
  if (!token) return null
  const r = await fetch(`${API_BASE_URL}/api/drivers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) return null
  revalidatePath("/admin/drivers")
  return await r.json()
}

export async function replaceDriverFile(id: number, formData: FormData): Promise<Driver | null> {
  const token = await getToken()
  if (!token) return null
  const r = await fetch(`${API_BASE_URL}/api/drivers/${id}/file`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!r.ok) return null
  revalidatePath("/admin/drivers")
  return await r.json()
}

export async function deleteDriver(id: number): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  const r = await fetch(`${API_BASE_URL}/api/drivers/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return false
  revalidatePath("/admin/drivers")
  return true
}

export async function reorderDrivers(ids: number[]): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  const r = await fetch(`${API_BASE_URL}/api/drivers/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  })
  return r.ok
}

export async function attachDriversToProduct(productId: number, driverIds: number[]): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  const r = await fetch(`${API_BASE_URL}/api/drivers/attach/${productId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ driver_ids: driverIds }),
  })
  return r.ok
}
