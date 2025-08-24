"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableBannerItem } from "./sortable-banner-item"
import BannerEditDialog from "./banner-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { apiClient } from "@/lib/api-client"
import { API_ENDPOINTS } from "@/lib/api-endpoints"

export interface Banner {
  id: number
  title: string
  subtitle: string
  description: string
  image_url: string
  button_text: string
  button_link: string
  active: boolean
  order: number
}

export default function BannersTab() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [deletingBannerId, setDeletingBannerId] = useState<number | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Fetch banners from API
  const fetchBanners = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const data = await apiClient.get<Banner[]>(API_ENDPOINTS.ADMIN.BANNERS.LIST)
      console.log("Fetched banners data:", data) // Debug log

      // API returns array directly, not wrapped in object
      setBanners(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error("Error fetching banners:", error)
      toast.error(`Ошибка загрузки баннеров: ${error.message}`)
      setBanners([])
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  // Background refresh function
  const handleRefreshList = () => {
    fetchBanners(false) // Don't show loading indicator
  }

  useEffect(() => {
    fetchBanners()
  }, [])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = banners.findIndex((banner) => banner.id === active.id)
      const newIndex = banners.findIndex((banner) => banner.id === over.id)

      const newBanners = arrayMove(banners, oldIndex, newIndex)
      setBanners(newBanners)

      // Update order on server
      try {
        const updatePromises = newBanners.map((banner, index) =>
          apiClient.put(API_ENDPOINTS.ADMIN.BANNERS.UPDATE(banner.id), {
            ...banner,
            order: index,
          }),
        )

        await Promise.all(updatePromises)
        toast.success("Порядок баннеров обновлен")
      } catch (error: any) {
        console.error("Error updating banner order:", error)
        toast.error("Ошибка при обновлении порядка")
        // Revert changes on error
        fetchBanners(false)
      }
    }
  }

  const handleAddBanner = () => {
    setEditingBanner(null)
    setIsEditDialogOpen(true)
  }

  const handleEditBanner = (banner: Banner) => {
    setEditingBanner(banner)
    setIsEditDialogOpen(true)
  }

  const handleDeleteBanner = (id: number) => {
    setDeletingBannerId(id)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingBannerId) return

    try {
      await apiClient.delete(API_ENDPOINTS.ADMIN.BANNERS.DELETE(deletingBannerId))
      setBanners((prev) => prev.filter((banner) => banner.id !== deletingBannerId))
      toast.success("Баннер удален")
    } catch (error: any) {
      console.error("Error deleting banner:", error)
      toast.error(`Ошибка удаления: ${error.message}`)
    } finally {
      setIsDeleteDialogOpen(false)
      setDeletingBannerId(null)
    }
  }

  const handleToggleActive = (id: number, active: boolean) => {
    setBanners((prev) => prev.map((banner) => (banner.id === id ? { ...banner, active } : banner)))
  }

  const handleSaveBanner = async (data: Partial<Banner>) => {
    // This function is called after successful API call in the dialog
    // The dialog handles the API call and calls onRefreshList
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Загрузка баннеров...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Основные баннеры</h3>
          <p className="text-sm text-gray-500">
            Управление главными баннерами на сайте. Перетаскивайте для изменения порядка.
          </p>
        </div>
        <Button onClick={handleAddBanner}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить баннер
        </Button>
      </div>

      {banners.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <p>Баннеры не найдены</p>
              <Button onClick={handleAddBanner} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Добавить первый баннер
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={banners.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {banners.map((banner) => (
                <SortableBannerItem
                  key={banner.id}
                  banner={banner}
                  onEdit={handleEditBanner}
                  onDelete={handleDeleteBanner}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <BannerEditDialog
        banner={editingBanner}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveBanner}
        onRefreshList={handleRefreshList}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Удалить баннер"
        description="Вы уверены, что хотите удалить этот баннер? Это действие нельзя отменить."
      />
    </div>
  )
}
