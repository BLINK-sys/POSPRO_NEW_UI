/**
 * SEO П.2+П.3+П.4+П.5 для /sections — список готовых решений.
 *
 * Server Component: карточки загружаются на сервере через server action
 * (unstable_cache внутри), отдаются поисковику сразу в HTML. Поверх
 * монтируется клиентский слой с поиском/DnD, который получает уже
 * загруженный массив через props.
 *
 * ISR: revalidate 1800 сек — через полчаса кеш пересобирается в фоне.
 */

import type { Metadata } from "next"
import { getAllSectionCards } from "@/app/actions/public"
import SectionsClient from "./sections-client"

export const revalidate = 1800

const CANONICAL = "https://pospro.kz/sections"
const PAGE_TITLE = "Оборудование под ключ для бизнеса в Казахстане | PosPro"
const PAGE_DESCRIPTION =
  "Готовые комплекты оборудования под тип бизнеса: кафе, рестораны, " +
  "кофейни, магазины, пекарни и другие. Доставка по Казахстану, " +
  "безнал для ТОО."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: CANONICAL,
    type: "website",
  },
}

export default async function SectionsPage() {
  const cards = await getAllSectionCards()

  // Schema.org BreadcrumbList + ItemList (готовые решения). Это даёт
  // Google «карточку» списка в выдаче и правильные хлебные крошки.
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
            item: CANONICAL,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: "Готовые решения PosPro",
        itemListElement: cards.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          url: `https://pospro.kz/section/${c.slug}`,
        })),
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SectionsClient initialCards={cards} />
    </>
  )
}
