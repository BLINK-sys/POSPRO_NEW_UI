"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, ChevronRight, ChevronDown } from "lucide-react"
import { getCatalogCategories } from "@/app/actions/public"
import { CategoryData } from "@/app/actions/public"
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

        {/* Чекбокс выбора */}
        <Checkbox
          checked={isSelected}
          onChange={handleSelect}
        />

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {multiple ? "Выберите категории" : "Выберите категорию"}
          </DialogTitle>
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

          {/* Кнопки управления */}
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

          {/* Список категорий */}
          <div className="flex-1 min-h-0">
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
                <div className="space-y-2 p-1">
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

          {/* Выбранные категории */}
          {multiple && selectedCategories.length > 0 && (
            <div className="border-t pt-4 flex-shrink-0">
              <h4 className="font-medium mb-2">Выбранные категории:</h4>
              <div className="flex flex-wrap gap-1">
                {selectedCategories.map((categoryId) => {
                  // Функция для поиска категории во всех уровнях вложенности
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
                  
                  const category = findCategory(categories, categoryId)
                  return category ? (
                    <span
                      key={categoryId}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                    >
                      {category.name}
                      <button
                        onClick={() => handleCategoryToggle(categoryId)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Кнопки действий */}
          {multiple && (
            <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Готово
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 