"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { type Category, deleteCategory, reorderCategories } from "@/app/actions/categories"
import { API_BASE_URL } from "@/lib/api-address"
import { Button } from "@/components/ui/button"
import { ChevronRight, Pencil, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { CategoryEditDialog } from "./category-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { ParentCategoryDialog } from "./parent-category-dialog"
import { useToast } from "./ui/use-toast"
import { Switch } from "@/components/ui/switch"
import { updateCategoryShowInMenu, saveCategory } from "@/app/actions/categories"
import { ArrowRightLeft } from "lucide-react"

interface CategoryTreeItemProps {
  category: Category
  allCategories: Category[]
  rootCategories?: Category[]
  expandedCategories?: Set<number>
  highlightedCategories?: Set<number>
  level?: number
  onToggle?: (categoryId: number, isExpanded: boolean) => void
  onUpdate?: (updatedCategory?: Category) => void
  onDelete?: (categoryId: number) => void
  onReorder?: (optimisticUpdate?: (categories: Category[]) => Category[]) => void
}

export function CategoryTreeItem({ 
  category, 
  allCategories, 
  rootCategories, 
  expandedCategories = new Set(),
  highlightedCategories = new Set(),
  level = 0,
  onToggle,
  onUpdate, 
  onDelete, 
  onReorder 
}: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState<Category | null>(null)
  const [isCreatingSub, setIsCreatingSub] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [imageKey, setImageKey] = useState(0) // Ключ для принудительного обновления изображения
  const [showInMenu, setShowInMenu] = useState(category.show_in_menu ?? true)
  const [isUpdatingShowInMenu, setIsUpdatingShowInMenu] = useState(false)
  const [isReordering, startReorderTransition] = useTransition()
  const [isMovingCategory, setIsMovingCategory] = useState(false)
  const { toast } = useToast()

  // Синхронизируем состояние переключателя с данными категории
  useEffect(() => {
    if (category?.show_in_menu !== undefined) {
      setShowInMenu(category.show_in_menu)
    }
  }, [category?.show_in_menu])

  // Автоматически разворачиваем/сворачиваем категории на основе expandedCategories
  // Используем ref для отслеживания последнего ручного переключения
  const manualToggleRef = useRef<{ categoryId: number; timestamp: number } | null>(null)

  useEffect(() => {
    if (category.id) {
      const shouldBeExpanded = expandedCategories.has(category.id)
      // Проверяем, было ли недавно ручное переключение этой категории
      const recentManualToggle = manualToggleRef.current?.categoryId === category.id && 
                                 Date.now() - manualToggleRef.current.timestamp < 100 // 100ms окно
      
      // Если это не недавнее ручное переключение, обновляем состояние
      if (!recentManualToggle) {
        setIsExpanded(shouldBeExpanded)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, expandedCategories])

  // Определяем, нужно ли подсветить категорию
  const isHighlighted = category.id ? highlightedCategories.has(category.id) : false

  const getImageUrl = (url: string | null) => {
    if (!url) return "/placeholder.svg?width=40&height=40"
    if (url.startsWith("http")) return `${url}?v=${imageKey}`
    return `${API_BASE_URL}${url}?v=${imageKey}`
  }

  const handleDelete = async () => {
    if (!isDeleting || !isDeleting.id) return
    const result = await deleteCategory(isDeleting.id)
    if (result.success) {
      toast({ title: "Успех!", description: result.message })
      onDelete?.(isDeleting.id)
    } else {
      toast({ variant: "destructive", title: "Ошибка", description: result.error })
    }
    setIsDeleting(null)
  }

  const handleEdit = () => {
    if (!category.id) {
      toast({ variant: "destructive", title: "Ошибка", description: "ID категории не найден" })
      return
    }
    setIsEditing(true)
  }

  const handleCreateSub = () => {
    if (!category.id) {
      toast({ variant: "destructive", title: "Ошибка", description: "ID категории не найден" })
      return
    }
    setIsCreatingSub(true)
  }

  const handleUpdateWithImageRefresh = (updatedCategory?: Category) => {
    // Обновляем ключ изображения для принудительного обновления
    setImageKey((prev) => prev + 1)
    if (updatedCategory?.show_in_menu !== undefined) {
      setShowInMenu(updatedCategory.show_in_menu)
    }
    onUpdate?.(updatedCategory)
  }

  const handleShowInMenuToggle = async (checked: boolean) => {
    if (!category.id) return
    
    // Оптимистичное обновление
    const previousValue = showInMenu
    setShowInMenu(checked)
    setIsUpdatingShowInMenu(true)

    try {
      const result = await updateCategoryShowInMenu(category.id, checked)
      if (result.error) {
        // Откатываем при ошибке
        setShowInMenu(previousValue)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: result.error,
        })
      } else {
        // Обновляем категорию в списке
        const updatedCategory: Category = {
          ...category,
          show_in_menu: checked,
        }
        
        // Если категория отключается, обновляем весь список, чтобы обновить дочерние категории
        if (!checked) {
          // Полное обновление списка для отражения изменений в дочерних категориях
          onUpdate?.()
        } else {
          onUpdate?.(updatedCategory)
        }
      }
    } catch (error) {
      // Откатываем при ошибке
      setShowInMenu(previousValue)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить статус отображения в меню",
      })
    } finally {
      setIsUpdatingShowInMenu(false)
    }
  }

  // Получить все категории с тем же parent_id (соседи)
  const getSiblings = (): Category[] => {
    if (category.parent_id) {
      // Ищем родительскую категорию в дереве и возвращаем её children
      const findParent = (cats: Category[]): Category | null => {
        for (const cat of cats) {
          if (cat.id === category.parent_id) {
            return cat
          }
          if (cat.children && cat.children.length > 0) {
            const found = findParent(cat.children)
            if (found) return found
          }
        }
        return null
      }
      
      // Если переданы rootCategories, используем их для поиска
      const searchRoot = rootCategories || allCategories.filter((c) => !c.parent_id)
      const parent = findParent(searchRoot)
      
      if (parent?.children) {
        return parent.children
      }
      
      // Если родитель не найден в дереве, ищем в плоском списке
      return allCategories.filter((c) => c.parent_id === category.parent_id)
    } else {
      // Корневые категории - используем переданные rootCategories или фильтруем из allCategories
      return rootCategories || allCategories.filter((c) => !c.parent_id)
    }
  }

  const handleMoveUp = () => {
    if (!category.id) return
    
    const siblings = getSiblings()
    const currentIndex = siblings.findIndex((c) => c.id === category.id)
    
    if (currentIndex <= 0) {
      toast({
        variant: "default",
        title: "Информация",
        description: "Категория уже находится в начале списка",
      })
      return
    }

    // Оптимистичное обновление для анимации
    const optimisticUpdate = (categories: Category[]): Category[] => {
      if (!category.parent_id) {
        // Корневая категория - обновляем порядок в корневом списке
        const rootCategories = categories.filter((c) => !c.parent_id)
        const currentIndex = rootCategories.findIndex((c) => c.id === category.id)
        if (currentIndex > 0) {
          const newCategories = [...categories]
          const rootIndex = newCategories.findIndex((c) => !c.parent_id && c.id === category.id)
          const prevRootIndex = newCategories.findIndex((c) => !c.parent_id && rootCategories[currentIndex - 1].id === c.id)
          if (rootIndex >= 0 && prevRootIndex >= 0) {
            const [movedItem] = newCategories.splice(rootIndex, 1)
            newCategories.splice(prevRootIndex, 0, movedItem)
            return newCategories
          }
        }
      } else {
        // Вложенная категория - обновляем в родительской категории
        const updateSiblingsInTree = (cats: Category[]): Category[] => {
          return cats.map((cat) => {
            if (cat.id === category.parent_id) {
              // Это родитель - обновляем его children
              const children = cat.children || []
              const childIndex = children.findIndex((c) => c.id === category.id)
              if (childIndex > 0) {
                const newChildren = [...children]
                const [movedItem] = newChildren.splice(childIndex, 1)
                newChildren.splice(childIndex - 1, 0, movedItem)
                return { ...cat, children: newChildren }
              }
            }
            if (cat.children && cat.children.length > 0) {
              return { ...cat, children: updateSiblingsInTree(cat.children) }
            }
            return cat
          })
        }
        return updateSiblingsInTree(categories)
      }
      return categories
    }

    // Вызываем оптимистичное обновление
    onReorder?.(optimisticUpdate)

    startReorderTransition(async () => {
      try {
        // Меняем местами с предыдущей категорией
        const newSiblings = [...siblings]
        const [movedItem] = newSiblings.splice(currentIndex, 1)
        newSiblings.splice(currentIndex - 1, 0, movedItem)

        // Обновляем порядок
        const updatedOrder = newSiblings.map((cat, index) => ({ id: cat.id, order: index }))

        const result = await reorderCategories(updatedOrder)
        if (result.success) {
          toast({ title: "Успех!", description: "Порядок категорий обновлен" })
          // Обновляем после успешного ответа сервера
          onReorder?.()
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.error })
          // При ошибке обновляем список, чтобы откатить оптимистичное обновление
          onReorder?.()
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Ошибка", description: "Не удалось изменить порядок категорий" })
        // При ошибке обновляем список, чтобы откатить оптимистичное обновление
        onReorder?.()
      }
    })
  }

  const handleMoveDown = () => {
    if (!category.id) return
    
    const siblings = getSiblings()
    const currentIndex = siblings.findIndex((c) => c.id === category.id)
    
    if (currentIndex < 0 || currentIndex >= siblings.length - 1) {
      toast({
        variant: "default",
        title: "Информация",
        description: "Категория уже находится в конце списка",
      })
      return
    }

    // Оптимистичное обновление для анимации
    const optimisticUpdate = (categories: Category[]): Category[] => {
      if (!category.parent_id) {
        // Корневая категория - обновляем порядок в корневом списке
        const rootCategories = categories.filter((c) => !c.parent_id)
        const currentIndex = rootCategories.findIndex((c) => c.id === category.id)
        if (currentIndex >= 0 && currentIndex < rootCategories.length - 1) {
          const newCategories = [...categories]
          const rootIndex = newCategories.findIndex((c) => !c.parent_id && c.id === category.id)
          const nextRootIndex = newCategories.findIndex((c) => !c.parent_id && rootCategories[currentIndex + 1].id === c.id)
          if (rootIndex >= 0 && nextRootIndex >= 0) {
            const [movedItem] = newCategories.splice(rootIndex, 1)
            newCategories.splice(nextRootIndex, 0, movedItem)
            return newCategories
          }
        }
      } else {
        // Вложенная категория - обновляем в родительской категории
        const updateSiblingsInTree = (cats: Category[]): Category[] => {
          return cats.map((cat) => {
            if (cat.id === category.parent_id) {
              // Это родитель - обновляем его children
              const children = cat.children || []
              const childIndex = children.findIndex((c) => c.id === category.id)
              if (childIndex >= 0 && childIndex < children.length - 1) {
                const newChildren = [...children]
                const [movedItem] = newChildren.splice(childIndex, 1)
                newChildren.splice(childIndex + 1, 0, movedItem)
                return { ...cat, children: newChildren }
              }
            }
            if (cat.children && cat.children.length > 0) {
              return { ...cat, children: updateSiblingsInTree(cat.children) }
            }
            return cat
          })
        }
        return updateSiblingsInTree(categories)
      }
      return categories
    }

    // Вызываем оптимистичное обновление
    onReorder?.(optimisticUpdate)

    startReorderTransition(async () => {
      try {
        // Меняем местами со следующей категорией
        const newSiblings = [...siblings]
        const [movedItem] = newSiblings.splice(currentIndex, 1)
        newSiblings.splice(currentIndex + 1, 0, movedItem)

        // Обновляем порядок
        const updatedOrder = newSiblings.map((cat, index) => ({ id: cat.id, order: index }))

        const result = await reorderCategories(updatedOrder)
        if (result.success) {
          toast({ title: "Успех!", description: "Порядок категорий обновлен" })
          // Обновляем после успешного ответа сервера
          onReorder?.()
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.error })
          // При ошибке обновляем список, чтобы откатить оптимистичное обновление
          onReorder?.()
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Ошибка", description: "Не удалось изменить порядок категорий" })
        // При ошибке обновляем список, чтобы откатить оптимистичное обновление
        onReorder?.()
      }
    })
  }

  // Проверяем, можно ли переместить категорию вверх или вниз
  const siblings = getSiblings()
  const currentIndex = siblings.findIndex((c) => c.id === category.id)
  const canMoveUp = currentIndex > 0
  const canMoveDown = currentIndex >= 0 && currentIndex < siblings.length - 1

  return (
    <motion.div
      className="rounded-md"
      layout="position"
      style={{ paddingLeft: level > 0 ? `${level * 2.5}rem` : '0' }}
      transition={{
        layout: { duration: 0.3, ease: "easeInOut" }
      }}
    >
      <div
        className={cn(
          "flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-700 shadow-md",
          isHighlighted && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            if (!category.id) return
            const newExpandedState = !isExpanded
            // Помечаем, что это ручное переключение с временной меткой
            manualToggleRef.current = { categoryId: category.id, timestamp: Date.now() }
            setIsExpanded(newExpandedState)
            if (onToggle) {
              onToggle(category.id, newExpandedState)
            }
          }}
          disabled={!category.children || category.children.length === 0}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded && "rotate-90",
              (!category.children || category.children.length === 0) && "opacity-0",
            )}
          />
        </Button>

        <Image
          src={getImageUrl(category.image_url) || "/placeholder.svg"}
          alt={category.name}
          width={40}
          height={40}
          className="rounded-md object-cover"
          unoptimized
          key={`${category.id}-${imageKey}`} // Принудительное обновление при изменении ключа
        />
        <div className="flex-grow">
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {category.name}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {category.slug}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Кнопка перемещения */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Переместить категорию"
            onClick={() => setIsMoving(true)}
            disabled={isMovingCategory || isReordering}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          {/* Разделительная полоса */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
          {/* Кнопки управления порядком */}
          <div className="flex items-center gap-1 border-r pr-2 mr-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Переместить вверх"
              onClick={handleMoveUp}
              disabled={!canMoveUp || isReordering}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Переместить вниз"
              onClick={handleMoveDown}
              disabled={!canMoveDown || isReordering}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 px-2">
            <Switch
              checked={showInMenu}
              onCheckedChange={handleShowInMenuToggle}
              disabled={isUpdatingShowInMenu}
              title={showInMenu ? "Отображается в меню" : "Скрыта в меню"}
            />
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {showInMenu ? "В меню" : "Скрыта"}
            </span>
          </div>
          {/* Разделительная полоса */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
          <Button variant="ghost" size="icon" title="Добавить подкатегорию" onClick={handleCreateSub}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Редактировать" onClick={handleEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Удалить"
            className="text-red-500 hover:text-red-600"
            onClick={() => setIsDeleting(category)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && category.children && category.children.length > 0 ? (
        <div className="mt-1 space-y-1">
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              allCategories={allCategories}
              rootCategories={rootCategories}
              expandedCategories={expandedCategories}
              highlightedCategories={highlightedCategories}
              level={level + 1}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onReorder={onReorder}
            />
          ))}
        </div>
      ) : null}

      {isEditing && (
        <CategoryEditDialog
          category={category}
          allCategories={allCategories}
          onClose={() => setIsEditing(false)}
          onUpdate={handleUpdateWithImageRefresh}
        />
      )}
      {isCreatingSub && (
        <CategoryEditDialog
          allCategories={allCategories}
          parentId={category.id}
          onClose={() => setIsCreatingSub(false)}
          onUpdate={onUpdate}
        />
      )}
      <DeleteConfirmationDialog
        open={!!isDeleting}
        onOpenChange={(open) => !open && setIsDeleting(null)}
        onConfirm={handleDelete}
        title={`Удалить категорию "${isDeleting?.name}"?`}
        description="Это действие нельзя будет отменить. Все дочерние категории также будут удалены."
      />
      {isMoving && (
        <ParentCategoryDialog
          open={isMoving}
          onOpenChange={setIsMoving}
          categories={rootCategories || allCategories.filter((c) => !c.parent_id)}
          selectedCategoryId={category.parent_id || null}
          onSelect={async (newParentId) => {
            if (!category.id) return
            
            setIsMovingCategory(true)
            try {
              // Создаем FormData для обновления категории
              // Используем текущие данные категории
              const formData = new FormData()
              formData.append("id", String(category.id))
              formData.append("name", category.name)
              formData.append("slug", category.slug)
              formData.append("description", category.description || "")
              formData.append("parent_id", newParentId ? String(newParentId) : "0")
              formData.append("show_in_menu", String(category.show_in_menu ?? true))
              
              const result = await saveCategory(formData)
              
              if (result.error) {
                toast({
                  variant: "destructive",
                  title: "Ошибка",
                  description: result.error,
                })
              } else {
                toast({
                  title: "Успех!",
                  description: "Категория успешно перемещена",
                })
                setIsMoving(false)
                // Обновляем список категорий
                onUpdate?.()
              }
            } catch (error) {
              toast({
                variant: "destructive",
                title: "Ошибка",
                description: "Не удалось переместить категорию",
              })
            } finally {
              setIsMovingCategory(false)
            }
          }}
          excludeCategoryId={category.id}
          title="Переместить категорию"
        />
      )}
    </motion.div>
  )
}
