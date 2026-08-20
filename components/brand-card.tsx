"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { BrandData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"
import { CardAdminEditButton } from "@/components/card-admin-edit-button"

export interface BrandCardProps {
  brand: BrandData
  /** SPA-навигация вместо Link (например для in-page смены бренда без
      full reload). Если задан — рендерим button вместо Link. */
  onClick?: () => void
}

/**
 * Единая карточка бренда (grid-плитка). Эталон стиля — блок брендов на
 * главной. Использовать вместо inline-разметки на /brands и т.п.
 *
 * Верстка полностью повторяет `renderBrandItem` из `homepage-block.tsx`.
 * Карточка квадратная (`aspect-square`); внешние размеры (ширина) задаются
 * оборачивающим grid'ом или карусельным слотом.
 */
export function BrandCard({ brand, onClick }: BrandCardProps) {
  const inner = (
    <Card className="group hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] aspect-square w-full bg-white rounded-xl">
      <CardContent className="p-0 h-full flex flex-col">
        {/* Кнопка редактирования (только админ/system) — в правом верхнем
            углу при hover. z-20 чтобы быть над hover-overlay. */}
        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <CardAdminEditButton
            entityType="brand"
            entityId={brand.id}
            entityName={brand.name}
          />
        </div>
        <div className="relative h-full bg-white rounded-xl overflow-hidden">
          {brand.image_url ? (
            <Image
              src={getImageUrl(brand.image_url)}
              alt={brand.name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            // Без картинки — сразу показываем название/страну/описание
            // (та же вёрстка, что и в hover-overlay ниже, но на белом фоне
            // и с чёрным текстом).
            <div className="flex items-center justify-center h-full p-1 sm:p-2 md:p-3">
              <div className="text-center text-gray-900 flex flex-col justify-center">
                <h3 className="font-bold text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg mb-0.5 sm:mb-1 leading-tight">
                  {brand.name}
                </h3>
                {brand.country && (
                  <p className="text-gray-600 text-[9px] sm:text-xs mb-0.5 sm:mb-1 leading-tight">
                    {brand.country}
                  </p>
                )}
                {brand.description && (
                  <p
                    className="text-gray-500 text-[8px] sm:text-xs leading-tight overflow-hidden"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {brand.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hover-overlay — только для карточек с картинкой; для fallback'а
            он избыточен (текст уже показан на белом фоне). */}
        {brand.image_url && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center rounded-xl pointer-events-none">
            <div className="text-center text-white p-1 sm:p-2 md:p-3 h-full flex flex-col justify-center">
              <h3 className="font-bold text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg mb-0.5 sm:mb-1 leading-tight">
                {brand.name}
              </h3>
              {brand.country && (
                <p className="text-white/90 text-[9px] sm:text-xs mb-0.5 sm:mb-1 leading-tight">
                  {brand.country}
                </p>
              )}
              {brand.description && (
                <p
                  className="text-white/80 text-[8px] sm:text-xs leading-tight overflow-hidden"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {brand.description}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    )
  }
  return <Link href={`/brand/${encodeURIComponent(brand.name)}`}>{inner}</Link>
}
