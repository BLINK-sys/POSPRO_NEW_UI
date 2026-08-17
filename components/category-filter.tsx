"use client"

import { CategoryData } from "@/app/actions/public"
import { cn } from "@/lib/utils"

interface CategoryFilterProps {
  categories: CategoryData[]
  selectedCategoryId: number | null
  onCategorySelect: (categoryId: number | null) => void
  className?: string
}

/**
 * Компактный фильтр категорий для блоков товаров на главной. Кнопки
 * оформлены как пункты нижней полосы шапки (мелкий text-[11px], тонкие
 * pill-таблетки с hover-bg-yellow), а не крупные bg-gray Button'ы.
 * Активная — жёлтая заливка + чёрный текст.
 */
export default function CategoryFilter({
  categories,
  selectedCategoryId,
  onCategorySelect,
  className = "",
}: CategoryFilterProps) {
  if (!categories || categories.length === 0) return null

  const chipCls = (active: boolean) => cn(
    "whitespace-nowrap px-2.5 py-1 text-[11px] rounded-full transition-colors border cursor-pointer",
    active
      ? "bg-brand-yellow text-black border-brand-yellow shadow-sm font-medium"
      : "bg-white text-gray-700 border-gray-200 hover:bg-yellow-50 hover:border-yellow-200 hover:text-black",
  )

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <button
        type="button"
        onClick={() => onCategorySelect(null)}
        className={chipCls(selectedCategoryId === null)}
      >
        Все категории
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onCategorySelect(category.id)}
          className={chipCls(selectedCategoryId === category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  )
}
