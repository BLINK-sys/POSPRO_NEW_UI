"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import React from "react"
import { Loader2, X, Grid3X3, Package, Tag, Star, Info, Layers } from "lucide-react"
import { getIcon } from "@/lib/icon-mapping"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { API_BASE_URL } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
import { 
  HOMEPAGE_BLOCK_TYPES, 
  HOMEPAGE_BLOCK_TYPE_LABELS 
} from "@/lib/constants"
import { getCategories } from "@/app/actions/categories"
import { getProductsByIds } from "@/app/actions/products"
import { getBrands } from "@/app/actions/brands"
import { getBenefits } from "@/app/actions/benefits"
import { getSmallBanners } from "@/app/actions/small-banners"
import { getSectionCards } from "@/app/actions/section-cards"
import { cn } from "@/lib/utils"

interface SelectedElementsDisplayProps {
  blockType: string
  selectedItemIds: number[]
  onRemoveItem: (itemId: number) => void
  onClearAll: () => void
  className?: string
  /** 'row' — компактный список строкой (по умолчанию), 'grid' —
      квадратные карточки в сетке (для полноэкранного редактора блока). */
  layout?: "row" | "grid"
}

function SelectedElementsDisplay({
  blockType,
  selectedItemIds,
  onRemoveItem,
  onClearAll,
  className,
  layout = "row",
}: SelectedElementsDisplayProps) {
  const [elements, setElements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()


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
          allElements = await getProductsByIds(selectedItemIds)
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
        case HOMEPAGE_BLOCK_TYPES.SECTION_CARDS:
          allElements = await getSectionCards()
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
        const elementsMap = new Map(allElements.map(element => [element.id, element]))
        selectedElements = selectedItemIds
          .map(id => elementsMap.get(id))
          .filter((element): element is any => Boolean(element))
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

  // Квадратная плитка для grid-layout. Пропорции контента зависят от
  // типа блока: у товаров 70/30 (картинка/текст), у карточек разделов
  // текст крупный по центру, у брендов — если есть картинка, текст
  // скрыт, если нет — вместо картинки крупный fallback с названием.
  const renderElementTile = (element: any) => {
    const imgSrc =
      blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS && element.icon
        ? null
        : element.image || element.image_url

    const isProduct = blockType === HOMEPAGE_BLOCK_TYPES.PRODUCTS
    const isBrand = blockType === HOMEPAGE_BLOCK_TYPES.BRANDS
    const isSectionCard = blockType === HOMEPAGE_BLOCK_TYPES.SECTION_CARDS
    const isBenefit = blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS
    const hasImage = !!imgSrc && !isBenefit
    const name = element.name || element.title || "Без названия"

    // Товары — 70/30 без aspect-square, чтобы соотношение точно
    // держалось. Остальные — квадратные с текстом «на своей строке».
    const wrapperClass = isProduct
      ? "aspect-square flex flex-col"
      : "aspect-square flex flex-col"

    return (
      <div
        key={element.id}
        className="relative group h-full bg-white rounded-lg border-2 border-transparent shadow-[0_2px_6px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.22)] hover:scale-[1.04] hover:z-10 transition-all duration-200 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => onRemoveItem(element.id)}
          className="absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-white/95 text-red-500 hover:text-red-700 hover:bg-white shadow flex items-center justify-center"
          title="Убрать из выбора"
          aria-label="Убрать"
        >
          <X className="h-3 w-3" />
        </button>

        <div className={wrapperClass + " p-1.5"}>
          {isBrand && !hasImage ? (
            // Бренд без картинки — крупное название на всю карточку
            <div className="flex-1 flex items-center justify-center text-center px-1">
              <span className="text-sm font-bold text-gray-900 line-clamp-3">{name}</span>
            </div>
          ) : isProduct ? (
            <>
              {/* Товар: 70% картинка / 30% текст. Явные h-[70%]/h-[30%]
                  нужны, чтобы Image fill получил высоту от родителя;
                  flex-basis без явной высоты давал картинке 0px и
                  визуально накладывался на текст. */}
              <div className="relative bg-white h-[70%] shrink-0">
                <Image
                  src={getImageUrl(imgSrc)}
                  alt={name}
                  fill
                  unoptimized
                  className="object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
                />
              </div>
              <div className="px-1 py-1 text-[11px] text-gray-800 line-clamp-2 leading-tight h-[30%] shrink-0 flex items-center">
                {name}
              </div>
            </>
          ) : isSectionCard ? (
            <>
              <div className="relative flex-1 bg-white">
                {isBenefit && element.icon ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {getIcon(element.icon, "w-8 h-8 text-gray-600")}
                  </div>
                ) : (
                  <Image
                    src={getImageUrl(imgSrc)}
                    alt={name}
                    fill
                    unoptimized
                    className="object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
                  />
                )}
              </div>
              <div className="px-1 py-1 text-sm font-semibold text-center text-gray-900 line-clamp-2 leading-tight">
                {name}
              </div>
            </>
          ) : (
            <>
              {/* Бренды с картинкой / бенефиты / малые баннеры */}
              <div className="relative flex-1 bg-white">
                {isBenefit && element.icon ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {getIcon(element.icon, "w-8 h-8 text-gray-600")}
                  </div>
                ) : (
                  <Image
                    src={getImageUrl(imgSrc)}
                    alt={name}
                    fill
                    unoptimized
                    className="object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
                  />
                )}
              </div>
              {/* Для брендов с картинкой имя НЕ показываем */}
              {!isBrand && (
                <div className="px-1 py-1 text-[11px] text-gray-800 line-clamp-2 leading-tight">
                  {name}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
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
            {blockType === HOMEPAGE_BLOCK_TYPES.SECTION_CARDS && <Layers className="h-8 w-8 text-muted-foreground" />}
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
      <div className="flex items-center justify-between flex-shrink-0 mb-2 px-3 pt-2">
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
        {layout === "grid" ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 p-3 pb-6">
            {elements.map(renderElementTile)}
          </div>
        ) : (
          <div className="space-y-2 pr-2 pb-2">
            {elements.map(renderElementCard)}
          </div>
        )}
      </div>
    </div>
  )
}

export default SelectedElementsDisplay