import { listHelpArticles } from "@/app/actions/help-articles"
import { HelpArticlesList } from "@/components/help-articles-list"

export default async function HelpAdminPage() {
  const articles = await listHelpArticles()
  return <HelpArticlesList initialArticles={articles} />
}
