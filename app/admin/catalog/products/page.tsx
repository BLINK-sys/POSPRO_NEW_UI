import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { ProductsTable } from '../../../../components/products-table'
import { getProducts } from '../../../../app/actions/products'
import { getCategories } from '../../../../app/actions/categories'
import { getBrands, getStatuses } from '../../../../app/actions/meta'

export default async function ProductsPage() {
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
        />
      </CardContent>
    </Card>
  )
}
