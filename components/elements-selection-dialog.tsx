"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, ChevronRight, ChevronDown, Check } from "lucide-react"
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

interface ElementsSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blockType: string
  selectedItems: number[]
  onItemsChange: (items: number[]) => void
}

interface CategoryTreeItemProps {
  category: any
  level: number
  selectedItems: number[]
  onToggleItem: (itemId: number) => void
  getImageUrl: (url: string | null | undefined) => string
}

function CategoryTreeItem({ 
  category, 
  level, 
  selectedItems, 
  onToggleItem,
  getImageUrl
}: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = category.children && category.children.length > 0
  const isSelected = selectedItems.includes(category.id)

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleSelect = () => {
    onToggleItem(category.id)
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
          isSelected && "bg-blue-100 dark:bg-blue-900"
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
      >
        {/* Кнопка разворачивания */}
        <button
          onClick={handleToggle}
          className={cn(
            "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
            !hasChildren && "invisible"
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          )}
        </button>

        {/* Чекбокс выбора */}
        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            isSelected 
              ? "bg-blue-500 border-blue-500" 
              : "border-gray-300 dark:border-gray-600"
          )}
          onClick={handleSelect}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

                 {/* Изображение и название */}
         <div className="flex items-center space-x-2 flex-1">
           <Image
             src={category.image_url ? getImageUrl(category.image_url) : "/placeholder.svg"}
             alt={category.name || "Категория"}
             width={24}
             height={24}
             className="rounded object-cover"
             unoptimized
             onError={(e) => {
               e.currentTarget.src = "/placeholder.svg"
             }}
           />
           <span className="flex-1 text-sm">
             {category.name || "Без названия"}
           </span>
         </div>
      </div>

             {/* Дочерние категории */}
       {isExpanded && hasChildren && (
         <div className="mt-1 space-y-1">
           {category.children!.map((child: any) => (
             <CategoryTreeItem
               key={child.id}
               category={child}
               level={level + 1}
               selectedItems={selectedItems}
               onToggleItem={onToggleItem}
               getImageUrl={getImageUrl}
             />
           ))}
         </div>
       )}
    </div>
  )
}

export function ElementsSelectionDialog({
  open,
  onOpenChange,
  blockType,
  selectedItems,
  onItemsChange
}: ElementsSelectionDialogProps) {
  const [elements, setElements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
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



  // Загрузка элементов при открытии диалога
  useEffect(() => {
    if (open) {
      loadElements()
      setSearchTerm("")
    }
  }, [open, blockType])

  const loadElements = async () => {
    try {
      setLoading(true)
      let data: any[] = []
      
      switch (blockType) {
        case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
          data = await getCategories()
          break
        case HOMEPAGE_BLOCK_TYPES.PRODUCTS:
          data = await getProducts()
          break
        case HOMEPAGE_BLOCK_TYPES.BRANDS:
          data = await getBrands()
          break
        case HOMEPAGE_BLOCK_TYPES.BENEFITS:
          data = await getBenefits()
          break
        case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
          data = await getSmallBanners()
          break
        default:
          data = []
      }
      
      setElements(data || [])
    } catch (error) {
      console.error("Error loading elements:", error)
      toast({
        title: "Ошибка",
        description: `Не удалось загрузить элементы: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        variant: "destructive",
      })
      setElements([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleItem = (itemId: number) => {
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId]
    onItemsChange(newSelection)
  }

  const handleSelectAll = () => {
    const allIds = blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES
      ? getAllCategoryIds(elements)
      : elements.map(el => el.id)
    onItemsChange(allIds)
  }

  const handleClearAll = () => {
    onItemsChange([])
  }

  const getAllCategoryIds = (categories: any[]): number[] => {
    let ids: number[] = []
    for (const category of categories) {
      ids.push(category.id)
      if (category.children && category.children.length > 0) {
        ids.push(...getAllCategoryIds(category.children))
      }
    }
    return ids
  }

  // Фильтрация элементов
  const filteredElements = elements.filter(element => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    
    if (blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES) {
      return element.name?.toLowerCase().includes(searchLower)
    } else if (blockType === HOMEPAGE_BLOCK_TYPES.PRODUCTS) {
      return element.name?.toLowerCase().includes(searchLower) || 
             element.article?.toLowerCase().includes(searchLower)
    } else if (blockType === HOMEPAGE_BLOCK_TYPES.BRANDS) {
      return element.name?.toLowerCase().includes(searchLower)
    } else if (blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS) {
      return element.title?.toLowerCase().includes(searchLower) ||
             (element.description && element.description.toLowerCase().includes(searchLower))
    } else if (blockType === HOMEPAGE_BLOCK_TYPES.INFO_CARDS) {
      return element.title?.toLowerCase().includes(searchLower) ||
             (element.description && element.description.toLowerCase().includes(searchLower))
    }
    
    return true
  })

  const renderElementItem = (element: any) => {
    const isSelected = selectedItems.includes(element.id)
    
    // Определяем правильное поле для изображения в зависимости от типа
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
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group relative",
          isSelected && "bg-blue-100 dark:bg-blue-900"
        )}
        onClick={() => handleToggleItem(element.id)}
      >
        {/* Чекбокс */}
        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            isSelected 
              ? "bg-blue-500 border-blue-500" 
              : "border-gray-300 dark:border-gray-600"
          )}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

        {/* Изображение/Иконка */}
        {blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS && element.icon ? (
          // Для преимуществ используем иконки Lucide
          <div className="w-6 h-6 flex items-center justify-center">
            {getIcon(element.icon, "w-5 h-5 text-gray-600")}
          </div>
        ) : (
          // Для остальных типов используем изображения
          <Image
            src={getImageUrl(imageSource)}
            alt={element.name || element.title || "Элемент"}
            width={24}
            height={24}
            className="rounded object-cover"
            unoptimized
            onError={(e) => {
              console.error(`Failed to load image for ${blockType}:`, imageSource)
              e.currentTarget.src = "/placeholder.svg"
            }}
          />
        )}

        {/* Название */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {element.name || element.title || "Без названия"}
          </div>
        </div>

        {/* Дополнительные бейджи для продуктов */}
        {blockType === HOMEPAGE_BLOCK_TYPES.PRODUCTS && element.price && (
          <Badge variant="outline" className="text-xs">
            {element.price.toLocaleString()} ₸
          </Badge>
        )}
      </div>
    )
  }

     return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
         <DialogHeader className="flex-shrink-0">
           <DialogTitle className="flex items-center gap-2">
             Выбор элементов
             <Badge variant="outline">
               {HOMEPAGE_BLOCK_TYPE_LABELS[blockType]}
             </Badge>
           </DialogTitle>
         </DialogHeader>

         <div className="flex-1 flex flex-col min-h-0 space-y-4">
           {/* Поиск */}
           <div className="relative flex-shrink-0">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
             <Input
               placeholder="Поиск элементов..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-10"
               style={{
                 outline: 'none !important',
                 boxShadow: 'none !important',
                 borderColor: 'rgb(209 213 219) !important'
               }}
               onFocus={(e) => {
                 e.target.style.outline = 'none'
                 e.target.style.boxShadow = 'none'
                 e.target.style.borderColor = 'rgb(209 213 219)'
               }}
             />
           </div>

           {/* Кнопки управления */}
           <div className="flex gap-2 flex-shrink-0">
             <Button variant="outline" size="sm" onClick={handleSelectAll}>
               Выбрать все
             </Button>
             <Button variant="outline" size="sm" onClick={handleClearAll}>
               Очистить
             </Button>
           </div>

           {/* Список элементов */}
           <div className="flex-1 min-h-0">
             <ScrollArea className="h-full">
               {loading ? (
                 <div className="flex items-center justify-center py-8">
                   <Loader2 className="h-6 w-6 animate-spin mr-2" />
                   <span>Загрузка элементов...</span>
                 </div>
               ) : filteredElements.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">
                   {searchTerm ? "Элементы не найдены" : "Элементы не найдены"}
                 </div>
               ) : (
                 <div className="space-y-1 p-1">
                   {blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES ? (
                     // Иерархическое дерево для категорий
                     filteredElements.map((category) => (
                       <CategoryTreeItem
                         key={category.id}
                         category={category}
                         level={0}
                         selectedItems={selectedItems}
                         onToggleItem={handleToggleItem}
                         getImageUrl={getImageUrl}
                       />
                     ))
                   ) : (
                     // Обычный список для остальных типов
                     filteredElements.map(renderElementItem)
                   )}
                 </div>
               )}
             </ScrollArea>
           </div>

           {/* Информация о выбранных элементах */}
           <div className="border-t pt-4 flex-shrink-0">
             <div className="flex items-center justify-between mb-2">
               <h4 className="font-medium">Выбрано элементов:</h4>
               <span className="text-sm text-muted-foreground">
                 {selectedItems.length} из {elements.length}
               </span>
             </div>
           </div>
         </div>

         <DialogFooter className="flex-shrink-0">
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Отмена
           </Button>
           <Button onClick={() => onOpenChange(false)}>
             Готово
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   )
}
