"use client"

/**
 * Пейджер для таблиц: `‹ 1 2 3 … 42 ›` + селектор размера страницы.
 * Используется в задачах, контактах, компаниях — общая UI-логика.
 */

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  sizes: readonly number[]
}

export function TablePager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sizes,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  const pages = computePageList(current, totalPages)

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <span>Показано {from}–{to} из {total}</span>
        <span className="text-gray-300">·</span>
        <span>На странице:</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(parseInt(v, 10))}
        >
          <SelectTrigger className="h-8 w-[72px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((s) => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-2 text-gray-400 select-none">…</span>
          ) : (
            <Button
              key={p}
              variant={p === current ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 min-w-8 px-2 rounded-lg tabular-nums",
                p === current
                  ? "bg-brand-yellow text-black hover:bg-yellow-500"
                  : "text-gray-700",
              )}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          aria-label="Следующая страница"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function computePageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: (number | "…")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push("…")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push("…")
  items.push(total)
  return items
}
