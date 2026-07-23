import { listIntegrations } from "@/app/actions/integrations"
import IntegrationsListClient from "@/components/integrations-list-client"
import { RefreshCw } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  const initial = await listIntegrations()

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <RefreshCw className="h-6 w-6 text-yellow-600" />
        <h1 className="text-2xl font-semibold">Автоматическая выгрузка</h1>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Управление автоматическими интеграциями с поставщиками. Выгрузки крутятся
        на локальном сервере (192.168.1.99) и шлют данные в магазин по расписанию.
        Клик по карточке — детальная страница с расписанием, историей и реалтайм-прогрессом.
        Статус карточек обновляется автоматически каждые 10 секунд.
      </p>

      {initial.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          Нет данных. Проверьте что миграция БД прошла.
        </div>
      ) : (
        <IntegrationsListClient initial={initial} />
      )}
    </div>
  )
}
