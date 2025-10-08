"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Banner } from "@/app/actions/banners"

interface BannerEditDialogProps {
  banner: Banner | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Partial<Banner>) => void
  onRefreshList: () => void
}

import { API_BASE_URL } from "@/lib/api-address"

const getImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return ""
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl
  if (imageUrl.startsWith("/uploads/")) return `${API_BASE_URL}${imageUrl}`
  return imageUrl
}

export default function BannerEditDialog({ banner, open, onOpenChange, onSave, onRefreshList }: BannerEditDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    image: "",
    button_text: "",
    button_link: "",
    show_button: true,
    open_in_new_tab: false,
    button_color: "#000000",
    button_text_color: "#ffffff",
    active: true,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>("")

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || "",
        subtitle: banner.subtitle || "",
        image: banner.image || "",
        button_text: banner.button_text || "",
        button_link: banner.button_link || "",
        show_button: banner.show_button ?? true,
        open_in_new_tab: banner.open_in_new_tab ?? false,
        button_color: banner.button_color || "#000000",
        button_text_color: banner.button_text_color || "#ffffff",
        active: banner.active ?? true,
      })
      setImagePreview(getImageUrl(banner.image))
    } else {
      setFormData({
        title: "",
        subtitle: "",
        image: "",
        button_text: "",
        button_link: "",
        show_button: true,
        open_in_new_tab: false,
        button_color: "#000000",
        button_text_color: "#ffffff",
        active: true,
      })
      setImagePreview("")
    }
  }, [banner, open])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Пожалуйста, выберите файл изображения")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 5MB")
      return
    }

    setIsUploading(true)

    try {
      const uploadData = new FormData()
      uploadData.append("file", file) // API expects "file" field
      uploadData.append("banner_id", String(banner.id)) // Добавляем ID баннера

      const response = await fetch(`${API_BASE_URL}/api/admin/upload-image`, {
        method: "POST",
        headers: {},
        body: uploadData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to upload image")
      }

      const imageUrl = result.url
      setFormData((prev) => ({ ...prev, image: imageUrl }))
      setImagePreview(getImageUrl(imageUrl))
      toast.success("Изображение загружено успешно")
    } catch (error: any) {
      console.error("Error uploading image:", error)
      toast.error(`Ошибка загрузки: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!formData.image) return

    try {
      // Extract filename from path
      const filename = formData.image.split("/").pop()
      if (filename) {
        const response = await fetch(`${API_BASE_URL}/api/admin/images/${filename}`, {
          method: "DELETE",
          headers: {},
        })

        if (response.ok) {
          toast.success("Изображение удалено")
        }
      }
    } catch (error) {
      console.error("Error deleting image:", error)
    }

    setFormData((prev) => ({ ...prev, image: "" }))
    setImagePreview("")
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Заголовок обязателен")
      return
    }

    setIsSaving(true)

    try {
      const url = banner ? `${API_BASE_URL}/api/admin/banners/${banner.id}` : `${API_BASE_URL}/api/admin/banners`
      const method = banner ? "PUT" : "POST"

      const payload = {
        title: formData.title,
        subtitle: formData.subtitle,
        image: formData.image,
        active: formData.active,
        button_text: formData.button_text,
        button_link: formData.button_link,
        show_button: formData.show_button,
        open_in_new_tab: formData.open_in_new_tab,
        button_color: formData.button_color,
        button_text_color: formData.button_text_color,
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to save banner")
      }

      toast.success(banner ? "Баннер обновлен" : "Баннер создан")
      onOpenChange(false)

      // Refresh the list in background
      onRefreshList()
    } catch (error: any) {
      console.error("Error saving banner:", error)
      toast.error(`Ошибка сохранения: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{banner ? "Редактировать баннер" : "Создать баннер"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Контент</TabsTrigger>
            <TabsTrigger value="button">Кнопка</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6 mt-6">
            {/* Image Upload */}
            <div className="space-y-4">
              <Label>Изображение баннера</Label>

              {imagePreview ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="relative">
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                        onError={(e) => {
                          console.error("Image preview failed to load:", imagePreview)
                          e.currentTarget.src = "/placeholder.svg?height=192&width=384"
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8">
                    <div className="text-center">
                      <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">Загрузите изображение баннера</p>
                        <p className="text-xs text-gray-400">PNG, JPG до 5MB</p>
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                        className="mt-4"
                      />
                      {isUploading && (
                        <div className="flex items-center justify-center mt-2">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm">Загрузка...</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Content Fields */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="title">Заголовок *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Введите заголовок баннера"
                />
              </div>

              <div>
                <Label htmlFor="subtitle">Подзаголовок</Label>
                <Textarea
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => handleInputChange("subtitle", e.target.value)}
                  placeholder="Введите подзаголовок баннера"
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="button" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show_button"
                  checked={formData.show_button}
                  onCheckedChange={(checked) => handleInputChange("show_button", checked)}
                />
                <Label htmlFor="show_button">Показать кнопку</Label>
              </div>

              {formData.show_button && (
                <>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="open_in_new_tab"
                      checked={formData.open_in_new_tab}
                      onCheckedChange={(checked) => handleInputChange("open_in_new_tab", checked)}
                    />
                    <Label htmlFor="open_in_new_tab">Открывать в новой вкладке</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="button_text">Текст кнопки</Label>
                      <Input
                        id="button_text"
                        value={formData.button_text}
                        onChange={(e) => handleInputChange("button_text", e.target.value)}
                        placeholder="Подробнее"
                      />
                    </div>
                    <div>
                      <Label htmlFor="button_link">Ссылка кнопки</Label>
                      <Input
                        id="button_link"
                        value={formData.button_link}
                        onChange={(e) => handleInputChange("button_link", e.target.value)}
                        placeholder="/category/electronics"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="button_color">Цвет кнопки</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="button_color"
                          type="color"
                          value={formData.button_color}
                          onChange={(e) => handleInputChange("button_color", e.target.value)}
                          className="w-16 h-10 p-1 border rounded"
                        />
                        <Input
                          value={formData.button_color}
                          onChange={(e) => handleInputChange("button_color", e.target.value)}
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="button_text_color">Цвет текста кнопки</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="button_text_color"
                          type="color"
                          value={formData.button_text_color}
                          onChange={(e) => handleInputChange("button_text_color", e.target.value)}
                          className="w-16 h-10 p-1 border rounded"
                        />
                        <Input
                          value={formData.button_text_color}
                          onChange={(e) => handleInputChange("button_text_color", e.target.value)}
                          placeholder="#ffffff"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange("active", checked)}
                />
                <Label htmlFor="active">Активен</Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Сохранение...
              </>
            ) : (
              "Сохранить"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
