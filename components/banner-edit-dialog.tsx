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
import { ImageCropperDialog } from "./image-cropper-dialog"

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
  // File stored locally when creating a new banner (uploaded after banner creation)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Source for the cropper modal (raw file picked from disk, before crop)
  const [cropSource, setCropSource] = useState<{ src: string; name: string; type: string } | null>(null)

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
    setPendingFile(null)
  }, [banner, open])

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSetStandardColors = () => {
    setFormData((prev) => ({
      ...prev,
      button_color: "#fbbf24",
      button_text_color: "#000000"
    }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Пожалуйста, выберите файл изображения")
      return
    }

    // Open the cropper instead of accepting the raw file. Size limit is checked
    // after crop — by then the file is normalized to ~1920×600 jpg/png and
    // virtually always under 5MB anyway.
    const reader = new FileReader()
    reader.onload = () => {
      setCropSource({ src: String(reader.result), name: file.name, type: file.type || "image/png" })
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  const handleCropApply = async (cropped: File) => {
    setCropSource(null)

    if (cropped.size > 5 * 1024 * 1024) {
      toast.error("Размер файла после обрезки превышает 5MB")
      return
    }

    if (!banner) {
      // New banner — show local preview, upload after save
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview)
      const blobUrl = URL.createObjectURL(cropped)
      setImagePreview(blobUrl)
      setFormData((prev) => ({ ...prev, image: "__pending__" }))
      setPendingFile(cropped)
      return
    }

    // Existing banner — upload immediately
    setIsUploading(true)
    try {
      const uploadData = new FormData()
      uploadData.append("file", cropped)
      uploadData.append("banner_id", String(banner.id))

      const response = await fetch(`${API_BASE_URL}/api/admin/upload-image`, {
        method: "POST",
        headers: {},
        body: uploadData,
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Failed to upload image")

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

    // If it was a pending local file — just clear it
    if (formData.image === "__pending__") {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview)
      setFormData((prev) => ({ ...prev, image: "" }))
      setImagePreview("")
      setPendingFile(null)
      return
    }

    try {
      const filename = formData.image.split("/").pop()
      if (filename) {
        await fetch(`${API_BASE_URL}/api/admin/images/${filename}`, {
          method: "DELETE",
          headers: {},
        })
        toast.success("Изображение удалено")
      }
    } catch (error) {
      console.error("Error deleting image:", error)
    }

    setFormData((prev) => ({ ...prev, image: "" }))
    setImagePreview("")
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const payload = {
        title: formData.title,
        subtitle: formData.subtitle,
        image: formData.image === "__pending__" ? "" : formData.image,
        active: formData.active,
        button_text: formData.button_text,
        button_link: formData.button_link,
        show_button: formData.show_button,
        open_in_new_tab: formData.open_in_new_tab,
        button_color: formData.button_color,
        button_text_color: formData.button_text_color,
      }

      if (!banner) {
        // Step 1: create banner
        const createResp = await fetch(`${API_BASE_URL}/api/admin/banners`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const createResult = await createResp.json()
        if (!createResp.ok) throw new Error(createResult.message || "Failed to create banner")

        const newBannerId = createResult.banner?.id ?? createResult.id

        // Step 2: upload pending image if any
        if (pendingFile && newBannerId) {
          const uploadData = new FormData()
          uploadData.append("file", pendingFile)
          uploadData.append("banner_id", String(newBannerId))

          const uploadResp = await fetch(`${API_BASE_URL}/api/admin/upload-image`, {
            method: "POST",
            body: uploadData,
          })
          const uploadResult = await uploadResp.json()

          if (uploadResult.url) {
            // Step 3: update banner with image URL
            await fetch(`${API_BASE_URL}/api/admin/banners/${newBannerId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, image: uploadResult.url }),
            })
          }
        }

        toast.success("Баннер создан")
      } else {
        // Update existing banner
        const updateResp = await fetch(`${API_BASE_URL}/api/admin/banners/${banner.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const updateResult = await updateResp.json()
        if (!updateResp.ok) throw new Error(updateResult.message || "Failed to update banner")

        toast.success("Баннер обновлен")
      }

      onOpenChange(false)
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
              <div className="rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 space-y-1">
                <p><strong>Рекомендуемый размер:</strong> 1920 × 600 px (соотношение 16:5).</p>
                <p><strong>Минимум:</strong> 1280 × 400 px. Соотношение сторон — 3.2:1.</p>
                <p>Изображение растягивается на всю ширину (~90% экрана) — несоблюдение пропорций приведёт к искажению.</p>
                <p>Формат: JPG / PNG / WebP. Размер файла: до 5 MB.</p>
              </div>

              {imagePreview ? (
                <Card>
                  <CardContent className="p-4">
                    {/* Preview with same aspect ratio as homepage banner (~16:5) */}
                    <div className="relative w-full aspect-[16/5] rounded-lg overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-fill"
                        onError={(e) => {
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
                <Label htmlFor="title">Заголовок</Label>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="open_in_new_tab"
                        checked={formData.open_in_new_tab}
                        onCheckedChange={(checked) => handleInputChange("open_in_new_tab", checked)}
                      />
                      <Label htmlFor="open_in_new_tab">Открывать в новой вкладке</Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSetStandardColors}
                      className="text-xs"
                    >
                      Стандартный цвет
                    </Button>
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

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
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
                      <div className="space-y-2">
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

                    <div className="space-y-2">
                      <Label>Превью кнопки</Label>
                      <Card className="p-6 bg-gray-50 h-full flex items-center justify-center">
                        <Button
                          size="lg"
                          style={{
                            backgroundColor: formData.button_color || "#000000",
                            color: formData.button_text_color || "#ffffff",
                            boxShadow: 'none',
                            filter: 'none',
                            opacity: 1
                          }}
                          className="pointer-events-none"
                        >
                          {formData.button_text || "Текст кнопки"}
                        </Button>
                      </Card>
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

      {cropSource && (
        <ImageCropperDialog
          src={cropSource.src}
          fileName={cropSource.name}
          fileType={cropSource.type}
          aspect={16 / 5}
          outputWidth={1920}
          title="Обрежьте баннер главной"
          description="Картинка растягивается на всю ширину главной (~90% экрана). Соотношение фиксировано 16:5 (3.2:1)."
          onApply={handleCropApply}
          onCancel={() => setCropSource(null)}
        />
      )}
    </Dialog>
  )
}
