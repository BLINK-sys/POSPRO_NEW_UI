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
    <Link href={`/category/${category.slug}`} onClick={onClick} className="block w-full h-full">
      <Card className="group hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] w-full h-full bg-white rounded-xl">
        {/* Grid-раскладка вместо flex-col с flex-1 — раньше flex-1 в
            некоторых обёртках (carousel с фикс-высотой + Link inline) не
            давал ребёнку явной высоты и <Image fill> отрисовывал 0px.
            grid-rows-[1fr_3.25rem] гарантирует: строка 1 = растянутая
            (картинка), строка 2 = 52px футер (умещает 2 строки текста). */}
        <CardContent className="p-0 h-full grid grid-rows-[1fr_3.25rem]">
          <div className="relative bg-white flex items-center justify-center rounded-t-xl overflow-hidden p-3 min-h-0">
            {typeof productCount === "number" && (
              <Badge className="absolute top-2 right-2 z-10 bg-brand-yellow text-black transition-colors group-hover:bg-gray-900 group-hover:text-white">
                {productCount}
              </Badge>
            )}
            {category.image_url ? (
              <Image
                src={getImageUrl(category.image_url)}
                alt={category.name}
                fill
                className="object-contain p-3 group-hover:scale-110 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="text-4xl text-gray-400">📁</div>
            )}
          </div>

          {/* Жёлтый футер: название в 2 строки с эллипсом + чёрный
              уголок-стрелка в правом верхнем углу (absolute). Уголок
              со скруглённым rounded-bl-lg — визуальная «отрывная»
              метка. pr-8 у текста-контейнера резервирует место под
              уголок, чтобы длинное имя корректно эллипсилось. */}
          <div className="relative bg-yellow-400 rounded-xl overflow-hidden px-3 py-1 flex items-center">
            <div className="flex-1 min-w-0 pr-8">
              <h3
                className="font-bold text-gray-900 text-[11px] leading-tight overflow-hidden"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
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
