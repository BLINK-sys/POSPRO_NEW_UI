import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProductsTable } from "@/components/products-table"
import { getProducts } from "@/app/actions/products"
import { getCategories } from "@/app/actions/categories"
import { getBrands, getStatuses } from "@/app/actions/meta"
import { getSuppliers } from "@/app/actions/suppliers"

export const dynamic = 'force-dynamic'

interface ProductsPageProps {
  isSidebarCollapsed?: boolean
}

export default async function ProductsPage({ isSidebarCollapsed = false }: ProductsPageProps) {
  const [initialData, categories, brands, statuses, suppliers] = await Promise.all([
    getProducts({ page: 1, perPage: 25 }),
    getCategories(),
    getBrands(),
    getStatuses(),
    getSuppliers(),
  ])

  return (
    <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
      <CardHeader>
        <CardTitle>Товары</CardTitle>
        <CardDescription>Управление товарами в каталоге.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProductsTable
          initialData={initialData}
          categories={categories}
          brands={brands}
          statuses={statuses}
          suppliers={suppliers}
          isSidebarCollapsed={isSidebarCollapsed}
        />
      </CardContent>
    </Card>
  )
}
