import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchStaticPage, StaticPageView } from "@/components/static-page-view"

export const revalidate = 3600
const SLUG = "requisites"

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG)
  return {
    title: page?.title || "Реквизиты — PosPro",
    description: "Банковские и юридические реквизиты ТОО",
  }
}

export default async function RequisitesPage() {
  const page = await fetchStaticPage(SLUG)
  if (!page) notFound()
  return <StaticPageView page={page} fallbackTitle="Реквизиты" />
}
