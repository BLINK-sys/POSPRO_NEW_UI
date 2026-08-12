import { API_BASE_URL } from "@/lib/api-address"
import { BlocksRenderer } from "@/components/page-builder/renderer"
import { parsePageContent } from "@/lib/page-blocks/types"

/**
 * Общий рендер публичной статической страницы по slug.
 * Контент из БД = JSON-массив блоков (`PageBlock[]`). Legacy — старый
 * HTML — оборачивается в один блок html (см. `parsePageContent`).
 */

export interface StaticPageData {
  slug: string
  title: string
  content: string
  is_active: boolean
}

export async function fetchStaticPage(slug: string): Promise<StaticPageData | null> {
  const res = await fetch(`${API_BASE_URL}/api/public/static-page/${slug}`, {
    next: { tags: [`static-page:${slug}`], revalidate: 3600 },
  })
  if (!res.ok) return null
  return await res.json()
}

export function StaticPageView({ page, fallbackTitle }: { page: StaticPageData; fallbackTitle: string }) {
  const showTitle = page.title.trim().length > 0
  const blocks = parsePageContent(page.content)
  return (
    <div className="container mx-auto px-4 md:px-6 py-8 public-page">
      {showTitle && (
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          {page.title}
        </h1>
      )}
      {blocks.length > 0 ? (
        <BlocksRenderer blocks={blocks} />
      ) : (
        <p className="text-gray-500 italic">
          Содержимое страницы пока не заполнено.
        </p>
      )}
    </div>
  )
}
