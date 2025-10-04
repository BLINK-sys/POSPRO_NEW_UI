"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { getImageUrl } from "@/lib/image-utils"
import { getApiUrl } from "@/lib/api-address"
import { Edit, Trash2, Plus } from "lucide-react"
import Image from "next/image"
import SmallBannerEditDialog from "./small-banner-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"

interface SmallBanner {
  id: number
  title: string
  description: string
  image_url: string
  background_image_url?: string  // ✅ Добавлено поле фонового изображения
  title_text_color?: string  // ✅ Цвет текста заголовка
  description_text_color?: string  // ✅ Цвет текста описания
  button_text: string
  button_text_color: string
  button_bg_color: string
  button_link: string
  card_bg_color: string
  show_button: boolean
}

export default function SmallBannersTab() {
  const [banners, setBanners] = useState<SmallBanner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingBanner, setEditingBanner] = useState<SmallBanner | null>(null)
  const [deletingBanner, setDeletingBanner] = useState<SmallBanner | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()

  const loadBanners = async () => {
    setIsLoading(true)
    try {
      const data = await apiClient.get<SmallBanner[]>("/api/admin/small-banners")
      setBanners(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error loading banners:", error)
      toast({ title: "Ошибка", description: "Не удалось загрузить баннеры", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBanners()
  }, [])

  const handleSaveBanner = async (data: Partial<SmallBanner>) => {
    const isEditing = editingBanner !== null

    try {
      const result = isEditing
        ? await apiClient.patch(`/api/admin/small-banners/${editingBanner.id}`, data)
        : await apiClient.post("/api/admin/small-banners", data)

      toast({ title: "Успешно", description: result.message })
      loadBanners()
      setIsEditDialogOpen(false)
    } catch (error: any) {
      console.error("Error saving banner:", error)
      toast({ title: "Ошибка", description: error.message, variant: "destructive" })
    }
  }

  const confirmDelete = async () => {
    if (!deletingBanner) return
    try {
      const result = await apiClient.delete(`/api/admin/small-banners/${deletingBanner.id}`)
      toast({ title: "Успешно", description: result.message })
      loadBanners()
    } catch (error: any) {
      console.error("Error deleting banner:", error)
      toast({ title: "Ошибка", description: error.message, variant: "destructive" })
    } finally {
      setIsDeleteDialogOpen(false)
      setDeletingBanner(null)
    }
  }


  if (isLoading) return <div>Загрузка информационных карточек...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-base font-semibold">Информационные карточки</h4>
          <p className="text-sm text-muted-foreground">Управляйте малыми баннерами и карточками</p>
        </div>
        <Button
          onClick={() => {
            setEditingBanner(null)
            setIsEditDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить карточку
        </Button>
      </div>

      <div className="space-y-6">
        {banners.map((banner) => (
          <Card
            key={banner.id}
            className="relative group overflow-hidden hover:shadow-lg transition-shadow w-full"
            style={{ 
              backgroundColor: banner.background_image_url ? 'transparent' : banner.card_bg_color,
              backgroundImage: banner.background_image_url ? `url(${getImageUrl(banner.background_image_url)})` : 'none',
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {banner.image_url && (
                  <div className="w-full md:w-48 h-48 relative flex-shrink-0">
                    <Image
                      src={getImageUrl(banner.image_url) || "/placeholder.svg"}
                      alt={banner.title}
                      fill
                      className="object-contain"
                      unoptimized
                      onError={(e) => {
                        console.error("Small banner image failed to load:", banner.image_url)
                        e.currentTarget.src = "/placeholder.svg"
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 text-center md:text-left">
                  <h3 
                    className="font-semibold text-2xl mb-4"
                    style={{ color: banner.title_text_color || "#000000" }}
                  >
                    {banner.title}
                  </h3>
                  <p 
                    className="text-lg mb-6 whitespace-pre-line"
                    style={{ color: banner.description_text_color || "#666666" }}
                  >
                    {banner.description}
                  </p>
                  {banner.show_button && banner.button_text && (
                    <Button
                      size="lg"
                      style={{
                        backgroundColor: banner.button_bg_color,
                        color: banner.button_text_color
                      }}
                    >
                      {banner.button_text}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
            <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white/80"
                onClick={() => {
                  setEditingBanner(banner)
                  setIsEditDialogOpen(true)
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white/80"
                onClick={() => {
                  setDeletingBanner(banner)
                  setIsDeleteDialogOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {banners.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Информационные карточки не найдены</p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditingBanner(null)
                setIsEditDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить первую карточку
            </Button>
          </CardContent>
        </Card>
      )}

      <SmallBannerEditDialog
        banner={editingBanner}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveBanner}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Удалить карточку"
        description={`Вы уверены, что хотите удалить карточку "${deletingBanner?.title}"?`}
      />
    </div>
  )
}
