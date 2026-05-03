import { getBrands, getStatuses } from "@/app/actions/meta"
import { BrandsAndStatusesTabs } from "@/components/brands-and-statuses-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function BrandsAndStatusesPage() {
  const [brands, statuses] = await Promise.all([getBrands(), getStatuses()])

  return (
    <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
      <CardHeader>
        <CardTitle>Бренды и Статусы</CardTitle>
        <CardDescription>Управление брендами товаров и статусами наличия.</CardDescription>
      </CardHeader>
      <CardContent>
        <BrandsAndStatusesTabs initialBrands={brands} initialStatuses={statuses} />
      </CardContent>
    </Card>
  )
}
