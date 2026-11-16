import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchStaticPage, StaticPageView } from "@/components/static-page-view"

export const revalidate = 3600
const SLUG = "return"

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG)
  return {
    title: page?.title || "Возврат и обмен — PosPro",
    description: "Условия возврата и обмена товаров в PosPro",
  }
}

export default async function ReturnPage() {
  const page = await fetchStaticPage(SLUG)
  if (!page) notFound()
  return <StaticPageView page={page} fallbackTitle="Возврат и обмен" />
}
