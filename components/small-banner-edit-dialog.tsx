"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import { toast } from "sonner"
import { Upload, Trash2, ImageIcon, LinkIcon } from "lucide-react"
import {
  type SmallBanner,
} from "@/app/actions/small-banners"
import { apiClient } from "@/lib/api-client"
import { API_BASE_URL } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"

interface SmallBannerEditDialogProps {
  banner: Partial<SmallBanner> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Partial<Omit<SmallBanner, "id" | "order">>) => void
}

export default function SmallBannerEditDialog({ banner, open, onOpenChange, onSave }: SmallBannerEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Omit<SmallBanner, "id" | "order">>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backgroundFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setFormData(
        banner ? {
          title: banner.title || "",
          description: banner.description || "",
          image_url: banner.image_url || "",
          background_image_url: banner.background_image_url || "",
          title_text_color: banner.title_text_color || "#000000",
          description_text_color: banner.description_text_color || "#666666",
          button_text: banner.button_text || "Подробнее",
          button_text_color: banner.button_text_color || "#ffffff",
          button_bg_color: banner.button_bg_color || "#007bff",
          button_link: banner.button_link || "",
          card_bg_color: banner.card_bg_color || "#f8f9fa",
          show_button: banner.show_button ?? true,
          open_in_new_tab: banner.open_in_new_tab ?? false,
        } : {
          title: "",
          description: "",
          image_url: "",
          background_image_url: "",
          title_text_color: "#000000",
          description_text_color: "#666666",
          button_text: "Подробнее",
          button_text_color: "#ffffff",
          button_bg_color: "#007bff",
          button_link: "",
          card_bg_color: "#f8f9fa",
          show_button: true,
          open_in_new_tab: false,
        },
      )
    }
  }, [banner, open])

  const handleSave = async () => {
    if (!formData.title?.trim()) {
      toast.error("Заголовок не может быть пустым.")
      return
    }
    setIsSaving(true)
    await onSave(formData)
    setIsSaving(false)
  }

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSetStandardColors = () => {
    setFormData((prev) => ({
      ...prev,
      button_bg_color: "#fbbf24", // Желтый цвет как у кнопки "Личный кабинет"
      button_text_color: "#000000" // Черный текст
    }))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    toast.info("Загрузка изображения...")

    try {
      const formData = new FormData()
      formData.append("file", file)
      
      // Добавляем ID записи для создания папки
      const bannerId = banner?.id || 'temp'
      formData.append("banner_id", bannerId.toString())

      const result = await apiClient.uploadFile("/api/admin/small-banners/upload", formData)
      
      if (result.success && result.url) {
        toast.success(result.message || "Изображение загружено")
        handleInputChange("image_url", result.url)
      } else {
        toast.error(result.error || "Ошибка загрузки")
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки")
    } finally {
      setIsUploading(false)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleBackgroundFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    toast.info("Загрузка фонового изображения...")

    try {
      const formData = new FormData()
      formData.append("file", file)
      
      // Добавляем ID записи для создания папки
      const bannerId = banner?.id || 'temp'
      formData.append("banner_id", bannerId.toString())

      const result = await apiClient.uploadFile("/api/admin/small-banners/upload", formData)
      
      if (result.success && result.url) {
        toast.success(result.message || "Фоновое изображение загружено")
        handleInputChange("background_image_url", result.url)
      } else {
        toast.error(result.error || "Ошибка загрузки")
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки")
    } finally {
      setIsUploading(false)
    }

    // Reset file input
    if (backgroundFileInputRef.current) {
      backgroundFileInputRef.current.value = ""
    }
  }

  const handleDeleteImage = async () => {
    if (!formData.image_url) return

    setIsUploading(true)
    toast.info("Удаление изображения...")

    try {
      // If it's an uploaded image (starts with /uploads/), delete it from server
      if (formData.image_url.startsWith("/uploads/")) {
        const result = await apiClient.deleteWithBody("/api/admin/small-banners/delete-image", { image_url: formData.image_url })
        
        if (result.success) {
          toast.success(result.message || "Изображение удалено")
        } else {
          toast.error(result.error || "Ошибка удаления")
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления")
    } finally {
      setIsUploading(false)
    }

    // Clear the image field
    handleInputChange("image_url", "")
  }

  const handleDeleteBackgroundImage = async () => {
    if (!formData.background_image_url) return

    setIsUploading(true)
    toast.info("Удаление фонового изображения...")

    try {
      // If it's an uploaded image (starts with /uploads/), delete it from server
      if (formData.background_image_url.startsWith("/uploads/")) {
        const result = await apiClient.deleteWithBody("/api/admin/small-banners/delete-image", { image_url: formData.background_image_url })
        
        if (result.success) {
          toast.success(result.message || "Фоновое изображение удалено")
        } else {
          toast.error(result.error || "Ошибка удаления")
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления")
    } finally {
      setIsUploading(false)
    }

    // Clear the background image field
    handleInputChange("background_image_url", "")
  }

  const handleUrlPaste = (url: string) => {
    // Validate URL format
    if (url && !url.startsWith("http") && !url.startsWith("/uploads/")) {
      toast.error("URL должен начинаться с http:// или https://")
      return
    }
    handleInputChange("image_url", url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] h-[90vh] max-w-none max-h-none flex flex-col">
        <DialogHeader>
          <DialogTitle>{banner?.id ? "Редактировать карточку" : "Добавить карточку"}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2">
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="content">Контент</TabsTrigger>
              <TabsTrigger value="images">Изображения</TabsTrigger>
              <TabsTrigger value="button">Кнопка</TabsTrigger>
              <TabsTrigger value="preview">Превью</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Заголовок</Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Введите заголовок карточки"
                    className="focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title_text_color">Цвет текста заголовка</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="title_text_color"
                      type="color"
                      value={formData.title_text_color || "#000000"}
                      onChange={(e) => handleInputChange("title_text_color", e.target.value)}
                      className="p-1 h-10 w-14 block"
                    />
                    <Input
                      value={formData.title_text_color || "#000000"}
                      onChange={(e) => handleInputChange("title_text_color", e.target.value)}
                      className="focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Введите описание карточки (используйте Enter для переноса строк)"
                    rows={4}
                    className="resize-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description_text_color">Цвет текста описания</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="description_text_color"
                      type="color"
                      value={formData.description_text_color || "#666666"}
                      onChange={(e) => handleInputChange("description_text_color", e.target.value)}
                      className="p-1 h-10 w-14 block"
                    />
                    <Input
                      value={formData.description_text_color || "#666666"}
                      onChange={(e) => handleInputChange("description_text_color", e.target.value)}
                      className="focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="images" className="pt-4">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="card_bg_color">Цвет фона карточки (если нет изображения для фона)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="card_bg_color"
                      type="color"
                      value={formData.card_bg_color || "#f8f9fa"}
                      onChange={(e) => handleInputChange("card_bg_color", e.target.value)}
                      className="p-1 h-10 w-14 block"
                    />
                    <Input
                      value={formData.card_bg_color || "#f8f9fa"}
                      onChange={(e) => handleInputChange("card_bg_color", e.target.value)}
                      className="focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Изображение для фона карточки</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Вставьте URL фонового изображения"
                          value={formData.background_image_url || ""}
                          onChange={(e) => handleInputChange("background_image_url", e.target.value)}
                          className="pl-10 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                        />
                      </div>
                      <div className="text-sm text-gray-500">или</div>
                      <Button variant="outline" onClick={() => backgroundFileInputRef.current?.click()} disabled={isUploading}>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? "Загрузка..." : "Загрузить"}
                      </Button>
                      <Input
                        type="file"
                        ref={backgroundFileInputRef}
                        onChange={(e) => handleBackgroundFileUpload(e)}
                        className="hidden"
                        accept="image/*"
                      />
                    </div>
                    {formData.background_image_url && (
                      <div className="relative w-full max-w-sm">
                        <div 
                          className="relative w-full h-32 rounded-md border overflow-hidden bg-gray-50"
                          style={{
                            backgroundImage: `url(${getImageUrl(formData.background_image_url)})`,
                            backgroundSize: 'contain',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        >
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={handleDeleteBackgroundImage}
                            disabled={isUploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {formData.background_image_url.startsWith("/uploads/") ? "Загружено на сервер" : "Внешняя ссылка"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Изображение</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Вставьте URL изображения"
                          value={formData.image_url || ""}
                          onChange={(e) => handleUrlPaste(e.target.value)}
                          className="pl-10 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                        />
                      </div>
                      <div className="text-sm text-gray-500">или</div>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? "Загрузка..." : "Загрузить"}
                      </Button>
                      <Input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept="image/*"
                      />
                    </div>
                    {formData.image_url && (
                      <div className="relative w-32">
                        <div className="relative w-32 h-32 rounded-md border overflow-hidden bg-gray-50">
                          <Image
                            src={getImageUrl(formData.image_url) || "/placeholder.svg"}
                            alt="Превью изображения"
                            fill
                            className="object-cover object-center"
                            unoptimized
                            sizes="128px"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={handleDeleteImage}
                            disabled={isUploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {formData.image_url.startsWith("/uploads/") ? "Загружено на сервер" : "Внешняя ссылка"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="button" className="space-y-4 pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show_button"
                  checked={!!formData.show_button}
                  onCheckedChange={(checked) => handleInputChange("show_button", checked)}
                />
                <Label htmlFor="show_button">Показывать кнопку</Label>
              </div>
              {formData.show_button && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="open_in_new_tab"
                        checked={!!formData.open_in_new_tab}
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

                  <div className="space-y-2">
                    <Label htmlFor="button_text">Текст кнопки</Label>
                    <Input
                      id="button_text"
                      value={formData.button_text || ""}
                      onChange={(e) => handleInputChange("button_text", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="button_link">Ссылка кнопки</Label>
                    <Input
                      id="button_link"
                      value={formData.button_link || ""}
                      onChange={(e) => handleInputChange("button_link", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="button_bg_color">Цвет фона кнопки</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="button_bg_color"
                          type="color"
                          value={formData.button_bg_color || "#007bff"}
                          onChange={(e) => handleInputChange("button_bg_color", e.target.value)}
                          className="p-1 h-10 w-14 block"
                        />
                        <Input
                          value={formData.button_bg_color || "#007bff"}
                          onChange={(e) => handleInputChange("button_bg_color", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="button_text_color">Цвет текста кнопки</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="button_text_color"
                          type="color"
                          value={formData.button_text_color || "#ffffff"}
                          onChange={(e) => handleInputChange("button_text_color", e.target.value)}
                          className="p-1 h-10 w-14 block"
                        />
                        <Input
                          value={formData.button_text_color || "#ffffff"}
                          onChange={(e) => handleInputChange("button_text_color", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="preview" className="pt-4">
              <div className="flex justify-center">
                <Card 
                  className="shadow-lg w-[80vw] overflow-hidden hover:shadow-lg transition-shadow"
                  style={{ 
                    backgroundColor: formData.background_image_url ? 'transparent' : formData.card_bg_color,
                    backgroundImage: formData.background_image_url ? `url(${getImageUrl(formData.background_image_url)})` : 'none',
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                >
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {formData.image_url && (
                        <div className="w-full md:w-48 h-48 relative flex-shrink-0">
                          <Image
                            src={getImageUrl(formData.image_url) || "/placeholder.svg"}
                            alt={formData.title || "Превью"}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="flex-1 text-center md:text-left">
                        <h3 
                          className="font-semibold text-2xl mb-4"
                          style={{ color: formData.title_text_color || "#000000" }}
                        >
                          {formData.title || "Заголовок"}
                        </h3>
                        <p 
                          className="text-lg mb-6 whitespace-pre-line"
                          style={{ color: formData.description_text_color || "#666666" }}
                        >
                          {formData.description || "Описание"}
                        </p>
                        {formData.show_button && formData.button_text && (
                          <Button
                            size="lg"
                            style={{
                              backgroundColor: formData.button_bg_color,
                              color: formData.button_text_color
                            }}
                            className="pointer-events-none"
                          >
                            {formData.button_text}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isUploading}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploading || !formData.title?.trim()}>
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
