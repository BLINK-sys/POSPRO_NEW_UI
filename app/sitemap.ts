import type { MetadataRoute } from "next"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pospro-new-server.onrender.com"

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || "https://pospro-new-ui.onrender.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ]

  try {
    const res = await fetch(`${API_BASE_URL}/api/public/sitemap-slugs`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return entries

    const { products = [], categories = [] } = (await res.json()) as {
      products?: string[]
      categories?: string[]
    }

    for (const slug of categories) {
      if (slug) {
        entries.push({
          url: `${baseUrl}/category/${encodeURIComponent(slug)}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        })
      }
    }

    for (const slug of products) {
      if (slug) {
        entries.push({
          url: `${baseUrl}/product/${encodeURIComponent(slug)}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        })
      }
    }
  } catch {
    // при ошибке API отдаём хотя бы главную
  }

  return entries
}
