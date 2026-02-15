"use client"

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X } from "lucide-react"

interface FilterOption {
  value: string
  label: string
}

interface MobileFilterSheetProps {
  open: boolean
  onClose: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
  brands?: FilterOption[]
  selectedBrand?: string
  onBrandChange?: (value: string) => void
  sortOptions?: FilterOption[]
  selectedSort?: string
  onSortChange?: (value: string) => void
  onApply: () => void
  onReset: () => void
}

export default function MobileFilterSheet({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  brands,
  selectedBrand,
  onBrandChange,
  sortOptions,
  selectedSort,
  onSortChange,
  onApply,
  onReset,
}: MobileFilterSheetProps) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Фильтры</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 space-y-4 overflow-y-auto flex-1">
          {/* Поиск */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Название товара..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-10 rounded-lg"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => onSearchChange("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Бренд */}
          {brands && brands.length > 0 && onBrandChange && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Бренд</label>
              <Select value={selectedBrand || "all"} onValueChange={onBrandChange}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Все бренды" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все бренды</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.value} value={brand.value}>
                      {brand.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Сортировка */}
          {sortOptions && sortOptions.length > 0 && onSortChange && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Сортировка</label>
              <Select value={selectedSort || "default"} onValueChange={onSortChange}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="По умолчанию" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-3">
          <Button variant="outline" className="flex-1" onClick={onReset}>
            Сбросить
          </Button>
          <Button className="flex-1 bg-brand-yellow text-black hover:bg-yellow-500" onClick={() => { onApply(); onClose() }}>
            Применить
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
