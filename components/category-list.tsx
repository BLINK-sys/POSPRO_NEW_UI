"use client"

import { useState, useCallback } from "react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { type Category, reorderCategories, getCategories } from "@/app/actions/categories"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { CategoryTreeItem } from "./category-tree-item"
import { CategoryEditDialog } from "./category-edit-dialog"
import { useToast } from "./ui/use-toast"

function flattenTree(tree: Category[]): Category[] {
  return tree.reduce<Category[]>((acc, category) => {
    acc.push(category)
    if (category.children && category.children.length > 0) {
      acc.push(...flattenTree(category.children))
    }
    return acc
  }, [])
}

function buildTree(flatList: Category[]): Category[] {
  const map = new Map(flatList.map((cat) => [cat.id, { ...cat, children: [] }]))
  const roots: Category[] = []
  for (const category of map.values()) {
    if (category.parent_id && map.has(category.parent_id)) {
      map.get(category.parent_id)!.children.push(category)
    } else {
      roots.push(category)
    }
  }
  for (const category of map.values()) {
    if (category.children.length > 0) {
      category.children.sort((a, b) => a.order - b.order)
    }
  }
  return roots.sort((a, b) => a.order - b.order)
}

export function CategoryList({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const updateCategories = useCallback(async () => {
    const updatedCategories = await getCategories()
    setCategories(updatedCategories)
  }, [])

  const handleCategoryUpdate = useCallback(
    (updatedCategory?: Category) => {
      if (updatedCategory) {
        // Обновляем конкретную категорию с сохранением структуры дерева
        setCategories((prevCategories) => {
          const updateCategoryInTree = (categories: Category[]): Category[] => {
            return categories.map((cat) => {
              if (cat.id === updatedCategory.id) {
                // Сохраняем children из предыдущего состояния
                return { ...updatedCategory, children: cat.children }
              }
              if (cat.children && cat.children.length > 0) {
                return { ...cat, children: updateCategoryInTree(cat.children) }
              }
              return cat
            })
          }
          return updateCategoryInTree(prevCategories)
        })
      } else {
        // Полное обновление - получаем новую структуру с сервера
        updateCategories()
      }
    },
    [updateCategories],
  )

  const handleCategoryDelete = useCallback(() => {
    // При удалении обновляем весь список
    updateCategories()
  }, [updateCategories])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const flatCategories = flattenTree(categories)
        const oldIndex = flatCategories.findIndex((c) => c.id === active.id)
        const newIndex = flatCategories.findIndex((c) => c.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const activeCategory = flatCategories[oldIndex]
        const overCategory = flatCategories[newIndex]

        // Разрешаем перетаскивание только в рамках одного родителя
        if (activeCategory.parent_id !== overCategory.parent_id) {
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: "Перемещение между разными уровнями не поддерживается.",
          })
          return
        }

        const parentId = activeCategory.parent_id
        const siblings = parentId ? (flatCategories.find((c) => c.id === parentId)?.children ?? []) : categories

        const oldSiblingIndex = siblings.findIndex((c) => c.id === active.id)
        const newSiblingIndex = siblings.findIndex((c) => c.id === over.id)

        const newSiblings = Array.from(siblings)
        const [movedItem] = newSiblings.splice(oldSiblingIndex, 1)
        newSiblings.splice(newSiblingIndex, 0, movedItem)

        const updatedOrder = newSiblings.map((cat, index) => ({ id: cat.id, order: index }))

        // Оптимистичное обновление
        const newCategories = JSON.parse(JSON.stringify(categories))
        const update = (cats: Category[]): Category[] => {
          return cats.map((c) => {
            if (c.id === parentId) {
              c.children = newSiblings
            } else if (c.children?.length) {
              c.children = update(c.children)
            }
            return c
          })
        }

        if (parentId) {
          setCategories(update(newCategories))
        } else {
          setCategories(newSiblings)
        }

        // Запрос к серверу
        toast({ title: "Сохранение...", description: "Обновляем порядок категорий." })
        reorderCategories(updatedOrder).then((result) => {
          if (result.success) {
            toast({ title: "Успех!", description: result.message })
          } else {
            toast({ variant: "destructive", title: "Ошибка", description: result.error })
            // Если ошибка, откатываем изменения (опционально)
            setCategories(categories)
          }
        })
      }
    },
    [categories, toast],
  )

  const flatCategories = flattenTree(categories)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setCreateModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Создать категорию
          </Button>
        </div>
        <div className="rounded-lg border p-4 space-y-2 bg-gray-50/50 dark:bg-gray-800/20">
          <SortableContext items={flatCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {categories.map((category) => (
              <CategoryTreeItem
                key={category.id}
                category={category}
                allCategories={flatCategories}
                onUpdate={handleCategoryUpdate}
                onDelete={handleCategoryDelete}
              />
            ))}
            {categories.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">Категорий пока нет.</p>
            )}
          </SortableContext>
        </div>
      </div>
      {isCreateModalOpen && (
        <CategoryEditDialog
          allCategories={flatCategories}
          onClose={() => setCreateModalOpen(false)}
          onUpdate={handleCategoryUpdate}
        />
      )}
    </DndContext>
  )
}
