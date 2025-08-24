import { getBrands, getStatuses } from "@/app/actions/meta"
import { BrandsAndStatusesTabs } from "@/components/brands-and-statuses-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function BrandsAndStatusesPage() {
  const [brands, statuses] = await Promise.all([getBrands(), getStatuses()])

  return (
    <Card>
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
