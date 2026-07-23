"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { listIntegrations, type IntegrationCard } from "@/app/actions/integrations"
import { CheckCircle2, XCircle, Loader2, Play, ArrowRight } from "lucide-react"

const TYPE_LABELS: Record<string, string> = {
  bio: "BIO — bioshop.ru",
  equip: "Equip — equip.me",
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  bio: "Автоматическая выгрузка товаров с bioshop.ru. Работает на локальном сервере, шлёт данные в магазин по расписанию.",
  equip: "Автоматическая выгрузка товаров с equip.me. Синхронизация складов Москва + Алматы.",
}

// Как часто дёргать список с сервера. 10 сек — компромисс между свежестью
// online-статуса и нагрузкой на API (страница обычно открыта на 1-2 минуты
// пока админ смотрит, потом уходит в детальную с SSE).
const REFRESH_INTERVAL_MS = 10_000

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
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

export default function IntegrationsListClient({ initial }: { initial: IntegrationCard[] }) {
  const [cards, setCards] = useState(initial)

  useEffect(() => {
    let stopped = false
    const tick = async () => {
      try {
        const fresh = await listIntegrations()
        if (!stopped && fresh.length > 0) setCards(fresh)
      } catch (e) {
        // Тихо игнорируем — карточки останутся с последним успешным snapshot.
      }
    }
    const id = setInterval(tick, REFRESH_INTERVAL_MS)
    return () => { stopped = true; clearInterval(id) }
  }, [])

  return (
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

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className={`w-2 h-2 rounded-full ${card.settings.enabled ? "bg-emerald-500" : "bg-gray-300"}`} />
                <span>Автозапуск {card.settings.enabled ? "включён" : "выключен"}</span>
              </div>

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
  )
}
