"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CategoryData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"

export interface CategoryCardProps {
  category: CategoryData
  /** Клик по карточке — если задан, вызывается ДО навигации (например,
      чтобы закрыть панель каталога). Ссылка на /category/{slug} остаётся. */
  onClick?: () => void
  /** Счётчик товаров в правом верхнем углу картинки — для каталог-панелей. */
  productCount?: number
}

/**
 * Единая карточка категории (grid-плитка). Эталон стиля — блок категорий
 * на главной. Использовать вместо inline-разметки на /categories, в фильтрах
 * и т.п.
 *
 * Верстка полностью повторяет `renderCategoryItem` из `homepage-block.tsx`,
 * поэтому визуальные изменения ведём в одном месте.
 *
 * Внешние размеры (высота/ширина) задаются оборачивающим контейнером —
 * например `h-64` в grid или `w-56 h-64` в carousel-слайдере.
 */
export function CategoryCard({ category, onClick, productCount }: CategoryCardProps) {
  return (
    <Link href={`/category/${category.slug}`} onClick={onClick}>
      <Card className="group hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] w-full h-full bg-white rounded-xl">
        <CardContent className="p-0 h-full flex flex-col">
          <div className="relative flex-1 bg-white flex items-center justify-center rounded-t-xl overflow-hidden p-3">
            {typeof productCount === "number" && (
              <Badge className="absolute top-2 right-2 z-10 bg-brand-yellow text-black transition-colors group-hover:bg-gray-900 group-hover:text-white">
                {productCount}
              </Badge>
            )}
            {category.image_url ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src={getImageUrl(category.image_url)}
                  alt={category.name}
                  fill
                  className="object-contain group-hover:scale-110 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            ) : (
              <div className="text-4xl text-gray-400">📁</div>
            )}
          </div>

          <div className="relative bg-yellow-400 h-10 rounded-xl px-3 flex items-center justify-between mt-auto">
            <div className="flex-1 min-w-0 pr-8">
              <h3 className="font-bold text-gray-900 text-[11px] leading-tight truncate">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-gray-700 text-[10px] leading-tight truncate">
                  {category.description}
                </p>
              )}
            </div>

            <div className="absolute top-0 right-0 w-6 h-6 bg-gray-900 rounded-tr-xl rounded-bl-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-3 h-3 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
