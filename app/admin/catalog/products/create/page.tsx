import { getCategories } from "@/app/actions/categories"
import { getBrands, getStatuses } from "@/app/actions/meta"
import { getSuppliers } from "@/app/actions/suppliers"
import { ProductCreatePage } from "@/components/product-create-page"

export default async function ProductCreatePageRoute() {
  const [categories, brands, statuses, suppliers] = await Promise.all([
    getCategories(),
    getBrands(),
    getStatuses(),
    getSuppliers(),
  ])

  return (
    <ProductCreatePage
      categories={categories}
      brands={brands}
      statuses={statuses}
      suppliers={suppliers}
    />
  )
}
