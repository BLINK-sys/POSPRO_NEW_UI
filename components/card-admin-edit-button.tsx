"use client"

import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"

export type CardEntityType = "product" | "category" | "brand" | "section-card" | "banner"

interface CardAdminEditButtonProps {
  entityType: CardEntityType
  /** Id сущности. Для товара может отсутствовать — используется slug. */
  entityId?: number
  /** Slug — только для товара (роут /admin/catalog/products/[slug]/edit). */
  entitySlug?: string
  /** Название — для тултипа. */
  entityName?: string
  className?: string
}

/**
 * Универсальная кнопка «Редактировать» (карандашик) на карточках товара /
 * категории / бренда. Виден только админ/system-юзерам. Клик открывает
 * полноценную страницу редактирования в админке в новой вкладке —
 * модалок не показываем, чтобы поведение было единообразным.
 *
 * Для category/brand у нас нет отдельной страницы редактирования, поэтому
 * ссылка идёт на общий список с deep-link'ом `?edit=<id>` — на той стороне
 * useEffect ловит query-param и автоматически открывает модалку конкретного
 * элемента (см. brands-list.tsx / category-list.tsx).
 */
export function CardAdminEditButton({
  entityType,
  entityId,
  entitySlug,
  entityName,
  className,
}: CardAdminEditButtonProps) {
  const { user } = useAuth()
  const isSystemUser = user?.role === "admin" || user?.role === "system"
  if (!isSystemUser) return null

  const adminUrl = (() => {
    if (entityType === "product" && entitySlug) {
      return `/admin/catalog/products/${entitySlug}/edit`
    }
    if (entityType === "category" && entityId) {
      return `/admin/catalog/categories?edit=${entityId}`
    }
    if (entityType === "brand" && entityId) {
      return `/admin/brands-and-statuses?edit=${entityId}`
    }
    if (entityType === "section-card" && entityId) {
      // Отдельной страницы у section-card нет — редирект на список
      // (Управление страницами → Карточки → Карточки разделов) +
      // deep-link, который сам переключит вкладки и откроет модалку.
      return `/admin/pages?edit-section-card=${entityId}`
    }
    if (entityType === "banner") {
      // Для баннеров конкретной страницы редактирования нет — просто
      // открываем общий список во вкладке «Баннеры» (в модалку не идём).
      return `/admin/pages?tab=banners`
    }
    return undefined
  })()

  if (!adminUrl) return null

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(adminUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="ghost"
      className={cn(
        "w-7 h-7 p-0 rounded-full shadow-md hover:shadow-lg transition-colors bg-brand-yellow hover:bg-yellow-500 text-black",
        className,
      )}
      title={entityName ? `Редактировать: ${entityName}` : "Редактировать"}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  )
}
