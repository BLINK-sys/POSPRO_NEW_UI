"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"
import { type Category } from "@/app/actions/categories"
import { CategoryTreeSelector } from "./category-tree-selector"

interface ParentCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  selectedCategoryId: number | null
  onSelect: (categoryId: number | null) => void
  excludeCategoryId?: number | null
  title?: string
}

export function ParentCategoryDialog({
  open,
  onOpenChange,
  categories,
  selectedCategoryId,
  onSelect,
  excludeCategoryId,
  title = "Выберите родительскую категорию"
}: ParentCategoryDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [tempSelectedId, setTempSelectedId] = useState<number | null>(selectedCategoryId)

  // Фильтрация категорий по поиску
  const filterCategories = (cats: Category[], term: string): Category[] => {
    if (!term) return cats
    
    return cats.reduce((filtered: Category[], cat) => {
      const matchesSearch = cat.name.toLowerCase().includes(term.toLowerCase())
      const children = cat.children ? filterCategories(cat.children, term) : []
      
      if (matchesSearch || children.length > 0) {
        filtered.push({
          ...cat,
          children: children.length > 0 ? children : cat.children
        })
      }
      
      return filtered
    }, [])
  }

  const filteredCategories = filterCategories(categories, searchTerm)

  const handleConfirm = () => {
    onSelect(tempSelectedId)
    onOpenChange(false)
    setSearchTerm("")
  }

  const handleCancel = () => {
    setTempSelectedId(selectedCategoryId)
    setSearchTerm("")
    onOpenChange(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTempSelectedId(selectedCategoryId)
      setSearchTerm("")
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Поиск */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Поиск категорий..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Дерево категорий */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <CategoryTreeSelector
                categories={filteredCategories}
                selectedCategoryId={tempSelectedId}
                onSelect={setTempSelectedId}
                excludeCategoryId={excludeCategoryId}
              />
            </ScrollArea>
          </div>

          {/* Информация о выбранной категории */}
          {tempSelectedId !== null && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md flex-shrink-0">
              <Label className="text-sm font-medium">Выбрано:</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(() => {
                  const findCategory = (cats: Category[], id: number): Category | null => {
                    for (const cat of cats) {
                      if (cat.id === id) return cat
                      if (cat.children) {
                        const found = findCategory(cat.children, id)
                        if (found) return found
                      }
                    }
                    return null
                  }
                  const selected = findCategory(categories, tempSelectedId)
                  return selected ? selected.name : "Категория не найдена"
                })()}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleCancel}>
            Отмена
          </Button>
          <Button onClick={handleConfirm}>
            Выбрать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 