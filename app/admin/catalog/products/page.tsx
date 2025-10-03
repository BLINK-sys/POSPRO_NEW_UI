import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProductsTable } from "@/components/products-table"
import { getProducts } from "@/app/actions/products"
import { getCategories } from "@/app/actions/categories"
import { getBrands, getStatuses } from "@/app/actions/meta"

interface ProductsPageProps {
  isSidebarCollapsed?: boolean
}

export default async function ProductsPage({ isSidebarCollapsed = false }: ProductsPageProps) {
  const [products, categories, brands, statuses] = await Promise.all([
    getProducts({}), // Получаем все товары без фильтров изначально
    getCategories(),
    getBrands(),
    getStatuses(),
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Товары</CardTitle>
        <CardDescription>Управление товарами в каталоге.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProductsTable
          initialProducts={products}
          categories={categories}
          brands={brands}
          statuses={statuses}
          isSidebarCollapsed={isSidebarCollapsed}
        />
      </CardContent>
    </Card>
  )
}
