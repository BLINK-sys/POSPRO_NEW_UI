"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Edit, Trash2, GripVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ProductAvailabilityStatusEditDialog from "./product-availability-status-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable"
import { SortableProductAvailabilityStatusItem } from "./sortable-product-availability-status-item"
import {
  getProductAvailabilityStatuses,
  createProductAvailabilityStatus,
  updateProductAvailabilityStatus,
  deleteProductAvailabilityStatus,
  reorderProductAvailabilityStatuses,
  type ProductAvailabilityStatus,
  type CreateProductAvailabilityStatusData
} from "@/app/actions/product-availability-statuses"
import { getSuppliers, type Supplier } from "@/app/actions/suppliers"

export default function ProductAvailabilityStatusesTab() {
  const [statuses, setStatuses] = useState<ProductAvailabilityStatus[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState<ProductAvailabilityStatus | null>(null)
  const [deletingStatus, setDeletingStatus] = useState<ProductAvailabilityStatus | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(useSensor(PointerSensor))

  const loadStatuses = async () => {
    setIsLoading(true)
    try {
      const result = await getProductAvailabilityStatuses()
      if (result.success) {
        setStatuses(Array.isArray(result.data) ? result.data.sort((a, b) => a.order - b.order) : [])
      } else {
        toast({ title: "Ошибка", description: result.message, variant: "destructive" })
      }
    } catch (error) {
      console.error("Error loading product availability statuses:", error)
      toast({ title: "Ошибка", description: "Не удалось загрузить статусы наличия", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (error) {
      console.error("Error loading suppliers:", error)
    }
  }

  useEffect(() => {
    loadStatuses()
    loadSuppliers()
  }, [])

  const handleSaveStatus = async (data: Omit<ProductAvailabilityStatus, "id" | "order"> & { order?: number }) => {
    const isEditing = editingStatus !== null

    const payload: CreateProductAvailabilityStatusData = {
      ...data,
      order: isEditing ? editingStatus.order : statuses.length,
    }

    try {
      const result = isEditing
        ? await updateProductAvailabilityStatus(editingStatus.id, payload)
        : await createProductAvailabilityStatus(payload)

      if (result.success || result.message) {
        toast({ title: "Успешно", description: result.message })
        loadStatuses()
        setIsEditDialogOpen(false)
      } else {
        toast({ title: "Ошибка", description: result.message || "Неизвестная ошибка", variant: "destructive" })
      }
    } catch (error: any) {
      console.error("Error saving product availability status:", error)
      toast({ title: "Ошибка", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteStatus = async () => {
    if (!deletingStatus) return

    try {
      const result = await deleteProductAvailabilityStatus(deletingStatus.id)
      if (result.success || result.message) {
        toast({ title: "Успешно", description: result.message })
        loadStatuses()
        setIsDeleteDialogOpen(false)
      } else {
        toast({ title: "Ошибка", description: result.message || "Неизвестная ошибка", variant: "destructive" })
      }
    } catch (error: any) {
      console.error("Error deleting product availability status:", error)
      toast({ title: "Ошибка", description: error.message, variant: "destructive" })
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
        const reorderData = newStatuses.map((status, index) => ({
          id: status.id,
          order: index,
        }))

        const result = await reorderProductAvailabilityStatuses(reorderData)
        if (result.error) {
          toast({ title: "Ошибка", description: result.error || "Не удалось сохранить порядок", variant: "destructive" })
          loadStatuses() // Перезагружаем исходный порядок
        }
      } catch (error) {
        console.error("Error reordering statuses:", error)
        toast({ title: "Ошибка", description: "Не удалось сохранить порядок", variant: "destructive" })
        loadStatuses() // Перезагружаем исходный порядок
      }
    }
  }

  const getOperatorText = (operator: string) => {
    const operatorMap: { [key: string]: string } = {
      '>': 'Больше',
      '<': 'Меньше',
      '=': 'Равно',
      '>=': 'Больше или равно',
      '<=': 'Меньше или равно'
    }
    return operatorMap[operator] || operator
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Загрузка статусов наличия...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Статусы наличия товара</h3>
        <Button onClick={() => {
          setEditingStatus(null)
          setIsEditDialogOpen(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить статус
        </Button>
      </div>

      {statuses.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Заголовки таблицы */}
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center py-3 px-4 text-sm font-medium text-gray-700">
              <div className="w-12 flex justify-center">
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 px-4">Статус</div>
              <div className="flex-1 px-4">Формула</div>
              <div className="px-4">Действия</div>
            </div>
          </div>
          
          {/* Содержимое таблицы */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={statuses.map(s => s.id)} strategy={rectSortingStrategy}>
              <div>
                {statuses.map((status) => (
                  <SortableProductAvailabilityStatusItem
                    key={status.id}
                    status={status}
                    onEdit={(status) => {
                      setEditingStatus(status)
                      setIsEditDialogOpen(true)
                    }}
                    onDelete={(status) => {
                      setDeletingStatus(status)
                      setIsDeleteDialogOpen(true)
                    }}
                    getOperatorText={getOperatorText}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-muted-foreground text-lg">Статусы наличия не найдены.</p>
          <p className="text-muted-foreground text-sm mt-1">Добавьте первый статус, чтобы начать работу</p>
        </div>
      )}

      {editingStatus !== undefined && (
        <ProductAvailabilityStatusEditDialog
          status={editingStatus}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={handleSaveStatus}
          suppliers={suppliers}
        />
      )}

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteStatus}
        title={`Удалить статус "${deletingStatus?.status_name}"?`}
        description="Это действие нельзя будет отменить."
      />
    </div>
  )
}
