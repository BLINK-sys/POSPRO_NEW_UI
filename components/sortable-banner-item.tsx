"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { GripVertical, Edit, Trash2 } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { getImageUrl } from "@/lib/image-utils"
import { API_BASE_URL } from "@/lib/api-address"

interface Banner {
  id: number
  title: string
  subtitle: string
  description: string
  image_url: string
  button_text: string
  button_link: string
  active: boolean
  order: number
}

interface SortableBannerItemProps {
  banner: Banner
  onEdit: (banner: Banner) => void
  onDelete: (id: number) => void
  onToggleActive: (id: number, active: boolean) => void
}

export function SortableBannerItem({ banner, onEdit, onDelete, onToggleActive }: SortableBannerItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleToggleActive = async (checked: boolean) => {
    if (isUpdating) return

    setIsUpdating(true)

    // Optimistically update UI
    onToggleActive(banner.id, checked)

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/banners/${banner.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: banner.title,
          subtitle: banner.subtitle,
          image: banner.image_url,
          active: checked,
          button_text: banner.button_text,
          button_link: banner.button_link,
          show_button: banner.show_button,
          order: banner.order,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to update banner")
      }

      toast.success(`Баннер ${checked ? "активирован" : "деактивирован"}`)
    } catch (error: any) {
      // Revert optimistic update on error
      onToggleActive(banner.id, !checked)
      toast.error(`Ошибка обновления: ${error.message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "opacity-50" : ""}`}>
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Drag Handle */}
            <div className="flex items-center">
              <button
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Image - 2:1 ratio */}
            <div className="w-32 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              {banner.image_url ? (
                <img
                  src={getImageUrl(banner.image_url) || "/placeholder.svg"}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error("Banner image failed to load:", banner.image_url)
                    e.currentTarget.src = "/placeholder.svg?height=64&width=128"
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-xs">Нет изображения</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{banner.title || "Без названия"}</h3>
                  {banner.subtitle && <p className="text-sm text-gray-500 truncate mt-1">{banner.subtitle}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={banner.active ? "default" : "secondary"}>
                      {banner.active ? "Активен" : "Неактивен"}
                    </Badge>
                    {banner.show_button && <Badge variant="outline">Кнопка: {banner.button_text || "Подробнее"}</Badge>}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls - Centered vertically */}
            <div className="flex items-center gap-3">
              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <Switch checked={banner.active} onCheckedChange={handleToggleActive} disabled={isUpdating} />
                <span className="text-sm text-gray-600">{banner.active ? "Активен" : "Неактивен"}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => onEdit(banner)} className="h-8 w-8 p-0">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(banner.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
