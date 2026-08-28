import { getCategories } from "@/app/actions/categories"
import { CategoryExplorer } from "@/components/category-explorer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function CategoriesPage() {
  const initialCategories = await getCategories()

  return (
    <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
      <CardHeader>
        <CardTitle>Категории</CardTitle>
        <CardDescription>
          Управление категориями товаров. Переключатель «Строкой / Сеткой»; клик по стрелке — открывает
          подкатегории в отдельной колонке справа.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CategoryExplorer initialCategories={initialCategories} />
      </CardContent>
    </Card>
  )
}
