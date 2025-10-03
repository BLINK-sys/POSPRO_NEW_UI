"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GripVertical, Package, Tag, Star, Info, Grid3X3, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { API_BASE_URL } from "@/lib/api-address"
import { 
  HOMEPAGE_BLOCK_TYPES, 
  HOMEPAGE_BLOCK_TYPE_LABELS, 
  HomepageBlock 
} from "@/lib/constants"
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
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { getCategories } from "@/app/actions/categories"
import { getProducts } from "@/app/actions/products"
import { getBrands } from "@/app/actions/brands"
import { getBenefits } from "@/app/actions/benefits"
import { getSmallBanners } from "@/app/actions/small-banners"
import { reorderHomepageBlockItems } from "@/app/actions/homepage-blocks"

interface HomepageBlockItemsReorderDialogProps {
  block: HomepageBlock | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Компонент для сортируемого элемента
interface SortableItemProps {
  item: any
  type: string
}

function SortableItem({ item, type }: SortableItemProps) {
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

  const getImageUrl = useCallback((url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") {
      return "/placeholder.svg"
    }
    
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }, [])

  const renderItemInfo = useCallback(() => {
    switch (type) {
      case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
        return (
          <>
            <Image
              src={getImageUrl(item.image_url)}
              alt={item.name || "Категория"}
              width={50}
              height={50}
              className="rounded-md object-cover"
              unoptimized
              onError={(e) => {
                console.error("Category image failed to load:", item.image_url)
                e.currentTarget.src = "/placeholder.svg"
              }}
            />
            <div className="text-center mt-2">
              <div className="font-medium text-xs leading-tight">{item.name || "Без названия"}</div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          </>
        )
      case HOMEPAGE_BLOCK_TYPES.PRODUCTS:
        return (
          <>
            <Package className="h-8 w-8" />
            <div className="text-center mt-2">
              <div className="font-medium text-xs leading-tight">{item.name || "Без названия"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.article && `Арт: ${item.article}`}
                {item.price && ` • ${item.price.toLocaleString()} ₸`}
              </div>
            </div>
          </>
        )
      case HOMEPAGE_BLOCK_TYPES.BRANDS:
        return (
          <>
            <Image
              src={getImageUrl(item.image_url)}
              alt={item.name || "Бренд"}
              width={50}
              height={50}
              className="rounded-md object-cover"
              unoptimized
              onError={(e) => {
                console.error("Brand image failed to load:", item.image_url)
                e.currentTarget.src = "/placeholder.svg"
              }}
            />
            <div className="text-center mt-2">
              <div className="font-medium text-xs leading-tight">{item.name || "Без названия"}</div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          </>
        )
      case HOMEPAGE_BLOCK_TYPES.BENEFITS:
        return (
          <>
            <Star className="h-8 w-8" />
            <div className="text-center mt-2">
              <div className="font-medium text-xs leading-tight">{item.title || "Без названия"}</div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          </>
        )
      case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
        return (
          <>
            <Image
              src={getImageUrl(item.image_url)}
              alt={item.title || "Информационная карточка"}
              width={50}
              height={50}
              className="rounded-md object-cover"
              unoptimized
              onError={(e) => {
                console.error("Info card image failed to load:", item.image_url)
                e.currentTarget.src = "/placeholder.svg"
              }}
            />
            <div className="text-center mt-2">
              <div className="font-medium text-xs leading-tight">{item.title || "Без названия"}</div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          </>
        )
      default:
        return (
          <>
            <Package className="h-8 w-8" />
            <div className="text-center mt-2">
              <div className="font-medium text-xs leading-tight">{item.name || item.title || "Без названия"}</div>
            </div>
          </>
        )
    }
  }, [type, item, getImageUrl])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col items-center space-y-2 p-4 rounded-lg border bg-background w-[140px] h-[140px] ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <GripVertical
        className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing self-start"
        {...attributes}
        {...listeners}
      />
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {renderItemInfo()}
      </div>
    </div>
  )
}

export default function HomepageBlockItemsReorderDialog({ 
  block, 
  open, 
  onOpenChange, 
  onSuccess 
}: HomepageBlockItemsReorderDialogProps) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
          allItems = await getProducts()
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
      const selectedItems = block.items.map(itemId => {
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
        
        return item
      }).filter(Boolean)

      setItems(selectedItems)
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

  const saveOrder = useCallback(async (itemsToSave: any[]) => {
    if (!block) return

    try {
      setIsSaving(true)
      
      const orderData = itemsToSave.map((item, index) => ({
        id: item.id,
        order: index
      }))

      const result = await reorderHomepageBlockItems(block.id, orderData)
      
      if (result.success) {
        toast({
          title: "Успешно",
          description: "Порядок элементов обновлен",
        })
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
  }, [block, toast])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(item => item.id === active.id)
      const newIndex = items.findIndex(item => item.id === over?.id)

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)

      // Автоматически сохраняем новый порядок
      try {
        await saveOrder(newItems)
      } catch (error) {
        console.error("Error saving order:", error)
        // При ошибке не откатываем изменения, чтобы не было мерцания
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить порядок",
          variant: "destructive",
        })
      }
    }
  }, [items, saveOrder, toast])

  if (!block) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[80vh] w-[90vw] h-[80vh]">
        <DialogHeader className="pb-2">
          <DialogTitle>Настройка порядка элементов</DialogTitle>
          <DialogDescription>
            Перетаскивайте элементы для изменения их порядка в блоке "{block.title}"
            {isSaving && " • Сохранение..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 flex-1 flex flex-col">
          <div className="flex items-center space-x-2">
            {(() => {
              switch (block.type) {
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
            })()}
            <span className="text-sm font-medium">
              {HOMEPAGE_BLOCK_TYPE_LABELS[block.type]} ({items.length} элементов)
            </span>
          </div>

          <div className="flex-1 border rounded-lg p-4 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <p className="text-muted-foreground">Загрузка элементов...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Нет элементов для настройки порядка</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={items.map(item => item.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex space-x-4 p-4 min-w-max">
                      {items.map((item) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          type={block.type}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-center pt-2">
            <Button 
              type="button" 
              onClick={() => onOpenChange(false)}
              className="px-8"
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 