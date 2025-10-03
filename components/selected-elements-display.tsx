"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import React from "react"
import { Loader2, X, Grid3X3, Package, Tag, Star, Info } from "lucide-react"
import { getIcon } from "@/lib/icon-mapping"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { API_BASE_URL } from "@/lib/api-address"
import { 
  HOMEPAGE_BLOCK_TYPES, 
  HOMEPAGE_BLOCK_TYPE_LABELS 
} from "@/lib/constants"
import { getCategories } from "@/app/actions/categories"
import { getProducts } from "@/app/actions/products"
import { getBrands } from "@/app/actions/brands"
import { getBenefits } from "@/app/actions/benefits"
import { getSmallBanners } from "@/app/actions/small-banners"
import { cn } from "@/lib/utils"

interface SelectedElementsDisplayProps {
  blockType: string
  selectedItemIds: number[]
  onRemoveItem: (itemId: number) => void
  onClearAll: () => void
  className?: string
}

function SelectedElementsDisplay({
  blockType,
  selectedItemIds,
  onRemoveItem,
  onClearAll,
  className
}: SelectedElementsDisplayProps) {
  const [elements, setElements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Функция для получения URL изображения
  const getImageUrl = useCallback((url: string | null | undefined): string => {
    try {
      if (!url || typeof url !== 'string' || url.trim() === "") {
        return "/placeholder.svg"
      }
      
      const trimmedUrl = url.trim()
      
      // Если URL уже полный
      if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
        return trimmedUrl
      }
      
      // Если URL начинается с /uploads/, добавляем префикс API сервера
      if (trimmedUrl.startsWith("/uploads/")) {
        return `${API_BASE_URL}${trimmedUrl}`
      }
      
      // Для остальных относительных ссылок также добавляем префикс
      return `${API_BASE_URL}${trimmedUrl.startsWith("/") ? trimmedUrl : `/${trimmedUrl}`}`
    } catch (error) {
      console.error("Error processing image URL:", url, error)
      return "/placeholder.svg"
    }
  }, [])

  // Загрузка элементов по ID
  useEffect(() => {
    if (selectedItemIds.length > 0) {
      loadElementsByIds()
    } else {
      setElements([])
      setLoading(false)
    }
  }, [selectedItemIds, blockType])

  // Функция для поиска элемента по ID во всех уровнях вложенности
  const findElementById = (elements: any[], id: number): any | null => {
    for (const element of elements) {
      if (element.id === id) {
        return element
      }
      if (element.children && element.children.length > 0) {
        const found = findElementById(element.children, id)
        if (found) return found
      }
    }
    return null
  }

  const loadElementsByIds = async () => {
    try {
      setLoading(true)
      let allElements: any[] = []
      
      switch (blockType) {
        case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
          allElements = await getCategories()
          break
        case HOMEPAGE_BLOCK_TYPES.PRODUCTS:
          allElements = await getProducts()
          break
        case HOMEPAGE_BLOCK_TYPES.BRANDS:
          allElements = await getBrands()
          break
        case HOMEPAGE_BLOCK_TYPES.BENEFITS:
          allElements = await getBenefits()
          break
        case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
          allElements = await getSmallBanners()
          break
        default:
          allElements = []
      }
      
      // Для категорий ищем элементы во всех уровнях вложенности
      let selectedElements: any[] = []
      if (blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES) {
        selectedElements = selectedItemIds
          .map(id => findElementById(allElements, id))
          .filter(element => element !== null)
      } else {
        // Для остальных типов используем обычную фильтрацию
        selectedElements = allElements.filter(element => 
          selectedItemIds.includes(element.id)
        )
      }
      
      setElements(selectedElements)
    } catch (error) {
      console.error("Error loading selected elements:", error)
      toast({
        title: "Ошибка",
        description: `Не удалось загрузить выбранные элементы: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        variant: "destructive",
      })
      setElements([])
    } finally {
      setLoading(false)
    }
  }

  const renderElementCard = (element: any) => {
    const getImageSource = () => {
      switch (blockType) {
        case HOMEPAGE_BLOCK_TYPES.PRODUCTS:
          return element.image || element.image_url
        case HOMEPAGE_BLOCK_TYPES.BENEFITS:
          return element.icon || element.image_url
        case HOMEPAGE_BLOCK_TYPES.BRANDS:
          return element.image_url
        case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
          return element.image_url
        case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
          return element.image_url
        default:
          return element.image_url
      }
    }

    const imageSource = getImageSource()

    return (
      <div
        key={element.id}
        className="flex items-center space-x-2 p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex-shrink-0">
          {blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS && element.icon ? (
            <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded">
              {getIcon(element.icon, "w-5 h-5 text-gray-600")}
            </div>
          ) : (
            <Image
              src={getImageUrl(imageSource)}
              alt={element.name || element.title || "Элемент"}
              width={32}
              height={32}
              className="rounded object-cover"
              unoptimized
              onError={(e) => {
                console.error(`Failed to load image for ${blockType}:`, imageSource)
                e.currentTarget.src = "/placeholder.svg"
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">
            {element.name || element.title || "Без названия"}
          </h4>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemoveItem(element.id)}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex items-center justify-center flex-1 min-h-0">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Загрузка элементов...</span>
        </div>
      </div>
    )
  }

  if (selectedItemIds.length === 0) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex items-center justify-center flex-1 min-h-0">
          <div className="flex flex-col items-center space-y-2">
            {blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES && <Grid3X3 className="h-8 w-8 text-muted-foreground" />}
            {blockType === HOMEPAGE_BLOCK_TYPES.PRODUCTS && <Package className="h-8 w-8 text-muted-foreground" />}
            {blockType === HOMEPAGE_BLOCK_TYPES.BRANDS && <Tag className="h-8 w-8 text-muted-foreground" />}
            {blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS && <Star className="h-8 w-8 text-muted-foreground" />}
            {blockType === HOMEPAGE_BLOCK_TYPES.INFO_CARDS && <Info className="h-8 w-8 text-muted-foreground" />}
            <p className="text-sm text-muted-foreground">
              Элементы не выбраны
            </p>
            <p className="text-xs text-muted-foreground">
              Нажмите кнопку "Выбрать элементы" для добавления
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between flex-shrink-0 mb-3">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium">Выбранные элементы</h4>
          <Badge variant="outline" className="text-xs">
            {elements.length} из {selectedItemIds.length}
          </Badge>
        </div>
        {elements.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="text-xs"
          >
            Очистить все
          </Button>
        )}
      </div>

      <div 
        className="flex-1 min-h-0 overflow-y-auto" 
        style={{ height: 'calc(100% - 60px)' }}
      >
        <div className="space-y-2 pr-2 pb-2">
          {elements.map(renderElementCard)}
        </div>
      </div>
    </div>
  )
}

export default SelectedElementsDisplay