import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchStaticPage, StaticPageView } from "@/components/static-page-view"

export const revalidate = 3600
const SLUG = "privacy"

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG)
  return {
    title: page?.title || "Политика конфиденциальности — PosPro",
    description: "Как pospro.kz обрабатывает персональные данные",
  }
}

export default async function PrivacyPage() {
  const page = await fetchStaticPage(SLUG)
  if (!page) notFound()
  return <StaticPageView page={page} fallbackTitle="Политика конфиденциальности" />
}
