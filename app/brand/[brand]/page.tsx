/**
 * SEO П.2+П.3+П.4+П.5 для /brand/[brand] — все товары одной марки.
 *
 * Server Component: грузит первую страницу товаров бренда, отдаёт
 * HTML. Клиентский слой далее управляет фильтром по категориям,
 * пагинацией, карточками-рейлсом брендов. notFound() если бренд
 * не существует.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getProductsByBrandDetailed,
  type PaginatedBrandProducts,
} from "@/app/actions/public"
import BrandClient from "./brand-client"

export const revalidate = 1800

async function loadBrand(
  brandParam: string,
): Promise<PaginatedBrandProducts | null> {
  const brandName = decodeURIComponent(brandParam)
  try {
    const data = await getProductsByBrandDetailed(brandName, {
      page: 1,
      perPage: 20,
    })
    if (!data?.brand) return null
    return data
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ brand: string }> },
): Promise<Metadata> {
  const { brand } = await params
  const data = await loadBrand(brand)
  if (!data?.brand) {
    return { title: "Бренд не найден | PosPro" }
  }
  const b = data.brand
  const title = `Оборудование ${b.name} в Казахстане — цены и наличие | PosPro`
  const desc =
    (b.description && b.description.slice(0, 160)) ||
    `Товары марки ${b.name} — в наличии и под заказ. Доставка по Казахстану, безнал для ТОО.`
  const canonical = `https://pospro.kz/brand/${encodeURIComponent(b.name)}`
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

export default async function BrandPage(
  { params }: { params: Promise<{ brand: string }> },
) {
  const { brand } = await params
  const data = await loadBrand(brand)
  if (!data?.brand) notFound()

  const b = data.brand
  const canonical = `https://pospro.kz/brand/${encodeURIComponent(b.name)}`

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
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
            name: "Бренды",
            item: "https://pospro.kz/brands",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: b.name,
            item: canonical,
          },
        ],
      },
      {
        "@type": "Brand",
        name: b.name,
        description: b.description || undefined,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BrandClient brandName={decodeURIComponent(brand)} initialBrandData={data} />
    </>
  )
}
