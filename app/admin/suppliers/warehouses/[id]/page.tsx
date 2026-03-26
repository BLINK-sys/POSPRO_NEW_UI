import { getWarehouse } from "@/app/actions/warehouses"
import { getProductCostsCount } from "@/app/actions/product-costs"
import { WarehouseDetail } from "@/components/warehouse-detail"
import { notFound } from "next/navigation"

export default async function WarehouseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const warehouseId = parseInt(params.id)
  if (isNaN(warehouseId)) notFound()

  const [warehouse, productsCount] = await Promise.all([
    getWarehouse(warehouseId),
    getProductCostsCount({ warehouse_id: warehouseId }),
  ])

  if (!warehouse) notFound()

  return <WarehouseDetail initialWarehouse={warehouse} initialProductsCount={productsCount} />
}
