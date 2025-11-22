"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { CategoryData } from "@/app/actions/public"
import { cn } from "@/lib/utils"
import { ChevronRight, X, Grid3X3, List } from "lucide-react"
import { useCatalogPanel } from "@/context/catalog-panel-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getImageUrl } from "@/lib/image-utils"

interface CatalogPanelProps {
  categories: CategoryData[]
}

export default function CatalogPanel({ categories }: CatalogPanelProps) {
  const { closeCatalogPanel } = useCatalogPanel()
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null)
  const [subcategoryViewMode, setSubcategoryViewMode] = useState<'cards' | 'list'>('cards')

  const getCategoryCount = (category: CategoryData, { directOnly = false }: { directOnly?: boolean } = {}) => {
    if (directOnly) {
      return category.direct_product_count ?? 0
    }
    return category.product_count ?? category.direct_product_count ?? 0
  }

  const formatCategoryLabel = (category: CategoryData, options?: { directOnly?: boolean }) => {
    const count = getCategoryCount(category, options)
    if (!category.parent_id) {
      return category.name
    }
    return `${category.name} (${count})`
  }


  return (
    <section className="py-8 md:py-12 bg-white relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex gap-8 items-start">
          {/* Левая панель с основными категориями */}
          <div className="w-64 flex-shrink-0 bg-white rounded-lg p-4 shadow-[0_0_8px_rgba(0,0,0,0.15)]">
            <h2 className="font-bold text-xl mb-4 text-gray-900 text-center">Категории</h2>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/category/${category.slug}`}
                    onMouseEnter={() => setHoveredCategory(category)}
                    onClick={closeCatalogPanel}
                    className={cn(
                      "relative flex items-center justify-between p-3 rounded-lg transition-all duration-200 group",
                      hoveredCategory?.id === category.id
                        ? "bg-brand-yellow text-black font-medium"
                        : "hover:bg-brand-yellow hover:text-black text-gray-700 shadow-[0_0_8px_rgba(0,0,0,0.15)]"
                    )}
                  >
                    <span className={cn(
                      "text-sm flex-1",
                      category.children && category.children.length > 0 ? "pr-14" : ""
                    )}>{formatCategoryLabel(category, { directOnly: true })}</span>
                    {hoveredCategory?.id === category.id && category.children && category.children.length > 0 && (
                      <div className="absolute top-0 right-0 w-8 h-8 bg-gray-900 rounded-tr-lg rounded-bl-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                        <ChevronRight className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Правая панель с вложенными категориями */}
          {hoveredCategory && hoveredCategory.children && hoveredCategory.children.length > 0 ? (
            <div className="flex-1 bg-white rounded-lg shadow-[0_0_8px_rgba(0,0,0,0.15)]">
              {/* Заголовок с названием категории, кнопками и кнопкой закрытия - зафиксирован при прокрутке */}
              <div className="sticky top-0 z-10 bg-white rounded-t-lg p-6 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold text-2xl text-gray-900">{hoveredCategory.name}</h3>
                  <div className="flex items-center gap-2">
                    {/* Кнопки переключения вида */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubcategoryViewMode('cards')}
                        className={cn(
                          "px-3 py-2",
                          subcategoryViewMode === 'cards'
                            ? "bg-brand-yellow text-black hover:bg-yellow-500"
                            : "bg-white hover:bg-gray-50"
                        )}
                        title="Карточки"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubcategoryViewMode('list')}
                        className={cn(
                          "px-3 py-2",
                          subcategoryViewMode === 'list'
                            ? "bg-brand-yellow text-black hover:bg-yellow-500"
                            : "bg-white hover:bg-gray-50"
                        )}
                        title="Список"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Кнопка закрытия */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={closeCatalogPanel}
                      className="px-3 py-2 bg-white hover:bg-gray-50"
                      title="Закрыть каталог"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Контент с подкатегориями */}
              <div className="p-6 pt-4">
              
                {subcategoryViewMode === 'cards' ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {hoveredCategory.children.map((child) => (
                      <Link 
                        key={child.id} 
                        href={`/category/${child.slug}`}
                        onClick={closeCatalogPanel}
                      >
                        <Card className="group hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] h-64 w-56 flex-shrink-0 bg-white rounded-xl">
                          <CardContent className="p-0 h-full flex flex-col">
                            {/* Верхняя часть с изображением на белом фоне */}
                            <div className="relative h-48 bg-white flex items-center justify-center rounded-t-xl overflow-hidden p-4">
                              <Badge className="absolute top-3 right-3 z-10 bg-brand-yellow text-black transition-colors group-hover:bg-gray-900 group-hover:text-white">
                                {getCategoryCount(child)}
                              </Badge>
                              {child.image_url ? (
                                <div className="relative w-full h-full flex items-center justify-center">
                                  <Image
                                    src={getImageUrl(child.image_url)}
                                    alt={child.name}
                                    fill
                                    className="object-contain group-hover:scale-110 transition-transform duration-300"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  />
                                </div>
                              ) : (
                                <div className="text-4xl text-gray-400">📁</div>
                              )}
                            </div>
                            
                            {/* Нижняя часть - ярко-желтый блок с названием и стрелкой */}
                            <div className="relative bg-yellow-400 h-16 rounded-xl p-4 flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-sm leading-tight">
                                  {child.name}
                                </h3>
                                {child.description && (
                                  <p className="text-gray-700 text-xs mt-1 line-clamp-2">
                                    {child.description}
                                  </p>
                                )}
                              </div>
                              
                              {/* Стрелка в правом верхнем углу желтого блока */}
                              <div className="absolute top-0 right-0 w-8 h-8 bg-gray-900 rounded-tr-lg rounded-bl-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                                <ChevronRight className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {hoveredCategory.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/category/${child.slug}`}
                        onClick={closeCatalogPanel}
                        className="text-gray-700 hover:text-brand-yellow transition-colors"
                      >
                        {formatCategoryLabel(child)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : hoveredCategory ? (
            <div className="flex-1 bg-white rounded-lg p-6 shadow-[0_0_8px_rgba(0,0,0,0.15)] flex items-center justify-center">
              <div className="text-center">
                <h3 className="font-bold text-xl text-gray-900 mb-2">{hoveredCategory.name}</h3>
                <p className="text-gray-500 mb-4">В этой категории нет подкатегорий</p>
                <Link
                  href={`/category/${hoveredCategory.slug}`}
                  onClick={closeCatalogPanel}
                  className="inline-block px-6 py-2 bg-brand-yellow text-black rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                >
                  Посмотреть товары
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white rounded-lg p-6 shadow-[0_0_8px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center gap-4">
              <div className="relative w-48 h-20">
                <Image
                  src="/ui/big_logo.png"
                  alt="POSPRO"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <p className="text-gray-400 text-sm">Наведите на категорию для просмотра подкатегорий</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

