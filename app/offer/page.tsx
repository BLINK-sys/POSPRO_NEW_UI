import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchStaticPage, StaticPageView } from "@/components/static-page-view"

export const revalidate = 3600
const SLUG = "offer"

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG)
  return {
    title: page?.title || "Публичная оферта — PosPro",
    description: "Условия продажи товаров через сайт pospro.kz",
  }
}

export default async function OfferPage() {
  const page = await fetchStaticPage(SLUG)
  if (!page) notFound()
  return <StaticPageView page={page} fallbackTitle="Публичная оферта" />
}
