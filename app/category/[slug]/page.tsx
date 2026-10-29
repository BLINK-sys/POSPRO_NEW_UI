/**
 * SEO П.2+П.3+П.4+П.5 для /category/[slug].
 *
 * Server-side грузит первую страницу категории и отдаёт в HTML:
 * название, подкатегории, карточки товаров — всё в разметке сразу.
 * Клиентский слой далее управляет сортировкой/фильтром/пагинацией.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getCategoryData,
  type CategoryData,
  type ProductData,
} from "@/app/actions/public"
import CategoryClient from "./category-client"

export const revalidate = 1800

interface InitialData {
  category: CategoryData
  subcategories: CategoryData[]
  products: ProductData[]
  brands?: Array<{
    id: number
    name: string
    country?: string
    description?: string
    image_url?: string
  }>
  pagination?: {
    page: number
    per_page: number
    total_count: number
    total_pages: number
  }
}

async function loadCategory(slug: string): Promise<InitialData | null> {
  try {
    const raw = await getCategoryData(slug, { page: 1, perPage: 20 })
    if (!raw?.category) return null
    return {
      category: raw.category,
      subcategories: raw.children || [],
      products: raw.products,
      brands: raw.brands,
      pagination: raw.pagination,
    }
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const data = await loadCategory(slug)
  if (!data?.category) {
    return { title: "Категория не найдена | PosPro" }
  }
  const c = data.category
  const title = `${c.name} — купить в Казахстане, цены | PosPro`
  const desc =
    (c.description && c.description.slice(0, 160)) ||
    `${c.name} — большой выбор, цены и наличие. Доставка по Казахстану, безнал для ТОО.`
  const canonical = `https://pospro.kz/category/${slug}`
  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      type: "website",
    },
  }
}

export default async function CategoryPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const data = await loadCategory(slug)
  if (!data?.category) notFound()

  const canonical = `https://pospro.kz/category/${slug}`

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: "https://pospro.kz/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: data.category.name,
        item: canonical,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CategoryClient slug={slug} initialData={data} />
    </>
  )
}
