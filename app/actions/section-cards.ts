"use server"

import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"
import { API_ENDPOINTS } from "@/lib/api-endpoints"

export interface SectionCardSummary {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  banner_image_url: string
  target: "link" | "categories"
  link_url: string
  link_new_tab: boolean
  order: number
  active: boolean
  category_ids: number[]
}

export async function getSectionCards(): Promise<SectionCardSummary[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value
    if (!token) return []

    const response = await fetch(getApiUrl(API_ENDPOINTS.ADMIN.SECTION_CARDS.LIST), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) return []
    return await response.json()
  } catch (e) {
    console.error("Failed to fetch section cards:", e)
    return []
  }
}
