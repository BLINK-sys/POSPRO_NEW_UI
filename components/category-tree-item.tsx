"use client"

import { useState } from "react"
import Image from "next/image"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { type Category, deleteCategory } from "@/app/actions/categories"
import { API_BASE_URL } from "@/lib/api-address"
import { Button } from "@/components/ui/button"
import { GripVertical, ChevronRight, Pencil, Trash2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { CategoryEditDialog } from "./category-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"

interface CategoryTreeItemProps {
  category: Category
  allCategories: Category[]
  level?: number
  onUpdate?: (updatedCategory?: Category) => void
  onDelete?: () => void
}

export function CategoryTreeItem({ category, allCategories, level = 0, onUpdate, onDelete }: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState<Category | null>(null)
  const [isCreatingSub, setIsCreatingSub] = useState(false)
  const [imageKey, setImageKey] = useState(0) // Ключ для принудительного обновления изображения
  const { toast } = useToast()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

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
      onDelete?.()
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
    onUpdate?.(updatedCategory)
  }

  return (
    <div ref={setNodeRef} style={style} className={cn("rounded-md", isDragging && "shadow-lg bg-white")}>
      <div
        className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
        style={{ paddingLeft: `${level * 2 + 0.5}rem` }}
      >
        <button {...attributes} {...listeners} className="cursor-grab p-1 text-gray-400 hover:text-gray-700">
          <GripVertical className="h-5 w-5" />
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsExpanded(!isExpanded)}
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
          <p className="font-medium">{category.name}</p>
          <p className="text-sm text-muted-foreground">{category.slug}</p>
        </div>

        <div className="flex items-center gap-1">
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

      {isExpanded && category.children && category.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              allCategories={allCategories}
              level={level + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

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
    </div>
  )
}
