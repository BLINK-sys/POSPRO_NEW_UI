import type { MetadataRoute } from "next"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pospro-new-server.onrender.com"

// Канонический домен; падаем сразу на pospro.kz (не на onrender), чтобы
// в sitemap никогда не утекли адреса технической копии.
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || "https://pospro.kz"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ВАЖНО: все URL со слэшом в конце — соответствует trailingSlash:true
  // в next.config и canonical, который рендерит Next. Иначе Google
  // засчитает каждый URL как редиректный (65k страниц → 65k 308).
  //
  // lastModified: НЕ ставим «сейчас» всем подряд — Google обесценит
  // поле. Для главной — текущий момент (её редко переоткрываем),
  // для карточек — ничего (пусть Google сам решает по контенту).
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
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
          url: `${baseUrl}/category/${encodeURIComponent(slug)}/`,
          changeFrequency: "weekly",
          priority: 0.8,
        })
      }
    }

    for (const slug of products) {
      if (slug) {
        entries.push({
          url: `${baseUrl}/product/${encodeURIComponent(slug)}/`,
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
