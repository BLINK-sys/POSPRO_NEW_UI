'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import AdminLoading from '@/components/admin-loading'
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
import { cn } from '@/lib/utils'

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

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
    <div ref={setNodeRef} style={style} className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center py-3 px-4 hover:bg-yellow-50/40 transition-colors">
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
        <div className="flex items-center space-x-1 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(status)}
            className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(status)}
            className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
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
    return <AdminLoading text="Загрузка статусов..." />
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Статусы заказов</h2>
          <p className="text-muted-foreground">
            Управление статусами заказов с настраиваемыми цветами
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className={PRIMARY_BTN}>
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
                  className={SOFT_CONTROL}
                />
              </div>

              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Описание статуса..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={SOFT_CONTROL}
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
                      className={cn("w-12 h-10 p-1 rounded cursor-pointer", SOFT_CONTROL)}
                    />
                    <Input
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      placeholder="#e5e7eb"
                      className={SOFT_CONTROL}
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
                      className={cn("w-12 h-10 p-1 rounded cursor-pointer", SOFT_CONTROL)}
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      placeholder="#374151"
                      className={SOFT_CONTROL}
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
                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
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
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className={SECONDARY_BTN}>
                Отмена
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name.trim()}
                className={PRIMARY_BTN}
              >
                {isSubmitting ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Список статусов */}
      {statuses.length === 0 ? (
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Статусы заказов не найдены</p>
            <Button className={cn("mt-4", PRIMARY_BTN)} onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Создать первый статус
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden">
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
            <AlertDialogCancel className={SECONDARY_BTN}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-[0_2px_6px_rgba(220,38,38,0.30)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.40)] transition-shadow"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
