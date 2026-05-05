"use client"

/**
 * BulkRecalcDialog — модалка массового пересчёта складов.
 *
 * Состоит из двух фаз:
 *  1. Selection — две колонки (поставщик / склады с чекбоксами), multi-select.
 *     Доступна только когда контекст idle (нет активного пересчёта).
 *  2. Progress — сетка карточек по одной на каждый выбранный склад,
 *     обновляется через polling в `BulkRecalcContext`. Доступна когда
 *     контекст running или done.
 *
 * Состояние пересчёта живёт в глобальном контексте, поэтому модалку можно
 * сворачивать (плавающая кнопка) и переоткрывать с любой страницы — данные
 * не теряются.
 */

import React, { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  type Warehouse,
  type RecalculateData,
  getWarehouses,
} from "@/app/actions/warehouses"
import { useBulkRecalc } from "@/context/bulk-recalc-context"
import { Loader2, RefreshCw, Check, AlertCircle, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"


export function BulkRecalcDialog() {
  const ctx = useBulkRecalc()
  // Открытость управляется контекстом — модалка глобальная (рендерится в
  // root layout), поэтому при клике на floating-кнопку или на «Массовый
  // пересчёт» в списке складов вызывается ctx.openModal() и диалог
  // открывается с любой страницы.
  const dialogOpen = ctx.isModalOpen

  // Локальное состояние для фазы selection
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Если контекст уже что-то пересчитывает — показываем фазу прогресса.
  // Иначе — фазу выбора.
  const showProgress = ctx.phase === "running" || ctx.phase === "done"

  // Сбрасываем локальный selection-state при каждом открытии в фазе selection
  useEffect(() => {
    if (!dialogOpen || showProgress) return
    setSelectedSupplier(null)
    setSelectedIds(new Set())
    setLoadingList(true)
    getWarehouses()
      .then(setWarehouses)
      .finally(() => setLoadingList(false))
  }, [dialogOpen, showProgress])

  // Группировка складов по поставщикам
  const suppliers = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>()
    for (const w of warehouses) {
      const sid = w.supplier_id
      const existing = map.get(sid)
      if (existing) {
        existing.count += 1
      } else {
        map.set(sid, {
          id: sid,
          name: w.supplier_name || `Поставщик #${sid}`,
          count: 1,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"))
  }, [warehouses])

  const supplierWarehouses = useMemo(
    () =>
      selectedSupplier
        ? warehouses
            .filter((w) => w.supplier_id === selectedSupplier)
            .sort((a, b) => a.name.localeCompare(b.name, "ru"))
        : [],
    [warehouses, selectedSupplier],
  )

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllForSupplier = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = supplierWarehouses.every((w) => next.has(w.id))
      if (allSelected) {
        for (const w of supplierWarehouses) next.delete(w.id)
      } else {
        for (const w of supplierWarehouses) next.add(w.id)
      }
      return next
    })
  }

  const selectAllWarehouses = () => {
    setSelectedIds(new Set(warehouses.map((w) => w.id)))
  }

  const clearAllSelected = () => {
    setSelectedIds(new Set())
  }

  const handleStart = async () => {
    if (selectedIds.size === 0) return
    const selected = warehouses.filter((w) => selectedIds.has(w.id))
    // ctx.start сразу выставляет isModalOpen=true и переводит phase в running.
    // Диалог автоматически переключится на progress phase.
    await ctx.start(selected)
  }

  // Закрытие диалога:
  //  - Selection-фаза (нет активного пересчёта) — просто закрываем
  //  - Progress-фаза (есть пересчёт, юзер закрыл через X / Escape) —
  //    dismiss(): треды на сервере доработают, но кнопка-кружок не появится.
  //    «Свернуть» — отдельная кнопка, которая ставит isMinimized=true.
  const handleClose = () => {
    if (showProgress) {
      ctx.dismiss()
    } else {
      // selection-фаза — просто скрыть диалог через контекст
      ctx.dismiss()
    }
  }

  const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return "—"
    try {
      return new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })
    } catch {
      return iso
    }
  }

  const handleMinimize = () => {
    ctx.minimize()
  }

  const handleOk = () => {
    ctx.dismiss()
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-brand-yellow" />
            Массовый пересчёт складов
          </DialogTitle>
          {!showProgress ? (
            <p className="text-sm text-gray-500">
              Выберите один или несколько складов. На каждом запустится отдельный
              пересчёт всех товаров (аналогично кнопке «Пересчитать всё» внутри
              склада). Прогресс будет показан в сетке карточек.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              {ctx.allDone ? (
                <>Все пересчёты завершены — {ctx.completedCount} склад(ов).</>
              ) : (
                <>
                  Пересчёт идёт на {ctx.totalCount} склад(ах). Прогресс
                  обновляется автоматически каждые 2 секунды. Можно свернуть в
                  плавающую кнопку и продолжить работу — пересчёт останется
                  активным.
                </>
              )}
            </p>
          )}
        </DialogHeader>

        {/* ───────── Selection phase ───────── */}
        {!showProgress && (
          <>
            <div className="px-6 flex-1 min-h-0 overflow-hidden flex flex-col gap-3">
              {loadingList ? (
                <div className="flex items-center justify-center py-12 flex-1">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={selectAllWarehouses}
                      className="text-blue-600 hover:underline"
                    >
                      Выбрать все склады ({warehouses.length})
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      onClick={clearAllSelected}
                      className="text-gray-500 hover:underline"
                    >
                      Сбросить
                    </button>
                    <span className="ml-auto text-gray-500">
                      Выбрано: <strong>{selectedIds.size}</strong> / {warehouses.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                    <div className="border rounded-lg overflow-hidden flex flex-col">
                      <div className="px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-600">
                        Поставщик
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {suppliers.map((s) => {
                          const isActive = s.id === selectedSupplier
                          const selectedHere = warehouses
                            .filter((w) => w.supplier_id === s.id)
                            .filter((w) => selectedIds.has(w.id)).length
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSupplier(s.id)}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2",
                                isActive
                                  ? "bg-brand-yellow/20 text-black border-l-2 border-brand-yellow"
                                  : "hover:bg-gray-50 border-l-2 border-transparent",
                              )}
                            >
                              <span className="truncate">{s.name}</span>
                              <span className="text-xs text-gray-400 shrink-0">
                                {selectedHere > 0 && (
                                  <span className="text-blue-600 font-medium mr-1">
                                    {selectedHere}/
                                  </span>
                                )}
                                {s.count}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden flex flex-col">
                      <div className="px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-600 flex items-center justify-between">
                        <span>Склады</span>
                        {supplierWarehouses.length > 0 && (
                          <button
                            onClick={toggleAllForSupplier}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {supplierWarehouses.every((w) => selectedIds.has(w.id))
                              ? "Снять все"
                              : "Выбрать все"}
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {!selectedSupplier ? (
                          <p className="text-sm text-gray-400 text-center py-6">
                            Выберите поставщика слева
                          </p>
                        ) : (
                          supplierWarehouses.map((w) => {
                            const checked = selectedIds.has(w.id)
                            return (
                              <label
                                key={w.id}
                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleId(w.id)}
                                  className="h-4 w-4 accent-blue-600"
                                />
                                <span className="flex-1 truncate">{w.name}</span>
                                {w.city && (
                                  <span className="text-xs text-gray-400">{w.city}</span>
                                )}
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-white flex-shrink-0">
              <Button variant="outline" onClick={handleClose} className="rounded-lg">
                Отмена
              </Button>
              <Button
                onClick={handleStart}
                disabled={selectedIds.size === 0 || loadingList}
                className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Пересчитать ({selectedIds.size})
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ───────── Progress phase ───────── */}
        {showProgress && (
          <>
            <div className="px-6 flex-1 min-h-0 overflow-y-auto pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(ctx.warehouses).map((w) => {
                  const data = ctx.progress[w.id]
                  const startError = ctx.startErrors[w.id]
                  return (
                    <ProgressCard
                      key={w.id}
                      title={w.name}
                      subtitle={w.supplier_name}
                      data={data}
                      startError={startError}
                      fmtDate={fmtDate}
                    />
                  )
                })}
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-white flex-shrink-0">
              {!ctx.allDone && (
                <span className="mr-auto text-sm text-gray-500 self-center inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Опрос статусов каждые 2 сек ·{" "}
                  <strong className="text-gray-700">
                    {ctx.completedCount}/{ctx.totalCount}
                  </strong>
                </span>
              )}
              {ctx.allDone ? (
                <Button
                  onClick={handleOk}
                  className="rounded-lg bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1" />
                  ОК
                </Button>
              ) : (
                <Button
                  onClick={handleMinimize}
                  variant="outline"
                  className="rounded-lg"
                  title="Свернуть в плавающую кнопку — пересчёт продолжится в фоне"
                >
                  <Minimize2 className="h-4 w-4 mr-1" />
                  Свернуть
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}


function ProgressCard({
  title,
  subtitle,
  data,
  startError,
  fmtDate,
}: {
  title: string
  subtitle: string
  data: RecalculateData | null
  startError: string | undefined
  fmtDate: (iso: string | null | undefined) => string
}) {
  const statusBadge = (() => {
    if (startError) {
      return {
        label: "Не запустился",
        className: "bg-red-100 text-red-700 border-red-200",
        cardClass: "border-red-200",
        Icon: AlertCircle,
      }
    }
    if (!data) {
      return {
        label: "Запуск...",
        className: "bg-gray-100 text-gray-700 border-gray-200",
        cardClass: "border-gray-200",
        Icon: Loader2,
      }
    }
    switch (data.status) {
      case "running":
        return {
          label: "Выполняется",
          className: "bg-blue-100 text-blue-700 border-blue-200",
          cardClass: "border-blue-200",
          Icon: Loader2,
        }
      case "done":
        return {
          label: "Завершено",
          className: "bg-green-100 text-green-700 border-green-200",
          cardClass: "border-green-200",
          Icon: Check,
        }
      case "error":
        return {
          label: "Ошибка",
          className: "bg-red-100 text-red-700 border-red-200",
          cardClass: "border-red-200",
          Icon: AlertCircle,
        }
      default:
        return {
          label: data.status,
          className: "bg-gray-100 text-gray-700 border-gray-200",
          cardClass: "border-gray-200",
          Icon: Loader2,
        }
    }
  })()

  const Icon = statusBadge.Icon
  const isSpinning = !data || data.status === "running"

  const total = data?.total || 0
  const processed = data?.processed || 0
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0

  return (
    <Card
      className={cn(
        "rounded-xl p-3 border transition-shadow",
        // Лёгкая тень для ощущения «карточка приподнята», ярче на hover
        "shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.14)]",
        statusBadge.cardClass,
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{title}</div>
          <div className="text-xs text-gray-500 truncate">{subtitle}</div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0",
            statusBadge.className,
          )}
        >
          <Icon className={cn("h-3 w-3", isSpinning && "animate-spin")} />
          {statusBadge.label}
        </span>
      </div>

      {startError ? (
        <div className="text-xs text-red-700 bg-red-50 rounded p-2 break-words">
          {startError}
        </div>
      ) : data ? (
        <div className="space-y-1.5 text-[11px]">
          {total > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>{processed.toLocaleString("ru-RU")} / {total.toLocaleString("ru-RU")}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    data.status === "done" ? "bg-green-500" :
                    data.status === "error" ? "bg-red-500" : "bg-blue-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <Row label="Дата" value={fmtDate(data.finished_at || data.started_at)} />
          <Row
            label="Курс RUB"
            value={(() => {
              const r = (data as any).currency_rate
              return typeof r === "number" ? r.toFixed(2) : "—"
            })()}
          />
          <Row label="Всего товаров" value={total.toLocaleString("ru-RU")} />
          <Row
            label="Цена рассчитана"
            value={(data.price_calculated || 0).toLocaleString("ru-RU")}
            valueClass="text-green-700"
          />
          {data.has_delivery_formula && (
            <Row
              label="Доставка рассчитана"
              value={(data.delivery_calculated || 0).toLocaleString("ru-RU")}
              valueClass="text-blue-700"
            />
          )}
          {data.has_cost_formula && (
            <Row
              label="Себестоимость рассчитана"
              value={(data.cost_no_margin_calculated || 0).toLocaleString("ru-RU")}
              valueClass="text-purple-700"
            />
          )}
          {data.zero_price > 0 && (
            <Row
              label="Нулевая цена"
              value={data.zero_price.toLocaleString("ru-RU")}
              valueClass="text-orange-600"
            />
          )}
          {data.error_count > 0 && (
            <Row
              label="Ошибки"
              value={data.error_count.toLocaleString("ru-RU")}
              valueClass="text-red-600"
            />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
    </Card>
  )
}


function Row({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-gray-500">{label}:</span>
      <span className={cn("font-medium text-right truncate", valueClass)}>{value}</span>
    </div>
  )
}
