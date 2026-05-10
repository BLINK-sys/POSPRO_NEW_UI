"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, ChevronRight, ChevronDown, Tag } from "lucide-react"
import { getCatalogCategories } from "@/app/actions/public"
import { CategoryData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"
import { cn } from "@/lib/utils"

interface CategorySelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCategories: number[]
  onCategoriesChange: (categories: number[]) => void
  multiple?: boolean
}

interface CategoryTreeItemProps {
  category: CategoryData
  level: number
  selectedCategories: number[]
  onToggleCategory: (categoryId: number) => void
}

function CategoryTreeItem({ 
  category, 
  level, 
  selectedCategories, 
  onToggleCategory 
}: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = category.children && category.children.length > 0
  const isSelected = selectedCategories.includes(category.id)

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleSelect = () => {
    onToggleCategory(category.id)
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
          isSelected && "bg-blue-100 dark:bg-blue-900"
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
      >
        {/* Кнопка разворачивания */}
        <button
          onClick={handleToggle}
          className={cn(
            "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
            !hasChildren && "invisible"
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          )}
        </button>

        {/* Чекбокс — onCheckedChange (а не onChange) — иначе шадсн-чекбокс
            не реагировал на прямой клик, можно было выбирать только по тексту. */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleSelect}
        />

        {/* Картинка категории — небольшой превью 32x32 */}
        <div className="relative h-8 w-8 rounded overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
          {category.image_url ? (
            <Image
              src={getImageUrl(category.image_url)}
              alt={category.name}
              fill
              className="object-contain p-0.5"
              sizes="32px"
            />
          ) : (
            <Tag className="h-4 w-4 text-gray-300" />
          )}
        </div>

        {/* Название категории */}
        <span
          className="flex-1 text-sm"
          onClick={handleSelect}
        >
          {category.name}
        </span>
      </div>

      {/* Дочерние категории */}
      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              selectedCategories={selectedCategories}
              onToggleCategory={onToggleCategory}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CategorySelectionDialog({
  open,
  onOpenChange,
  selectedCategories,
  onCategoriesChange,
  multiple = false
}: CategorySelectionDialogProps) {
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (open) {
      loadCategories()
    }
  }, [open])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const data = await getCatalogCategories()
      setCategories(data)
    } catch (error) {
      console.error("Error loading categories:", error)
    } finally {
      setLoading(false)
    }
  }

  // Функция для фильтрации категорий с учетом вложенности
  const filterCategories = (cats: CategoryData[], term: string): CategoryData[] => {
    if (!term) return cats
    
    return cats.reduce((filtered: CategoryData[], cat) => {
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

  const handleCategoryToggle = (categoryId: number) => {
    if (multiple) {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter(id => id !== categoryId)
        : [...selectedCategories, categoryId]
      onCategoriesChange(newSelection)
    } else {
      onCategoriesChange([categoryId])
      onOpenChange(false)
    }
  }

  // Функция для получения всех ID категорий (включая вложенные)
  const getAllCategoryIds = (categories: CategoryData[]): number[] => {
    let ids: number[] = []
    for (const category of categories) {
      ids.push(category.id)
      if (category.children && category.children.length > 0) {
        ids.push(...getAllCategoryIds(category.children))
      }
    }
    return ids
  }

  const handleSelectAll = () => {
    if (multiple) {
      const allIds = getAllCategoryIds(filteredCategories)
      onCategoriesChange(allIds)
    }
  }

  const handleClearAll = () => {
    onCategoriesChange([])
  }

  // Хелпер для поиска категории во всех уровнях вложенности
  const findCategory = (cats: CategoryData[], id: number): CategoryData | null => {
    for (const cat of cats) {
      if (cat.id === id) return cat
      if (cat.children && cat.children.length > 0) {
        const found = findCategory(cat.children, id)
        if (found) return found
      }
    }
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {multiple ? "Выберите категории" : "Выберите категорию"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Двухколоночный layout — слева поиск+дерево, справа выбранные */}
          <div className={multiple ? "flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4" : "flex-1 min-h-0"}>

            {/* Левая колонка — поиск, кнопки, дерево */}
            <div className="flex flex-col min-h-0 space-y-3">
              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Поиск категорий..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                />
              </div>

              {multiple && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Выбрать все
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearAll}>
                    Очистить
                  </Button>
                </div>
              )}

              <div className="flex-1 min-h-0 border rounded-md">
                <ScrollArea className="h-full">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Загрузка категорий...</span>
                    </div>
                  ) : filteredCategories.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? "Категории не найдены" : "Категории не найдены"}
                    </div>
                  ) : (
                    <div className="space-y-1 p-1">
                      {filteredCategories.map((category) => (
                        <CategoryTreeItem
                          key={category.id}
                          category={category}
                          level={0}
                          selectedCategories={selectedCategories}
                          onToggleCategory={handleCategoryToggle}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* Правая колонка — выбранные (только в multiple-режиме) */}
            {multiple && (
              <div className="flex flex-col min-h-0 border rounded-md">
                <div className="flex-shrink-0 px-3 py-2 border-b bg-gray-50/60">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Выбрано <span className="text-gray-500">({selectedCategories.length})</span>
                  </h4>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  {selectedCategories.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-gray-400">
                      Ничего не выбрано
                    </p>
                  ) : (
                    <ul className="p-1 space-y-1">
                      {selectedCategories.map((categoryId) => {
                        const category = findCategory(categories, categoryId)
                        if (!category) return null
                        return (
                          <li
                            key={categoryId}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 group"
                          >
                            <span className="flex-1 text-sm truncate">{category.name}</span>
                            <button
                              type="button"
                              onClick={() => handleCategoryToggle(categoryId)}
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
            )}
          </div>

          {/* Кнопки действий */}
          {multiple && (
            <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
              >
                Отмена
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
              >
                Готово
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 