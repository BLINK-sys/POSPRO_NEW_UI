"use client"

/**
 * Плавающая кнопка справа-снизу для свёрнутого окна массового пересчёта.
 * Видна только если контекст в режиме `isMinimized`. Цвет зависит от того,
 * все ли склады закончили: жёлтый (в процессе) или зелёный пульсирующий (готово).
 *
 * Кнопка fixed-positioned и рендерится в root layout, поэтому видна при
 * любых переходах между страницами.
 */

import React from "react"
import { useBulkRecalc } from "@/context/bulk-recalc-context"
import { RefreshCw, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function BulkRecalcFloatingButton() {
  const { isMinimized, allDone, totalCount, completedCount, openModal } = useBulkRecalc()

  if (!isMinimized || totalCount === 0) return null

  return (
    <button
      onClick={openModal}
      title={
        allDone
          ? "Массовый пересчёт завершён — открыть итоги"
          : "Массовый пересчёт идёт — открыть прогресс"
      }
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full font-medium text-sm",
        "shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.20)] transition-shadow",
        allDone
          ? "bg-green-500 text-white animate-pulse"
          : "bg-brand-yellow text-black",
      )}
    >
      {allDone ? (
        <Check className="h-4 w-4" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <span>
        {allDone ? "Пересчёт завершён" : "Пересчёт идёт"}
      </span>
      <span
        className={cn(
          "ml-1 px-2 py-0.5 rounded-full text-xs font-semibold",
          allDone ? "bg-white/30" : "bg-black/10",
        )}
      >
        {completedCount}/{totalCount}
      </span>
      <RefreshCw className="h-3.5 w-3.5 opacity-60 ml-1" />
    </button>
  )
}
