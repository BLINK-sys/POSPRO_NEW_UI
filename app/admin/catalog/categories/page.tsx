import { getCategories } from "@/app/actions/categories"
import { CategoryList } from "@/components/category-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function CategoriesPage() {
  const initialCategories = await getCategories()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Категории</CardTitle>
        <CardDescription>
          Управление категориями товаров. Перетаскивайте элементы для изменения порядка.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CategoryList initialCategories={initialCategories} />
      </CardContent>
    </Card>
  )
}
