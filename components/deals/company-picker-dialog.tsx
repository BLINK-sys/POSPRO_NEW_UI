"use client"

/**
 * Пикер компании с серверным поиском и бесконечным скроллом.
 * /api/admin/kp-companies поддерживает q/limit/offset/total.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Building2, Check, Loader2, Plus, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { crmGet } from "@/lib/crm-fetch"


export interface CompanyPickerItem {
  id: number
  name: string
  bin?: string | null
  phone?: string | null
  email?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  value: number | null
  onChange: (id: number | null) => void
  allowClear?: boolean
  title?: string
  onCreateNew?: () => void
}

const PAGE_SIZE = 50
const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 focus:!outline-none focus-visible:!outline-none"


export default function CompanyPickerDialog({
  open, onOpenChange, value, onChange,
  allowClear = true, title = "Выбрать компанию", onCreateNew,
}: Props) {
  const [query, setQuery] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [rows, setRows] = useState<CompanyPickerItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const p = new URLSearchParams()
    if (debouncedQ) p.set("q", debouncedQ)
    p.set("limit", String(PAGE_SIZE))
    p.set("offset", "0")
    crmGet<{ companies: CompanyPickerItem[]; total: number }>(
      `/api/admin/kp-companies?${p.toString()}`,
    )
      .then((r) => {
        setRows(r.companies || [])
        setTotal(r.total ?? 0)
        setOffset(r.companies?.length ?? 0)
        if (bodyRef.current) bodyRef.current.scrollTop = 0
      })
      .catch(() => {
        setRows([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [open, debouncedQ])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || rows.length >= total) return
    setLoadingMore(true)
    try {
      const p = new URLSearchParams()
      if (debouncedQ) p.set("q", debouncedQ)
      p.set("limit", String(PAGE_SIZE))
      p.set("offset", String(offset))
      const r = await crmGet<{ companies: CompanyPickerItem[] }>(
        `/api/admin/kp-companies?${p.toString()}`,
      )
      const extra = r.companies || []
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
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) loadMore()
  }

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
            "w-[92vw] max-w-[720px] h-[80vh]",
            "rounded-xl border border-gray-200 bg-white",
            "shadow-[0_20px_50px_rgba(0,0,0,0.20)]",
            "flex flex-col overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
          )}
        >
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

          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по названию / БИН / телефону / email"
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
                  <>Найдено: <b>{total}</b> · показано {Math.min(rows.length, total)}</>
                ) : "—"
              )}
            </div>
          </div>

          <div
            ref={bodyRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-10">
                Компании не найдены
              </div>
            ) : (
              <ul>
                {rows.map((c) => {
                  const selected = c.id === value
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(c.id)}
                        className={cn(
                          "w-full text-left px-4 py-2 border-b border-gray-50 flex items-center gap-3",
                          selected ? "bg-brand-yellow/25" : "hover:bg-gray-50",
                          NO_RING,
                        )}
                      >
                        <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          {(c.bin || c.phone) && (
                            <div className="text-xs text-gray-500 truncate">
                              {c.bin ? `БИН ${c.bin}` : ""}
                              {c.bin && c.phone ? " · " : ""}
                              {c.phone || ""}
                            </div>
                          )}
                        </div>
                        {selected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                      </button>
                    </li>
                  )
                })}
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
                {!loadingMore && rows.length < total && (
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
