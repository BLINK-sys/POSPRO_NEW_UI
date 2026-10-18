"use client"

/**
 * Страница «Сделки по источникам» — /admin/deals/sources-stats.
 * Таблица по DealSource за период (1м/2м/3м/6м/12м/все):
 *   Источник / Всего / Открытые / Won / Lost / Сумма won / Средний чек / Конверсия
 * Клик по строке → переход в «Историю» с pre-фильтром source_id.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Briefcase, CalendarRange, Loader2, PieChart } from "lucide-react"

import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { crmGet } from "@/lib/crm-fetch"
import DateRangeDialog from "@/components/ui/date-range-dialog"
import DealsTabsHeader from "./deals-tabs-header"


const PERIODS = [
  { months: 1, label: "1 мес" },
  { months: 2, label: "2 мес" },
  { months: 3, label: "3 мес" },
  { months: 6, label: "6 мес" },
  { months: 12, label: "12 мес" },
  { months: 0, label: "Все" },
]

type SortKey = "total" | "open" | "won" | "lost" | "sum_won" | "conversion"


export default function DealsSourcesStats() {
  const router = useRouter()
  const { toast } = useToast()
  // period: число месяцев (preset) ИЛИ 'custom' для кастомного диапазона.
  const [months, setMonths] = useState<number>(3)
  const [customFrom, setCustomFrom] = useState<string | null>(null)
  const [customTo, setCustomTo] = useState<string | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [totals, setTotals] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("total")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    setLoading(true)
    const q = new URLSearchParams()
    if (isCustom && customFrom && customTo) {
      q.set("created_after", customFrom)
      q.set("created_before", customTo)
    } else if (months) {
      q.set("months", String(months))
    }
    crmGet<any>(`/api/admin/deals/sources-stats?${q.toString()}`)
      .then((r) => {
        setRows(r.rows || [])
        setTotals(r.totals || {})
      })
      .catch((e) =>
        toast({
          variant: "destructive",
          title: "Не удалось загрузить статистику",
          description: e?.message,
        }),
      )
      .finally(() => setLoading(false))
  }, [months, isCustom, customFrom, customTo, toast])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = (a[sortKey] ?? -1) as number
      const bv = (b[sortKey] ?? -1) as number
      return sortDir === "asc" ? av - bv : bv - av
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(k); setSortDir("desc") }
  }

  const formatMoney = (v: number) =>
    v ? new Intl.NumberFormat("ru-KZ", {
      style: "currency", currency: "KZT", maximumFractionDigits: 0,
    }).format(v) : "—"

  const sortIcon = (k: SortKey) => (
    sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""
  )

  const openHistory = (sourceId: number | null) => {
    const q = new URLSearchParams()
    if (sourceId == null) q.set("source", "none")
    else q.set("source", String(sourceId))
    // Передаём текущий период: history умеет period=1m/3m/6m/1y/all
    // (ровно те пресеты, что есть в source-stats), а для «2 мес» (которого
    // в history нет) и custom-диапазона — ISO-даты from/to.
    if (isCustom && customFrom && customTo) {
      q.set("from", customFrom)
      q.set("to", customTo)
    } else {
      const PERIOD_MAP: Record<number, string> = {
        1: "1m", 3: "3m", 6: "6m", 12: "1y", 0: "all",
      }
      const key = PERIOD_MAP[months]
      if (key) {
        q.set("period", key)
      } else if (months === 2) {
        // Для «2 мес» эмулируем через custom-диапазон (period 2m в history нет).
        const to = new Date()
        const from = new Date(to.getTime() - 60 * 24 * 3600 * 1000)
        q.set("from", from.toISOString())
        q.set("to", to.toISOString())
      }
    }
    router.push(`/admin/deals/history?${q.toString()}`)
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Шапка — табы сразу после заголовка, одинаково со всеми табами. */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
          <Briefcase className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold leading-tight">Сделки</h1>
        <DealsTabsHeader />
      </div>

      {/* Переключатель периода + кастомный диапазон */}
      <Card className="rounded-xl border-gray-200 p-3">
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.months}
              type="button"
              onClick={() => { setMonths(p.months); setIsCustom(false) }}
              className={cn(
                "px-3 h-7 text-xs rounded-md transition-colors",
                !isCustom && months === p.months
                  ? "bg-brand-yellow text-black font-medium"
                  : "text-gray-600 hover:bg-white",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            className={cn(
              "inline-flex items-center gap-1 px-3 h-7 text-xs rounded-md transition-colors",
              isCustom
                ? "bg-brand-yellow text-black font-medium"
                : "text-gray-600 hover:bg-white",
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {isCustom && customFrom && customTo
              ? `${new Date(customFrom).toLocaleDateString("ru-RU")} — ${new Date(customTo).toLocaleDateString("ru-RU")}`
              : "Период"}
          </button>
        </div>
      </Card>

      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        from={customFrom}
        to={customTo}
        onApply={(fromIso, toIso) => {
          setCustomFrom(fromIso)
          setCustomTo(toIso)
          setIsCustom(true)
        }}
      />

      {/* Таблица */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-16">
            Сделок за выбранный период нет
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-normal">
                    <PieChart className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                    Источник
                  </th>
                  <SortableTh k="total" current={sortKey} dir={sortDir} onToggle={toggleSort}>Всего</SortableTh>
                  <SortableTh k="open" current={sortKey} dir={sortDir} onToggle={toggleSort}>Открытые</SortableTh>
                  <SortableTh k="won" current={sortKey} dir={sortDir} onToggle={toggleSort}>Выиграно</SortableTh>
                  <SortableTh k="lost" current={sortKey} dir={sortDir} onToggle={toggleSort}>Проиграно</SortableTh>
                  <SortableTh k="sum_won" current={sortKey} dir={sortDir} onToggle={toggleSort}>Сумма won</SortableTh>
                  <th className="text-right px-3 py-2 font-normal">Средний чек</th>
                  <SortableTh k="conversion" current={sortKey} dir={sortDir} onToggle={toggleSort}>Конверсия</SortableTh>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr
                    key={`src-${r.source_id ?? "none"}`}
                    onClick={() => openHistory(r.source_id)}
                    className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                  >
                    <td className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {r.source_color && (
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-gray-200 shrink-0"
                            style={{ backgroundColor: r.source_color }}
                          />
                        )}
                        <span>{r.source_name}</span>
                      </span>
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums">{r.total}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-blue-600">{r.open}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-emerald-600">{r.won}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-red-600">{r.lost}</td>
                    <td className="text-right px-3 py-2 tabular-nums font-medium">{formatMoney(r.sum_won)}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-gray-700">{formatMoney(r.avg_check)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">
                      {r.conversion != null ? (
                        <span className={cn(
                          "font-semibold",
                          r.conversion >= 70 ? "text-emerald-600"
                            : r.conversion >= 40 ? "text-amber-600"
                            : "text-red-600"
                        )}>
                          {r.conversion.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Итого */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/50 font-medium">
                  <td className="px-3 py-2">Итого</td>
                  <td className="text-right px-3 py-2 tabular-nums">{totals.total || 0}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-blue-600">{totals.open || 0}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-emerald-600">{totals.won || 0}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-red-600">{totals.lost || 0}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{formatMoney(totals.sum_won || 0)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-gray-700">{formatMoney(totals.avg_check || 0)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">
                    {totals.conversion != null ? (
                      <span className="font-semibold">{totals.conversion.toFixed(0)}%</span>
                    ) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}


function SortableTh({
  k, current, dir, onToggle, children,
}: {
  k: SortKey
  current: SortKey
  dir: "asc" | "desc"
  onToggle: (k: SortKey) => void
  children: React.ReactNode
}) {
  const active = current === k
  return (
    <th
      className="text-right px-3 py-2 font-normal cursor-pointer hover:text-gray-700 select-none"
      onClick={() => onToggle(k)}
    >
      {children}
      {active && <span className="ml-0.5">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  )
}
