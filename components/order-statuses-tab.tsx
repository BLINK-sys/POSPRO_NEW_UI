'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useToast } from '@/hooks/use-toast'
import { 
  getOrderStatuses, 
  createOrderStatus, 
  updateOrderStatus, 
  deleteOrderStatus,
  type OrderStatus,
  type CreateOrderStatusData
} from '@/app/actions/order-statuses'
import { reorderOrderStatuses } from '@/app/actions/order-statuses-reorder'

// Компонент для сортируемого элемента статуса заказа
interface SortableOrderStatusItemProps {
  status: OrderStatus
  onEdit: (status: OrderStatus) => void
  onDelete: (status: OrderStatus) => void
}

function SortableOrderStatusItem({ 
  status, 
  onEdit, 
  onDelete 
}: SortableOrderStatusItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="border-b border-gray-200 last:border-b-0">
      <div className="flex items-center py-3 px-4 hover:bg-gray-50">
        {/* Ручка для перетягивания */}
        <div className="w-12 flex justify-center">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Статус */}
        <div className="flex-1 px-4">
          <Badge
            style={{
              backgroundColor: status.background_color,
              color: status.text_color,
            }}
            className="px-3 py-1 text-sm font-medium"
          >
            {status.name}
          </Badge>
          {!status.is_active && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Неактивен
            </Badge>
          )}
          {status.is_final && (
            <Badge variant="outline" className="ml-2 text-xs">
              Финальный
            </Badge>
          )}
        </div>

        {/* Описание */}
        <div className="flex-1 px-4 text-sm text-gray-700">
          {status.description || "Без описания"}
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center space-x-2 px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(status)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(status)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface OrderStatusFormData {
  name: string
  description: string
  background_color: string
  text_color: string
  is_active: boolean
  is_final: boolean
}

const defaultFormData: OrderStatusFormData = {
  name: '',
  description: '',
  background_color: '#e5e7eb',
  text_color: '#374151',
  is_active: true,
  is_final: false
}

export function OrderStatusesTab() {
  const [statuses, setStatuses] = useState<OrderStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingStatus, setEditingStatus] = useState<OrderStatus | null>(null)
  const [deletingStatus, setDeletingStatus] = useState<OrderStatus | null>(null)
  const [formData, setFormData] = useState<OrderStatusFormData>(defaultFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { toast } = useToast()

  // Настройка сенсоров для drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const fetchStatuses = async () => {
    setIsLoading(true)
    try {
      const result = await getOrderStatuses()
      if (result.success) {
        setStatuses(result.data)
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить статусы заказов',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatuses()
  }, [])



  const handleCreate = () => {
    setEditingStatus(null)
    setFormData(defaultFormData)
    setIsDialogOpen(true)
  }

  const handleEdit = (status: OrderStatus) => {
    setEditingStatus(status)
    setFormData({
      name: status.name,
      description: status.description || '',
      background_color: status.background_color,
      text_color: status.text_color,
      is_active: status.is_active,
      is_final: status.is_final
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (status: OrderStatus) => {
    setDeletingStatus(status)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      let result
      if (editingStatus) {
        result = await updateOrderStatus(editingStatus.id, formData)
      } else {
        result = await createOrderStatus(formData)
      }

      if (result.success) {
        toast({
          title: 'Успешно',
          description: editingStatus ? 'Статус заказа обновлен' : 'Статус заказа создан'
        })
        setIsDialogOpen(false)
        fetchStatuses()
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при сохранении',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingStatus) return

    try {
      const result = await deleteOrderStatus(deletingStatus.id)
      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Статус заказа удален'
        })
        fetchStatuses()
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить статус',
        variant: 'destructive'
      })
    } finally {
      setIsDeleteDialogOpen(false)
      setDeletingStatus(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = statuses.findIndex((status) => status.id === active.id)
      const newIndex = statuses.findIndex((status) => status.id === over?.id)

      const newStatuses = arrayMove(statuses, oldIndex, newIndex)
      setStatuses(newStatuses)

      // Обновляем порядок на сервере
      try {
        const newOrder = newStatuses.map(status => status.id)
        const result = await reorderOrderStatuses(newOrder)
        
        if (result.success) {
          toast({
            title: 'Порядок обновлен',
            description: 'Порядок статусов успешно изменен'
          })
        } else {
          toast({
            title: 'Ошибка',
            description: result.error || 'Не удалось изменить порядок',
            variant: 'destructive'
          })
          fetchStatuses() // Перезагружаем исходный порядок
        }
      } catch (error) {
        console.error("Error reordering statuses:", error)
        toast({ 
          title: "Ошибка", 
          description: "Не удалось сохранить порядок", 
          variant: "destructive" 
        })
        fetchStatuses() // Перезагружаем исходный порядок
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Статусы заказов</h2>
          <p className="text-muted-foreground">
            Управление статусами заказов с настраиваемыми цветами
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить статус
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingStatus ? 'Редактировать статус' : 'Создать статус'}
              </DialogTitle>
              <DialogDescription>
                Настройте внешний вид и свойства статуса заказа
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">


              <div>
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  placeholder="В ожидании, Подтверждён..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Описание статуса..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="background_color">Цвет фона *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background_color"
                      type="color"
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      className="w-12 h-10 p-1 rounded"
                    />
                    <Input
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      placeholder="#e5e7eb"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="text_color">Цвет текста *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="text_color"
                      type="color"
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="w-12 h-10 p-1 rounded"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      placeholder="#374151"
                    />
                  </div>
                </div>
              </div>



              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Активный статус</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_final"
                  checked={formData.is_final}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_final: checked })}
                />
                <Label htmlFor="is_final">Финальный статус</Label>
              </div>

              {/* Preview */}
              <div>
                <Label>Предварительный просмотр</Label>
                <div className="mt-2">
                  <Badge 
                    style={{
                      backgroundColor: formData.background_color,
                      color: formData.text_color
                    }}
                  >
                    {formData.name || 'Название статуса'}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !formData.name.trim()}
              >
                {isSubmitting ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Список статусов */}
      {statuses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Статусы заказов не найдены</p>
            <Button className="mt-4" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Создать первый статус
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Заголовки таблицы */}
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center py-3 px-4 text-sm font-medium text-gray-700">
              <div className="w-12 flex justify-center">
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 px-4">Статус</div>
              <div className="flex-1 px-4">Описание</div>
              <div className="px-4">Действия</div>
            </div>
          </div>
          
          {/* Содержимое таблицы */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={statuses.map(s => s.id)} strategy={rectSortingStrategy}>
              <div>
                {statuses.map((status) => (
                  <SortableOrderStatusItem
                    key={status.id}
                    status={status}
                    onEdit={handleEdit}
                    onDelete={(status) => {
                      setDeletingStatus(status)
                      setIsDeleteDialogOpen(true)
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить статус заказа?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить статус "{deletingStatus?.name}"? 
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
