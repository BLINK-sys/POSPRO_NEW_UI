import type { MetadataRoute } from "next"

// Канонический домен; падаем сразу на pospro.kz (не на onrender), чтобы
// даже без NEXT_PUBLIC_SITE_URL robots/sitemap были корректны.
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || "https://pospro.kz"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/auth", "/profile", "/api"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
