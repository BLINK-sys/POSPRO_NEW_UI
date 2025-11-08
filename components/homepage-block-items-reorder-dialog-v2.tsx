"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  RotateCcw, 
  Grid3X3, 
  Package, 
  Tag, 
  Star, 
  Info,
  Loader2,
  Check
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { API_BASE_URL } from "@/lib/api-address"
import { getIcon } from "@/lib/icon-mapping"
import { 
  HOMEPAGE_BLOCK_TYPES, 
  HOMEPAGE_BLOCK_TYPE_LABELS, 
  HomepageBlock 
} from "@/lib/constants"
import { getCategories } from "@/app/actions/categories"
import { getProductsByIds } from "@/app/actions/products"
import { getBrands } from "@/app/actions/brands"
import { getBenefits } from "@/app/actions/benefits"
import { getSmallBanners } from "@/app/actions/small-banners"
import { reorderHomepageBlockItems } from "@/app/actions/homepage-blocks"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface HomepageBlockItemsReorderDialogV2Props {
  block: HomepageBlock | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface ItemWithOrder {
  id: number
  name?: string
  title?: string
  description?: string
  image_url?: string
  image?: string
  icon?: string
  price?: number
  article?: string
  order: number
  originalOrder: number
  [key: string]: any
}

// Компонент для сортируемой квадратной карточки
interface SortableCardProps {
  item: ItemWithOrder
  blockType: string
  getImageUrl: (url: string | null | undefined) => string
  getTypeIcon: () => React.ReactNode
}

function SortableCard({ item, blockType, getImageUrl, getTypeIcon }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const name = item.name || item.title || "Без названия"
  const description = item.description || ""

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col rounded-lg border bg-background w-[180px] h-[180px] cursor-grab active:cursor-grabbing overflow-hidden ${
        isDragging ? "opacity-50 shadow-lg z-50" : "hover:shadow-md transition-shadow"
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Номер позиции - поверх карточки в левом верхнем углу */}
      <Badge 
        variant="secondary" 
        className="absolute top-2 left-2 z-10 text-xs px-2 py-0.5 bg-white/90 backdrop-blur-sm"
      >
        #{item.order + 1}
      </Badge>

      {/* Изображение или иконка - 80% высоты */}
      <div className="w-full h-4/5 flex items-center justify-center bg-muted/20 p-2">
        {/* Для преимуществ показываем их иконку */}
        {blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS ? (
           <div className="w-full h-full bg-muted flex items-center justify-center">
             {item.icon ? (
               getIcon(item.icon, "h-12 w-12")
             ) : (
               getTypeIcon()
             )}
           </div>
        ) : (item.image_url || item.image) ? (
          <Image
            src={getImageUrl(item.image_url || item.image)}
            alt={name}
            width={160}
            height={160}
            className="max-w-full max-h-full object-contain"
            unoptimized
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            {getTypeIcon()}
          </div>
        )}
      </div>

      {/* Название - под изображением */}
      <div className="h-1/5 flex items-center justify-center p-2 bg-background">
        <div className="font-medium text-sm leading-tight text-center w-full">
          {name}
        </div>
      </div>

    </div>
  )
}

export default function HomepageBlockItemsReorderDialogV2({ 
  block, 
  open, 
  onOpenChange, 
  onSuccess 
}: HomepageBlockItemsReorderDialogV2Props) {
  const [items, setItems] = useState<ItemWithOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Загрузка элементов при открытии диалога
  useEffect(() => {
    if (open && block) {
      loadItems()
      setHasChanges(false)
    }
  }, [open, block])


  const loadItems = useCallback(async () => {
    if (!block) return

    try {
      setLoading(true)
      let allItems: any[] = []
      
      // Загружаем все элементы в зависимости от типа блока
      switch (block.type) {
        case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
          allItems = await getCategories()
          break
        case HOMEPAGE_BLOCK_TYPES.PRODUCTS:
          allItems = await getProductsByIds(block.items)
          break
        case HOMEPAGE_BLOCK_TYPES.BRANDS:
          allItems = await getBrands()
          break
        case HOMEPAGE_BLOCK_TYPES.BENEFITS:
          allItems = await getBenefits()
          break
        case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
          allItems = await getSmallBanners()
          break
        default:
          allItems = []
      }

      // Фильтруем только выбранные элементы и сохраняем их порядок
      const selectedItems: ItemWithOrder[] = block.items.map((itemId, index) => {
        let item = null
        
        if (block.type === HOMEPAGE_BLOCK_TYPES.CATEGORIES) {
          // Для категорий рекурсивно ищем элемент в дереве
          const findCategoryInTree = (categories: any[], targetId: number): any => {
            for (const category of categories) {
              if (category.id === targetId) {
                return category
              }
              if (category.children && category.children.length > 0) {
                const found = findCategoryInTree(category.children, targetId)
                if (found) return found
              }
            }
            return null
          }
          item = findCategoryInTree(allItems, itemId)
        } else {
          // Для остальных типов просто ищем по ID
          item = allItems.find(i => i.id === itemId)
        }
        
        return item ? { ...item, order: index, originalOrder: index } : null
      }).filter(Boolean)

      setItems(selectedItems)
      setHasChanges(false)
    } catch (error) {
      console.error("Error loading items:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить элементы",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [block, toast])

  const getImageUrl = useCallback((url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") {
      return "/placeholder.svg"
    }
    
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }, [])

  const getTypeIcon = () => {
    switch (block?.type) {
      case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
        return <Grid3X3 className="h-4 w-4" />
      case HOMEPAGE_BLOCK_TYPES.PRODUCTS:
        return <Package className="h-4 w-4" />
      case HOMEPAGE_BLOCK_TYPES.BRANDS:
        return <Tag className="h-4 w-4" />
      case HOMEPAGE_BLOCK_TYPES.BENEFITS:
        return <Star className="h-4 w-4" />
      case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
        return <Info className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const resetOrder = () => {
    const originalOrder = [...items].sort((a, b) => a.originalOrder - b.originalOrder)
    setItems(originalOrder)
    setHasChanges(false)
  }

  const saveOrder = useCallback(async () => {
    if (!block) return

    try {
      setIsSaving(true)
      
      const orderData = items.map((item, index) => ({
        id: item.id,
        order: index
      }))

      const result = await reorderHomepageBlockItems(block.id, orderData)
      
      if (result.success) {
        toast({
          title: "Успешно",
          description: "Порядок элементов обновлен",
        })
        setHasChanges(false)
        onSuccess()
        onOpenChange(false) // Закрываем диалог
      } else {
        toast({
          title: "Ошибка",
          description: result.error || "Не удалось сохранить порядок",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving order:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить порядок элементов",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [block, items, toast, onSuccess])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(item => item.id === active.id)
      const newIndex = items.findIndex(item => item.id === over?.id)

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)
      setHasChanges(true)
    }
  }, [items])


  if (!block) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] h-[90vh] max-w-none max-h-none flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center space-x-2">
            {getTypeIcon()}
            <span>Управление порядком элементов</span>
          </DialogTitle>
          <DialogDescription>
            Блок: "{block.title}" • {HOMEPAGE_BLOCK_TYPE_LABELS[block.type]} • {items.length} элементов
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Панель управления */}
          <div className="flex justify-end">
            {/* Кнопки управления */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetOrder}
                disabled={!hasChanges}
                className="flex items-center space-x-1"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Сбросить</span>
              </Button>
              
              <Button
                onClick={saveOrder}
                disabled={!hasChanges || isSaving}
                className="flex items-center space-x-1"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Сохранить</span>
              </Button>
            </div>
          </div>

          {/* Список элементов */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <p className="text-muted-foreground">Загрузка элементов...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Нет элементов для настройки порядка
                </p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-4">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={items.map(item => item.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {items.map((item) => (
                          <SortableCard
                            key={item.id}
                            item={item}
                            blockType={block?.type || ""}
                            getImageUrl={getImageUrl}
                            getTypeIcon={getTypeIcon}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Подсказка */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            💡 <strong>Совет:</strong> Перетаскивайте карточки за любое место для изменения порядка
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
