"use client"

/**
 * Пикер клиента с табличным представлением (ФИО / Телефон / Объект).
 *
 * По устройству дублирует EntityPickerDialog (тот же Radix Dialog без
 * overlay, тот же размер, поиск, hover-подсветка), но вместо
 * одноколонного списка рендерит таблицу — по клиентам обычно
 * нужны сразу телефон и объект, иначе не отличишь двух «Айнур».
 *
 * Поле `contacts` — JSONB-массив `[{phone, note}]`. Показываем первый
 * непустой phone.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Search, X, Check } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ClientPickerItem {
  id: number
  full_name?: string | null
  object?: string | null
  contacts?: { phone?: string; note?: string }[]
  display_name?: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  clients: ClientPickerItem[]
  value: number | null
  onChange: (id: number | null) => void
  allowClear?: boolean
  title?: string
}

const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 focus:!outline-none focus-visible:!outline-none"

export default function ClientPickerDialog({
  open,
  onOpenChange,
  clients,
  value,
  onChange,
  allowClear = true,
  title = "Выбрать клиента",
}: Props) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Предвычисляем плоские поля для поиска и рендера. Так фильтр не
  // ходит в contacts на каждом keystroke.
  const rows = useMemo(() => {
    return clients.map((c) => {
      const phone = (c.contacts || [])
        .map((x) => (x.phone || "").trim())
        .find((p) => p) || ""
      return {
        id: c.id,
        name: c.full_name || c.display_name || "—",
        phone,
        object: (c.object || "").trim(),
      }
    })
  }, [clients])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.object.toLowerCase().includes(q),
    )
  }, [rows, query])

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
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-[92vw] max-w-[820px] h-[80vh]",
            "rounded-xl border border-gray-200 bg-white",
            "shadow-[0_20px_50px_rgba(0,0,0,0.20)]",
            "flex flex-col overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Header */}
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
                placeholder="Поиск по ФИО / телефону / объекту"
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
          </div>

          {/* Заголовок таблицы */}
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_24px] gap-3 px-4 py-2 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500 shrink-0">
            <div>ФИО</div>
            <div>Телефон</div>
            <div>Объект</div>
            <div></div>
          </div>

          {/* Тело таблицы */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-10">
                Клиенты не найдены
              </div>
            ) : (
              <ul>
                {filtered.map((r) => {
                  const selected = r.id === value
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(r.id)}
                        className={cn(
                          "w-full text-left grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_24px] gap-3",
                          "px-4 py-2 transition-colors items-center border-b border-gray-50",
                          selected
                            ? "bg-brand-yellow/25"
                            : "hover:bg-gray-50",
                          NO_RING,
                        )}
                      >
                        <div className="text-sm font-medium truncate">
                          {r.name}
                        </div>
                        <div className={cn(
                          "text-sm truncate tabular-nums",
                          r.phone ? "text-gray-700" : "text-gray-400 italic",
                        )}>
                          {r.phone || "—"}
                        </div>
                        <div className={cn(
                          "text-sm truncate",
                          r.object ? "text-gray-700" : "text-gray-400 italic",
                        )}>
                          {r.object || "—"}
                        </div>
                        <div>
                          {selected && (
                            <Check className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
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
                Убрать выбор
              </Button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
