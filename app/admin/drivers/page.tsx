import { listDrivers } from "@/app/actions/drivers"
import { DriversList } from "@/components/drivers-list"
import { Card, CardContent } from "@/components/ui/card"

export default async function DriversAdminPage() {
  const drivers = await listDrivers()
  return (
    <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
      <CardContent className="pt-6">
        <DriversList initialDrivers={drivers} />
      </CardContent>
    </Card>
  )
}
