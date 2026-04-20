"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

export interface HelpArticleMedia {
  id: number
  article_id: number
  url: string
  filename: string | null
  order: number
}

export interface HelpArticle {
  id: number
  title: string
  content: string
  order: number
  created_at: string | null
  updated_at: string | null
  media: HelpArticleMedia[]
}

const getToken = async () => {
  const cookieStore = await cookies()
  return cookieStore.get("jwt-token")?.value || null
}

export async function listHelpArticles(): Promise<HelpArticle[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const r = await fetch(`${API_BASE_URL}/api/help-articles/`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!r.ok) return []
    return await r.json()
  } catch {
    return []
  }
}

export async function getHelpArticle(id: number): Promise<HelpArticle | null> {
  const token = await getToken()
  if (!token) return null
  try {
    const r = await fetch(`${API_BASE_URL}/api/help-articles/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function createHelpArticle(payload: { title: string; content?: string }): Promise<HelpArticle | null> {
  const token = await getToken()
  if (!token) return null
  const r = await fetch(`${API_BASE_URL}/api/help-articles/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) return null
  const data = await r.json()
  revalidatePath("/admin/help")
  return data
}

export async function updateHelpArticle(
  id: number,
  payload: { title?: string; content?: string },
): Promise<HelpArticle | null> {
  const token = await getToken()
  if (!token) return null
  const r = await fetch(`${API_BASE_URL}/api/help-articles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) return null
  const data = await r.json()
  revalidatePath("/admin/help")
  revalidatePath(`/admin/help/${id}`)
  return data
}

export async function deleteHelpArticle(id: number): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  const r = await fetch(`${API_BASE_URL}/api/help-articles/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return false
  revalidatePath("/admin/help")
  return true
}

export async function reorderHelpArticles(ids: number[]): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  const r = await fetch(`${API_BASE_URL}/api/help-articles/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  })
  return r.ok
}

export async function uploadHelpVideo(articleId: number, formData: FormData): Promise<HelpArticleMedia | null> {
  const token = await getToken()
  if (!token) return null
  const r = await fetch(`${API_BASE_URL}/api/help-articles/${articleId}/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!r.ok) return null
  const data = await r.json()
  revalidatePath(`/admin/help/${articleId}`)
  return data
}

export async function deleteHelpVideo(mediaId: number): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  const r = await fetch(`${API_BASE_URL}/api/help-articles/videos/${mediaId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  return r.ok
}

export async function reorderHelpVideos(articleId: number, ids: number[]): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  const r = await fetch(`${API_BASE_URL}/api/help-articles/${articleId}/videos/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  })
  return r.ok
}
