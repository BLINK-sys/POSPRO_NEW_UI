/**
 * SEO П.2+П.3+П.4+П.5 для /section/[slug] — страница одного готового
 * решения (кофейня под ключ, магазин под ключ и т.п.).
 *
 * Server Component: загружает первую страницу раздела на сервере
 * (товары, бренды, подкатегории), отдаёт в HTML. Клиентский слой
 * получает её через props и работает дальше (фильтры, пагинация).
 *
 * ISR revalidate 1800. notFound() на несуществующий slug.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getSectionData } from "@/app/actions/public"
import SectionClient from "./section-client"

export const revalidate = 1800

async function loadSection(slug: string) {
  try {
    return await getSectionData(slug, { page: 1, perPage: 20 })
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const data = await loadSection(slug)
  if (!data?.section_card) {
    return { title: "Готовое решение не найдено | PosPro" }
  }
  const name = data.section_card.name
  const title = `Оборудование для ${name} под ключ в Казахстане | PosPro`
  const desc =
    data.section_card.description?.slice(0, 160) ||
    `Готовый комплект оборудования для ${name}. Доставка по Казахстану, безнал для ТОО.`
  const canonical = `https://pospro.kz/section/${slug}`
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

export default async function SectionPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const data = await loadSection(slug)
  if (!data?.section_card) notFound()

  const canonical = `https://pospro.kz/section/${slug}`

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
            name: "Готовые решения",
            item: "https://pospro.kz/sections",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: data.section_card.name,
            item: canonical,
          },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SectionClient slug={slug} initialData={data} />
    </>
  )
}
