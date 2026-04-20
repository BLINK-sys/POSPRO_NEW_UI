import { listDrivers } from "@/app/actions/drivers"
import { DriversList } from "@/components/drivers-list"

export default async function DriversAdminPage() {
  const drivers = await listDrivers()
  return <DriversList initialDrivers={drivers} />
}
