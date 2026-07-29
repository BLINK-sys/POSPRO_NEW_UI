import { listCollectorTasks, getWorkerStatus } from "@/app/actions/collector"
import CollectorListClient from "@/components/collector-list-client"
import { MapPin } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CollectorPage() {
  const [{ tasks, online: onlineFromList }, worker] = await Promise.all([
    listCollectorTasks(),
    getWorkerStatus(),
  ])

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-4">
        <MapPin className="h-6 w-6 text-yellow-600" />
        <h1 className="text-2xl font-semibold">2GIS сбор данных</h1>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Сервис сбора карточек 2GIS по городам и запросам. Задачи выполняются на локальном
        сервере (192.168.1.99), результат — .xlsx файлы с постобработкой (нужные колонки,
        автоширина, опционально фильтр сетей). Владелец видит все задачи, обычный админ —
        только свои.
      </p>

      <CollectorListClient
        initialTasks={tasks}
        initialWorkerOnline={onlineFromList || worker.online}
      />
    </div>
  )
}
