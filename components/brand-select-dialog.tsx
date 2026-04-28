"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Check } from "lucide-react"
import type { Brand } from "@/app/actions/meta"

interface BrandSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brands: Brand[]
  selectedBrandId: number | null
  onSelect: (brandId: number | null) => void
  title?: string
}

export function BrandSelectDialog({
  open,
  onOpenChange,
  brands,
  selectedBrandId,
  onSelect,
  title = "Выберите бренд",
}: BrandSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [tempSelectedId, setTempSelectedId] = useState<number | null>(selectedBrandId)

  // Reset temp selection + search when the dialog reopens
  useEffect(() => {
    if (open) {
      setTempSelectedId(selectedBrandId)
      setSearchTerm("")
    }
  }, [open, selectedBrandId])

  const filteredBrands = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name))
    if (!term) return sorted
    return sorted.filter((b) => b.name.toLowerCase().includes(term))
  }, [brands, searchTerm])

  const handleConfirm = () => {
    onSelect(tempSelectedId)
    onOpenChange(false)
  }

  const handleClear = () => {
    setTempSelectedId(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск по названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-[360px] rounded-md border">
            <div className="p-1">
              <button
                type="button"
                onClick={() => setTempSelectedId(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  tempSelectedId === null ? "bg-brand-yellow/20 text-black" : "hover:bg-gray-100"
                }`}
              >
                <span className="text-gray-500">Без бренда</span>
                {tempSelectedId === null && <Check className="h-4 w-4 text-brand-yellow" />}
              </button>

              {filteredBrands.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-400">
                  {searchTerm ? "Ничего не найдено" : "Список брендов пуст"}
                </p>
              ) : (
                filteredBrands.map((b) => {
                  const selected = tempSelectedId === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setTempSelectedId(b.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${
                        selected ? "bg-brand-yellow/20 text-black" : "hover:bg-gray-100"
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {selected && <Check className="h-4 w-4 text-brand-yellow flex-shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button type="button" variant="ghost" onClick={handleClear} disabled={tempSelectedId === null}>
            Сбросить выбор
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Применить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
