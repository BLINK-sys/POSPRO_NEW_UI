import { notFound } from "next/navigation"
import { getProductBySlug } from "@/app/actions/products"
import { getCategories } from "@/app/actions/categories"
import { getBrands, getStatuses } from "@/app/actions/meta"
import { getSuppliers } from "@/app/actions/suppliers"
import { ProductEditPage } from "@/components/product-edit-page"

interface ProductEditPageProps {
  params: {
    slug: string
  }
}

export default async function ProductEdit({ params }: ProductEditPageProps) {
  const [product, categories, brands, statuses, suppliers] = await Promise.all([
    getProductBySlug(params.slug),
    getCategories(),
    getBrands(),
    getStatuses(),
    getSuppliers(),
  ])

  if (!product) {
    notFound()
  }

  return <ProductEditPage product={product} categories={categories} brands={brands} statuses={statuses} suppliers={suppliers} />
}
