import { getSuppliers } from "@/app/actions/suppliers"
import { getCurrencies } from "@/app/actions/currencies"
import { getWarehouses } from "@/app/actions/warehouses"
import { SuppliersPageClient } from "@/components/suppliers-page-client"

export default async function SuppliersPage() {
  const [suppliers, currencies, warehouses] = await Promise.all([
    getSuppliers(),
    getCurrencies(),
    getWarehouses(),
  ])

  return (
    <SuppliersPageClient
      initialSuppliers={suppliers}
      initialCurrencies={currencies}
      initialWarehouses={warehouses}
    />
  )
}
