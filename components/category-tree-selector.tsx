"use client"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, Check } from "lucide-react"
import { type Category } from "@/app/actions/categories"
import { cn } from "@/lib/utils"

interface CategoryTreeSelectorProps {
  categories: Category[]
  selectedCategoryId: number | null
  onSelect: (categoryId: number | null) => void
  excludeCategoryId?: number | null
  className?: string
  initiallyExpanded?: Set<number>
}

interface CategoryTreeItemProps {
  category: Category
  level: number
  selectedCategoryId: number | null
  onSelect: (categoryId: number | null) => void
  excludeCategoryId?: number | null
  initiallyExpanded?: Set<number>
}

function CategoryTreeItem({ 
  category, 
  level, 
  selectedCategoryId, 
  onSelect, 
  excludeCategoryId,
  initiallyExpanded
}: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded?.has(category.id) ?? false)
  
  // Автоматически разворачиваем при монтировании, если категория в списке initiallyExpanded
  useEffect(() => {
    if (initiallyExpanded?.has(category.id)) {
      setIsExpanded(true)
    }
  }, [category.id, initiallyExpanded])
  const hasChildren = category.children && category.children.length > 0
  const isSelected = selectedCategoryId === category.id
  const isExcluded = excludeCategoryId === category.id

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleSelect = () => {
    if (!isExcluded) {
      onSelect(category.id)
    }
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
          isSelected && "bg-blue-100 dark:bg-blue-900",
          isExcluded && "opacity-50 cursor-not-allowed"
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
        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            isSelected 
              ? "bg-blue-500 border-blue-500" 
              : "border-gray-300 dark:border-gray-600",
            isExcluded && "opacity-50"
          )}
          onClick={handleSelect}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
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
              selectedCategoryId={selectedCategoryId}
              onSelect={onSelect}
              excludeCategoryId={excludeCategoryId}
              initiallyExpanded={initiallyExpanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CategoryTreeSelector({
  categories,
  selectedCategoryId,
  onSelect,
  excludeCategoryId,
  className,
  initiallyExpanded
}: CategoryTreeSelectorProps) {
  return (
    <div className={cn("w-full space-y-2 p-1", className)}>
      {/* Опция "Корневая категория" */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
          selectedCategoryId === null && "bg-blue-100 dark:bg-blue-900"
        )}
        onClick={() => onSelect(null)}
      >
        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            selectedCategoryId === null 
              ? "bg-blue-500 border-blue-500" 
              : "border-gray-300 dark:border-gray-600"
          )}
        >
          {selectedCategoryId === null && <Check className="h-3 w-3 text-white" />}
        </div>
        <span className="flex-1 text-sm font-medium">-- Корневая категория --</span>
      </div>

      {/* Дерево категорий */}
      <div className="border-t pt-2">
        {categories.map((category) => (
          <CategoryTreeItem
            key={category.id}
            category={category}
            level={0}
            selectedCategoryId={selectedCategoryId}
            onSelect={onSelect}
            excludeCategoryId={excludeCategoryId}
            initiallyExpanded={initiallyExpanded}
          />
        ))}
      </div>
    </div>
  )
} 