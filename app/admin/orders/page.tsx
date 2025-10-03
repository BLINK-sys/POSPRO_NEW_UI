import { AdminOrdersTabs } from "@/components/admin-orders-tabs"
import { getManagers } from "@/app/actions/admin-orders"
import { getOrderStatuses } from "@/app/actions/order-statuses"

export default async function OrdersPage() {
  // Загружаем только справочные данные
  const [managersResult, statusesResult] = await Promise.all([
    getManagers(),
    getOrderStatuses()
  ])

  const managers = managersResult.success ? managersResult.data : []
  const statuses = statusesResult.success ? statusesResult.data : []

  return (
    <AdminOrdersTabs 
      managers={managers}
      statuses={statuses}
    />
  )
}
