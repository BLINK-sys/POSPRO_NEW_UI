"use client"

/**
 * Пикер клиента с СЕРВЕРНЫМ поиском и бесконечным скроллом.
 *
 * При 29k контактах клиентский фильтр нереален — всё грузим страницами
 * по 50 через `/api/kp-clients?q=…&limit=50&offset=N`. Серверный поиск
 * `q` ищет по ФИО, объекту, телефонам и email в JSONB `contacts`.
 *
 * Props `clients` — legacy, остаётся для back-compat (если родитель
 * хочет исключить какие-то id, передаёт их через `excludeIds`); если
 * передан — используется как первая страница пока сервер не ответил.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Loader2, Search, X, Check, Plus } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { crmGet } from "@/lib/crm-fetch"


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
  /** Legacy: предзагруженный список (использовался при маленьких объёмах).
   *  Сейчас игнорируется — поиск идёт на сервер. */
  clients?: ClientPickerItem[]
  value: number | null
  onChange: (id: number | null) => void
  allowClear?: boolean
  title?: string
  onCreateNew?: () => void
  /** Исключить эти id из результатов (чтобы напр. не предлагать уже
   *  выбранного primary при добавлении доп. контактов). */
  excludeIds?: number[]
}

const PAGE_SIZE = 50
const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 focus:!outline-none focus-visible:!outline-none"


function pickPhone(c: ClientPickerItem): string {
  for (const x of c.contacts || []) {
    const p = (x.phone || "").trim()
    if (p) return p
  }
  return ""
}


export default function ClientPickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
  allowClear = true,
  title = "Выбрать клиента",
  onCreateNew,
  excludeIds,
}: Props) {
  const [query, setQuery] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [rows, setRows] = useState<ClientPickerItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const excludeSet = new Set(excludeIds || [])

  // Reset при открытии / закрытии.
  useEffect(() => {
    if (open) {
      setQuery("")
      setDebouncedQ("")
      setRows([])
      setTotal(0)
      setOffset(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounce запроса 300ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Fetch первой страницы при смене поиска (или первом открытии).
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const p = new URLSearchParams()
    if (debouncedQ) p.set("q", debouncedQ)
    p.set("limit", String(PAGE_SIZE))
    p.set("offset", "0")
    crmGet<{ clients: ClientPickerItem[]; total: number }>(
      `/api/kp-clients?${p.toString()}`,
    )
      .then((r) => {
        setRows(r.clients || [])
        setTotal(r.total ?? 0)
        setOffset(r.clients?.length ?? 0)
        // Скроллим список к началу при новом поиске.
        if (bodyRef.current) bodyRef.current.scrollTop = 0
      })
      .catch(() => {
        setRows([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [open, debouncedQ])

  // Lazy-load следующей страницы при скролле в конец.
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || rows.length >= total) return
    setLoadingMore(true)
    try {
      const p = new URLSearchParams()
      if (debouncedQ) p.set("q", debouncedQ)
      p.set("limit", String(PAGE_SIZE))
      p.set("offset", String(offset))
      const r = await crmGet<{ clients: ClientPickerItem[] }>(
        `/api/kp-clients?${p.toString()}`,
      )
      const extra = r.clients || []
      setRows((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...extra.filter((x) => !seen.has(x.id))]
      })
      setOffset((o) => o + extra.length)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, loading, rows.length, total, debouncedQ, offset])

  const handleScroll = () => {
    const el = bodyRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (nearBottom) loadMore()
  }

  const handlePick = (id: number) => {
    onChange(id)
    onOpenChange(false)
  }
  const handleClear = () => {
    onChange(null)
    onOpenChange(false)
  }

  const visibleRows = excludeSet.size
    ? rows.filter((r) => !excludeSet.has(r.id))
    : rows

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

          {/* Поиск + «Создать» */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по ФИО / телефону / email / объекту"
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
              {onCreateNew && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false)
                    onCreateNew()
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 h-10 px-3 rounded-md text-sm font-medium shrink-0",
                    "bg-brand-yellow text-black hover:bg-yellow-500",
                    NO_RING,
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Создать
                </button>
              )}
            </div>
            <div className="mt-1.5 text-[11px] text-gray-500">
              {loading ? "Загрузка…" : (
                total > 0 ? (
                  <>Найдено: <b>{total}</b> · показано {Math.min(visibleRows.length, total)}</>
                ) : "—"
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

          {/* Тело таблицы — скроллится, lazy-load по скроллу. */}
          <div
            ref={bodyRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            {loading && visibleRows.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-10">
                Клиенты не найдены
              </div>
            ) : (
              <ul>
                {visibleRows.map((c) => {
                  const selected = c.id === value
                  const name = c.full_name || c.display_name || "—"
                  const phone = pickPhone(c)
                  const obj = (c.object || "").trim()
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(c.id)}
                        className={cn(
                          "w-full text-left grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_24px] gap-3",
                          "px-4 py-2 transition-colors items-center border-b border-gray-50",
                          selected ? "bg-brand-yellow/25" : "hover:bg-gray-50",
                          NO_RING,
                        )}
                      >
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className={cn(
                          "text-sm truncate tabular-nums",
                          phone ? "text-gray-700" : "text-gray-400 italic",
                        )}>
                          {phone || "—"}
                        </div>
                        <div className={cn(
                          "text-sm truncate",
                          obj ? "text-gray-700" : "text-gray-400 italic",
                        )}>
                          {obj || "—"}
                        </div>
                        <div>
                          {selected && <Check className="h-4 w-4 text-emerald-600" />}
                        </div>
                      </button>
                    </li>
                  )
                })}
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
                {!loadingMore && visibleRows.length < total && (
                  <div className="text-center py-2 text-[11px] text-gray-400">
                    прокрутите вниз чтобы загрузить ещё
                  </div>
                )}
              </ul>
            )}
          </div>

          {allowClear && value != null && (
            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className={cn("w-full text-gray-500 hover:text-gray-900", NO_RING)}
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
