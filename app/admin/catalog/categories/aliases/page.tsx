import { getCategories } from "@/app/actions/categories"
import { listCategoryAliases, findSimilarCategories } from "@/app/actions/category-aliases"
import { AliasesClient } from "@/components/aliases-client"

export const dynamic = "force-dynamic"

export default async function CategoryAliasesPage() {
  // На сервере тянем всё за один заход — дешевле чем клиентские фетчи
  // при первой загрузке; дальше клиент сам делает reload через actions.
  const [categories, aliases, similar] = await Promise.all([
    getCategories(),
    listCategoryAliases({}),
    findSimilarCategories(0.85),
  ])

  return (
    <AliasesClient
      initialCategories={categories}
      initialAliases={aliases}
      initialSimilar={similar}
    />
  )
}
