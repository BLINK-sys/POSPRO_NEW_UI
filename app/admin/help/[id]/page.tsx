import { notFound } from "next/navigation"
import { getHelpArticle } from "@/app/actions/help-articles"
import { HelpArticleView } from "@/components/help-article-view"

export default async function HelpArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  const article = await getHelpArticle(Number(id))
  if (!article) notFound()
  return <HelpArticleView article={article} initialEdit={edit === "1"} />
}
