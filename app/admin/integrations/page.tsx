import Link from "next/link"
import { listIntegrations } from "@/app/actions/integrations"
import { RefreshCw, CheckCircle2, XCircle, Loader2, Play, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

const TYPE_LABELS: Record<string, string> = {
  bio: "BIO — bioshop.ru",
  equip: "Equip — equip.me",
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  bio: "Автоматическая выгрузка товаров с bioshop.ru. Работает на локальном сервере, шлёт данные в магазин по расписанию.",
  equip: "Автоматическая выгрузка товаров с equip.me. Синхронизация складов Москва + Алматы.",
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
}

function runStatusBadge(status: string) {
  const cls =
    status === "success" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    status === "failed"  ? "bg-red-100 text-red-700 border-red-200" :
    status === "running" ? "bg-blue-100 text-blue-700 border-blue-200 animate-pulse" :
                           "bg-gray-100 text-gray-600 border-gray-200"
  const label =
    status === "success" ? "Успех" :
    status === "failed"  ? "Ошибка" :
    status === "running" ? "Выполняется" :
                           status
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
}

export default async function IntegrationsPage() {
  const cards = await listIntegrations()

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
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(card => {
          const activeRun = card.active_run
          const lastRun = card.last_run
          return (
            <Link
              key={card.type}
              href={`/admin/integrations/${card.type}`}
              className="block bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-yellow-300 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">{TYPE_LABELS[card.type] || card.type}</h2>
                  <p className="text-sm text-gray-500 mt-1">{TYPE_DESCRIPTIONS[card.type]}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 shrink-0" />
              </div>

              <div className="space-y-2 mt-4">
                {/* Online индикатор */}
                <div className="flex items-center gap-2 text-sm">
                  {card.online ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Локальный сервер онлайн</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-red-700 font-medium">Локальный сервер оффлайн</span>
                    </>
                  )}
                </div>

                {/* Enabled */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className={`w-2 h-2 rounded-full ${card.settings.enabled ? "bg-emerald-500" : "bg-gray-300"}`} />
                  <span>Автозапуск {card.settings.enabled ? "включён" : "выключен"}</span>
                </div>

                {/* Текущая выгрузка / последняя */}
                {activeRun ? (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      <span className="font-medium text-blue-900">Идёт выгрузка</span>
                      <span className="text-xs text-blue-700">этап: {activeRun.phase || "—"}</span>
                    </div>
                  </div>
                ) : lastRun ? (
                  <div className="mt-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Последний запуск:</span>
                      <span>{fmtDate(lastRun.finished_at || lastRun.started_at)}</span>
                      {runStatusBadge(lastRun.status)}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-400 italic flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    Ещё не запускалось
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {cards.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          Нет данных. Проверьте что миграция БД прошла.
        </div>
      )}
    </div>
  )
}
