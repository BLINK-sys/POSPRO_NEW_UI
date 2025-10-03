"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { API_ENDPOINTS } from "@/lib/api-endpoints"
import BenefitEditDialog from "./benefit-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable"
import { SortableBenefitItem } from "./sortable-benefit-item"

export interface Benefit {
  id: number
  icon: string
  title: string
  description: string
  order: number
}

export default function BenefitsTab() {
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null)
  const [deletingBenefit, setDeletingBenefit] = useState<Benefit | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(useSensor(PointerSensor))

  const loadBenefits = async () => {
    setIsLoading(true)
    try {
      const data = await apiClient.get<Benefit[]>(API_ENDPOINTS.ADMIN.BENEFITS.LIST)
      setBenefits(Array.isArray(data) ? data.sort((a, b) => a.order - b.order) : [])
    } catch (error) {
      console.error("Error loading benefits:", error)
      toast({ title: "Ошибка", description: "Не удалось загрузить преимущества", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBenefits()
  }, [])

  const handleSaveBenefit = async (data: Omit<Benefit, "id" | "order"> & { order?: number }) => {
    const isEditing = editingBenefit !== null

    const payload = {
      ...data,
      order: isEditing ? editingBenefit.order : benefits.length,
    }

    try {
      const result = isEditing
        ? await apiClient.put(API_ENDPOINTS.ADMIN.BENEFITS.UPDATE(editingBenefit.id), payload)
        : await apiClient.post(API_ENDPOINTS.ADMIN.BENEFITS.CREATE, payload)

      toast({ title: "Успешно", description: result.message })
      loadBenefits()
      setIsEditDialogOpen(false)
    } catch (error: any) {
      console.error("Error saving benefit:", error)
      toast({ title: "Ошибка", description: error.message, variant: "destructive" })
    }
  }

  const confirmDelete = async () => {
    if (!deletingBenefit) return
    try {
      const result = await apiClient.delete(API_ENDPOINTS.ADMIN.BENEFITS.DELETE(deletingBenefit.id))
      toast({ title: "Успешно", description: result.message })
      loadBenefits()
    } catch (error: any) {
      console.error("Error deleting benefit:", error)
      toast({ title: "Ошибка", description: error.message, variant: "destructive" })
    } finally {
      setIsDeleteDialogOpen(false)
      setDeletingBenefit(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = benefits.findIndex((b) => b.id === active.id)
      const newIndex = benefits.findIndex((b) => b.id === over.id)
      const newOrderBenefits = arrayMove(benefits, oldIndex, newIndex)
      setBenefits(newOrderBenefits)

      const reorderPayload = newOrderBenefits.map((benefit, index) => ({
        id: benefit.id,
        order: index,
      }))

      try {
        const result = await apiClient.post(API_ENDPOINTS.ADMIN.BENEFITS.REORDER, reorderPayload)
        toast({ title: "Успешно", description: "Порядок преимуществ обновлен." })
      } catch (error: any) {
        console.error("Error reordering benefits:", error)
        toast({ title: "Ошибка", description: error.message, variant: "destructive" })
        loadBenefits() // Revert on error by reloading from server
      }
    }
  }

  const openEditDialog = (benefit: Benefit) => {
    setEditingBenefit(benefit)
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (benefit: Benefit) => {
    setDeletingBenefit(benefit)
    setIsDeleteDialogOpen(true)
  }

  if (isLoading) return <div>Загрузка преимуществ...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-base font-semibold">Преимущества</h4>
          <p className="text-sm text-muted-foreground">
            Управляйте преимуществами компании. Можно перетаскивать для смены порядка.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingBenefit(null)
            setIsEditDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить преимущество
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={benefits.map((b) => b.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {benefits.map((benefit) => (
              <SortableBenefitItem
                key={benefit.id}
                benefit={benefit}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {benefits.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Преимущества не найдены</p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditingBenefit(null)
                setIsEditDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить первое преимущество
            </Button>
          </CardContent>
        </Card>
      )}

      <BenefitEditDialog
        benefit={editingBenefit}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveBenefit}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Удалить преимущество"
        description={`Вы уверены, что хотите удалить преимущество "${deletingBenefit?.title}"?`}
      />
    </div>
  )
}
