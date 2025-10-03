"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GripVertical, Edit, Trash2, Plus, ListOrdered, Loader2, Grid3X3 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { 
  HomepageBlock, 
  HOMEPAGE_BLOCK_TYPE_LABELS, 
  HOMEPAGE_BLOCK_TYPES 
} from "@/lib/constants"
import { 
  getHomepageBlocks, 
  deleteHomepageBlock, 
  toggleHomepageBlock,
  reorderHomepageBlocks
} from "@/app/actions/homepage-blocks"
import HomepageBlockEditDialog from "./homepage-block-edit-dialog"
import HomepageBlockItemsReorderDialogV2 from "./homepage-block-items-reorder-dialog-v2"

// Компонент для сортируемого элемента блока
interface SortableBlockItemProps {
  block: HomepageBlock
  onEdit: (block: HomepageBlock) => void
  onDelete: (id: number) => void
  onToggleActive: (id: number, active: boolean) => void
  onReorderItems: (block: HomepageBlock) => void
  isUpdating: boolean
}

function SortableBlockItem({ 
  block, 
  onEdit, 
  onDelete, 
  onToggleActive, 
  onReorderItems,
  isUpdating 
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }



  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "opacity-50" : ""}`}>
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Drag Handle - как в баннерах */}
            <div className="flex items-center">
              <button
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Type Badge */}
            <div className="flex items-center">
              <Badge variant="outline">{HOMEPAGE_BLOCK_TYPE_LABELS[block.type]}</Badge>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{block.title || "Без названия"}</h3>
                  <div className="text-sm text-gray-500 mt-1">
                    {block.items.length > 0 && (
                      <span>Элементов: {block.items.length}</span>
                    )}
                    <span className="ml-4">Выравнивание: {block.title_align}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls - Centered vertically */}
            <div className="flex items-center gap-3">
              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <Switch 
                  checked={block.active} 
                  onCheckedChange={() => onToggleActive(block.id, block.active)}
                  disabled={isUpdating}
                />
                <span className="text-sm text-gray-600">
                  {block.active ? "Активен" : "Неактивен"}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onReorderItems(block)}
                  disabled={isUpdating || block.items.length === 0}
                  className="h-8 w-8 p-0"
                  title="Настроить порядок элементов"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit(block)} 
                  className="h-8 w-8 p-0"
                  disabled={isUpdating}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(block.id)}
                  disabled={isUpdating}
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

export default function MainBlocksTab() {
  const [blocks, setBlocks] = useState<HomepageBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingBlocks, setUpdatingBlocks] = useState<Set<number>>(new Set())
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<HomepageBlock | null>(null)
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false)
  const [reorderingBlock, setReorderingBlock] = useState<HomepageBlock | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [blockToDelete, setBlockToDelete] = useState<HomepageBlock | null>(null)
  const { toast } = useToast()



  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Загрузка блоков при монтировании компонента
  useEffect(() => {
    loadBlocks()
  }, [])

  const loadBlocks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getHomepageBlocks()
      setBlocks(data)
    } catch (error) {
      console.error("Error loading blocks:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить блоки",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleToggleActive = useCallback(async (blockId: number, currentActive: boolean) => {
    try {
      setUpdatingBlocks(prev => new Set(prev).add(blockId))
      
      // Оптимистичное обновление
      setBlocks(prev => 
        prev.map(block => 
          block.id === blockId ? { ...block, active: !currentActive } : block
        )
      )

      const result = await toggleHomepageBlock(blockId)
      
      if (result.success) {
        toast({
          title: "Успешно",
          description: result.message,
        })
      } else {
        // Откатываем изменения при ошибке
        setBlocks(prev => 
          prev.map(block => 
            block.id === blockId ? { ...block, active: currentActive } : block
          )
        )
        toast({
          title: "Ошибка",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error toggling block:", error)
      // Откатываем изменения при ошибке
      setBlocks(prev => 
        prev.map(block => 
          block.id === blockId ? { ...block, active: currentActive } : block
        )
      )
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус блока",
        variant: "destructive",
      })
    } finally {
      setUpdatingBlocks(prev => {
        const newSet = new Set(prev)
        newSet.delete(blockId)
        return newSet
      })
    }
  }, [toast])

  const handleDeleteClick = useCallback((blockId: number) => {
    const block = blocks.find(b => b.id === blockId)
    if (block) {
      setBlockToDelete(block)
      setDeleteDialogOpen(true)
    }
  }, [blocks])

  const handleConfirmDelete = useCallback(async () => {
    if (!blockToDelete) return

    const blockId = blockToDelete.id
    try {
      setUpdatingBlocks(prev => new Set(prev).add(blockId))
      
      const result = await deleteHomepageBlock(blockId)
      
      if (result.success) {
        setBlocks(prev => prev.filter(block => block.id !== blockId))
        toast({
          title: "Успешно",
          description: result.message,
        })
      } else {
        toast({
          title: "Ошибка",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting block:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить блок",
        variant: "destructive",
      })
    } finally {
      setUpdatingBlocks(prev => {
        const newSet = new Set(prev)
        newSet.delete(blockId)
        return newSet
      })
      setDeleteDialogOpen(false)
      setBlockToDelete(null)
    }
  }, [blockToDelete, toast])

  const handleEdit = useCallback((block: HomepageBlock) => {
    setEditingBlock(block)
    setEditDialogOpen(true)
  }, [])

  const handleAddBlock = useCallback(() => {
    setEditingBlock(null)
    setEditDialogOpen(true)
  }, [])

  const handleEditSuccess = useCallback(() => {
    loadBlocks()
  }, [loadBlocks])

  const handleReorderItems = useCallback((block: HomepageBlock) => {
    setReorderingBlock(block)
    setReorderDialogOpen(true)
  }, [])

  const handleReorderSuccess = useCallback(() => {
    loadBlocks()
  }, [loadBlocks])

  // Мемоизированные значения
  const sortedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => a.order - b.order)
  }, [blocks])

  const activeBlocksCount = useMemo(() => {
    return blocks.filter(block => block.active).length
  }, [blocks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // Сохраняем исходное состояние для возможного отката
      let originalBlocks: HomepageBlock[] = []
      
      // Оптимистичное обновление
      setBlocks(currentBlocks => {
        originalBlocks = [...currentBlocks] // Сохраняем исходное состояние
        const oldIndex = currentBlocks.findIndex(block => block.id === active.id)
        const newIndex = currentBlocks.findIndex(block => block.id === over.id)

        const newBlocks = arrayMove(currentBlocks, oldIndex, newIndex)
        return newBlocks
      })

      // Обновляем порядок на сервере
      try {
        // Получаем новые блоки после оптимистичного обновления
        const newBlocks = arrayMove(originalBlocks, 
          originalBlocks.findIndex(block => block.id === active.id),
          originalBlocks.findIndex(block => block.id === over.id)
        )

        const reorderData = newBlocks.map((block, index) => ({
          id: block.id,
          order: index
        }))
        
        const result = await reorderHomepageBlocks(reorderData)
        
        if (!result.success) {
          // Откатываем изменения при ошибке
          setBlocks(originalBlocks)
          toast({
            title: "Ошибка",
            description: result.error,
            variant: "destructive",
          })
        } else {
          // Загружаем актуальные данные с сервера
          try {
            const updatedBlocks = await getHomepageBlocks()
            setBlocks(updatedBlocks)
            toast({
              title: "Успешно",
              description: "Порядок блоков обновлен",
            })
          } catch (error) {
            console.error("Error loading updated blocks:", error)
            // Если не удалось загрузить обновленные данные, оставляем оптимистичное обновление
            toast({
              title: "Успешно",
              description: "Порядок блоков обновлен",
            })
          }
        }
      } catch (error) {
        console.error("Error reordering blocks:", error)
        // Откатываем изменения при ошибке
        setBlocks(originalBlocks)
        toast({
          title: "Ошибка",
          description: "Не удалось обновить порядок блоков",
          variant: "destructive",
        })
      }
    }
  }, [toast])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Блоки на главной странице</h3>
            <p className="text-sm text-muted-foreground">Управляйте контентными блоками на главной странице</p>
          </div>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Добавить блок
          </Button>
        </div>
        <Card>
          <CardContent className="text-center py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <p className="text-muted-foreground">Загрузка блоков...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка добавления */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Блоки на главной</h2>
          <p className="text-muted-foreground">
            Управление блоками контента на главной странице. Перетаскивайте блоки для изменения порядка.
          </p>
          <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
            <span>Всего блоков: {blocks.length}</span>
            <span>Активных: {activeBlocksCount}</span>
          </div>
        </div>
        <Button onClick={handleAddBlock}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить блок
        </Button>
      </div>

      {/* Список блоков с drag & drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedBlocks.map(block => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {sortedBlocks.length === 0 ? (
              <div className="text-center py-12">
                <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Блоки не найдены</h3>
                <p className="text-muted-foreground mb-4">
                  Создайте первый блок для отображения на главной странице
                </p>
                <Button onClick={handleAddBlock}>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать блок
                </Button>
              </div>
            ) : (
              sortedBlocks.map((block) => (
                <SortableBlockItem
                  key={block.id}
                  block={block}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onToggleActive={handleToggleActive}
                  onReorderItems={handleReorderItems}
                  isUpdating={updatingBlocks.has(block.id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Диалог редактирования */}
      <HomepageBlockEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        block={editingBlock}
        onSuccess={handleEditSuccess}
      />

      {/* Диалог настройки порядка элементов */}
      <HomepageBlockItemsReorderDialogV2
        open={reorderDialogOpen}
        onOpenChange={setReorderDialogOpen}
        block={reorderingBlock}
        onSuccess={handleReorderSuccess}
      />

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить блок</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить блок "{blockToDelete?.title}"?
              <br />
              <br />
              <strong>Это действие нельзя отменить.</strong> Все элементы этого блока будут также удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
