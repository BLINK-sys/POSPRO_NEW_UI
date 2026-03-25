import { getWarehouse } from "@/app/actions/warehouses"
import { getProductCosts } from "@/app/actions/product-costs"
import { WarehouseDetail } from "@/components/warehouse-detail"
import { notFound } from "next/navigation"

export default async function WarehouseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const warehouseId = parseInt(params.id)
  if (isNaN(warehouseId)) notFound()

  const [warehouse, productCosts] = await Promise.all([
    getWarehouse(warehouseId),
    getProductCosts({ warehouse_id: warehouseId }),
  ])

  if (!warehouse) notFound()

  return <WarehouseDetail initialWarehouse={warehouse} initialProductCosts={productCosts} />
}
