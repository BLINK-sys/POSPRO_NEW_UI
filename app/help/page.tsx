import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchStaticPage, StaticPageView } from "@/components/static-page-view"

export const revalidate = 3600
const SLUG = "help"

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG)
  return {
    title: page?.title || "Помощь — PosPro",
    description: "Помощь и часто задаваемые вопросы",
  }
}

export default async function HelpPage() {
  const page = await fetchStaticPage(SLUG)
  if (!page) notFound()
  return <StaticPageView page={page} fallbackTitle="Помощь" />
}
