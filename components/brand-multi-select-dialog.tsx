"use client"

/**
 * Multi-select клон `BrandSelectDialog` (используется для фильтра в админке
 * товаров — но там single-select). Визуально матчится один-в-один:
 *  - Поиск по названию
 *  - ScrollArea со списком кнопок-чекбоксов
 *  - Футер: «Сбросить выбор» + «Отмена» + «Применить»
 *
 * При confirm возвращает новый массив выбранных id (включая уже бывшие
 * выбранными и вновь добавленные / убранные).
 */

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Building2 } from "lucide-react"
import type { Brand } from "@/app/actions/meta"
import { getImageUrl } from "@/lib/image-utils"

interface BrandMultiSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brands: Brand[]
  selectedBrandIds: number[]
  onConfirm: (ids: number[]) => void
  title?: string
}

export function BrandMultiSelectDialog({
  open,
  onOpenChange,
  brands,
  selectedBrandIds,
  onConfirm,
  title = "Выберите бренды",
}: BrandMultiSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [tempIds, setTempIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (open) {
      setTempIds(new Set(selectedBrandIds))
      setSearchTerm("")
    }
  }, [open, selectedBrandIds])

  const filteredBrands = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name))
    if (!term) return sorted
    return sorted.filter((b) => b.name.toLowerCase().includes(term))
  }, [brands, searchTerm])

  const toggle = (id: number) => {
    setTempIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    // Сохраняем порядок: сначала ранее бывшие в списке (в их прежнем порядке),
    // потом новые добавленные. На реордер у админа отдельные стрелки наверху.
    const ordered: number[] = []
    for (const id of selectedBrandIds) {
      if (tempIds.has(id)) ordered.push(id)
    }
    for (const id of tempIds) {
      if (!ordered.includes(id)) ordered.push(id)
    }
    onConfirm(ordered)
    onOpenChange(false)
  }

  const handleClear = () => setTempIds(new Set())

  // Карта id -> name для правой колонки
  const brandsById = useMemo(() => {
    const m = new Map<number, Brand>()
    for (const b of brands) m.set(b.id, b)
    return m
  }, [brands])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Двухколоночный layout: слева поиск+список, справа выбранные */}
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">

            {/* Левая колонка */}
            <div className="flex flex-col min-h-0 space-y-3">
              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Поиск по названию..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  autoFocus
                />
              </div>

              <div className="flex-1 min-h-0 border rounded-md">
                <ScrollArea className="h-full">
                  <div className="p-1 space-y-1">
                    {filteredBrands.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-gray-400">
                        {searchTerm ? "Ничего не найдено" : "Список брендов пуст"}
                      </p>
                    ) : (
                      filteredBrands.map((b) => {
                        const selected = tempIds.has(b.id)
                        return (
                          <div
                            key={b.id}
                            onClick={() => toggle(b.id)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                              selected ? "bg-brand-yellow/20" : "hover:bg-gray-100"
                            }`}
                          >
                            {/* stopPropagation — чтобы клик по чекбоксу
                                не дублировался с кликом по строке (раньше
                                tot toggle×2 = без эффекта). */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggle(b.id)}
                              />
                            </div>
                            <div className="relative h-10 w-10 rounded overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                              {b.image_url ? (
                                <Image
                                  src={getImageUrl(b.image_url)}
                                  alt={b.name}
                                  fill
                                  className="object-contain p-1"
                                  sizes="40px"
                                />
                              ) : (
                                <Building2 className="h-5 w-5 text-gray-300" />
                              )}
                            </div>
                            <span className="flex-1 text-sm truncate">{b.name}</span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Правая колонка — выбранные */}
            <div className="flex flex-col min-h-0 border rounded-md">
              <div className="flex-shrink-0 px-3 py-2 border-b bg-gray-50/60">
                <h4 className="text-sm font-semibold text-gray-700">
                  Выбрано <span className="text-gray-500">({tempIds.size})</span>
                </h4>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                {tempIds.size === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-gray-400">
                    Ничего не выбрано
                  </p>
                ) : (
                  <ul className="p-1 space-y-1">
                    {Array.from(tempIds).map((id) => {
                      const brand = brandsById.get(id)
                      if (!brand) return null
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 group"
                        >
                          <span className="flex-1 text-sm truncate">{brand.name}</span>
                          <button
                            type="button"
                            onClick={() => toggle(id)}
                            className="text-gray-400 hover:text-red-500 transition-colors opacity-60 group-hover:opacity-100"
                            title="Убрать"
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 flex-shrink-0 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={handleClear} disabled={tempIds.size === 0}>
            Сбросить выбор
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
            >
              Применить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
