"use client"

/**
 * Универсальная пикер-модалка «выбери один элемент из списка с поиском».
 *
 * Использует Radix Dialog НАПРЯМУЮ (без shadcn-обёртки DialogOverlay) —
 * это отключает затемнение фона. Клик снаружи и Esc закрывают как
 * обычно (Radix обрабатывает их на уровне Content).
 *
 * Ширина ~640px, высота фиксированная 80vh, список внутри — flex-1 с
 * overflow-y-auto.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Search, X, Check } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PickerItem {
  id: number
  primary: string
  secondary?: string
  badge?: string
  /**
   * Опциональные Tailwind-классы для бейджа (bg + text). Если не задан
   * — использует нейтральный серый. Пример: "bg-emerald-100 text-emerald-700".
   */
  badgeClassName?: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  items: PickerItem[]
  value: number | null
  onChange: (id: number | null) => void
  searchPlaceholder?: string
  emptyText?: string
  allowClear?: boolean
  clearText?: string
  /**
   * Опциональная панель фильтров, встраивается под поиском. Родитель
   * сам решает что там (checkbox «только мои», radio-переключатель и
   * т.п.) — пикер про эти фильтры ничего не знает и не изменяет
   * `items` — их формирует родитель после соответствующего запроса.
   */
  toolbar?: React.ReactNode
}

// Убираем ВСЕ focus-подсветки (и focus:, и focus-visible:, и outline).
const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 focus:!outline-none focus-visible:!outline-none"

export default function EntityPickerDialog({
  open,
  onOpenChange,
  title,
  items,
  value,
  onChange,
  searchPlaceholder = "Поиск…",
  emptyText = "Ничего не найдено",
  allowClear = true,
  clearText = "Убрать выбор",
  toolbar,
}: Props) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const p = it.primary.toLowerCase()
      const s = (it.secondary || "").toLowerCase()
      return p.includes(q) || s.includes(q)
    })
  }, [items, query])

  const handlePick = (id: number) => {
    onChange(id)
    onOpenChange(false)
  }
  const handleClear = () => {
    onChange(null)
    onOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* НЕТ DialogOverlay — фон не затемняется. */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-[92vw] max-w-[640px] h-[80vh]",
            "rounded-xl border border-gray-200 bg-white",
            "shadow-[0_20px_50px_rgba(0,0,0,0.20)]",
            "flex flex-col overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Header — заголовок + close */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <DialogPrimitive.Title className="text-base font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100",
                NO_RING,
              )}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Поиск */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn("pl-9 pr-9", NO_RING)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded",
                    NO_RING,
                  )}
                  aria-label="Очистить"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {toolbar && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {toolbar}
              </div>
            )}
          </div>

          {/* Список — растягивается, скроллится при переполнении */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
            {filtered.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-10">
                {emptyText}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((it) => {
                  const selected = it.id === value
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(it.id)}
                        className={cn(
                          "w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 transition-colors",
                          selected
                            ? "bg-brand-yellow/25 border border-brand-yellow"
                            : "hover:bg-gray-100 border border-transparent",
                          NO_RING,
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {it.primary}
                          </div>
                          {it.secondary && (
                            <div className="text-xs text-gray-500 truncate">
                              {it.secondary}
                            </div>
                          )}
                        </div>
                        {it.badge && (
                          <span
                            className={cn(
                              "text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0",
                              it.badgeClassName || "bg-gray-100 text-gray-600",
                            )}
                          >
                            {it.badge}
                          </span>
                        )}
                        {selected && (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {allowClear && value != null && (
            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className={cn(
                  "w-full text-gray-500 hover:text-gray-900",
                  NO_RING,
                )}
              >
                {clearText}
              </Button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
