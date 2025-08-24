"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Image from "next/image"
import { toast } from "sonner"
import { Upload, Trash2, ImageIcon, LinkIcon } from "lucide-react"
import {
  type SmallBanner,
  uploadSmallBannerImage,
  deleteSmallBannerImage,
} from '../app/actions/small-banners'
import { API_BASE_URL } from '../lib/api-address'

interface SmallBannerEditDialogProps {
  banner: Partial<SmallBanner> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Partial<Omit<SmallBanner, "id" | "order">>) => void
}

const getImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return ""
  if (imageUrl.startsWith("http")) return imageUrl
  if (imageUrl.startsWith("/uploads/")) return `${API_BASE_URL}${imageUrl}`
  return imageUrl
}

export default function SmallBannerEditDialog({ banner, open, onOpenChange, onSave }: SmallBannerEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Omit<SmallBanner, "id" | "order">>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setFormData(
        banner || {
          title: "",
          description: "",
          image_url: "",
          button_text: "Подробнее",
          button_text_color: "#ffffff",
          button_bg_color: "#007bff",
          button_link: "",
          card_bg_color: "#f8f9fa",
          show_button: true,
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const uploadData = new FormData()
    uploadData.append("file", file)

    setIsUploading(true)
    toast.info("Загрузка изображения...")

    const result = await uploadSmallBannerImage(uploadData)
    setIsUploading(false)

    if (result.error) {
      toast.error(result.error)
    } else if (result.success && result.url) {
      toast.success(result.message || "Изображение загружено")
      handleInputChange("image_url", result.url)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDeleteImage = async () => {
    if (!formData.image_url) return

    // If it's an uploaded image (starts with /uploads/), delete it from server
    if (formData.image_url.startsWith("/uploads/")) {
      setIsUploading(true)
      const result = await deleteSmallBannerImage(formData.image_url)
      setIsUploading(false)

      if (result.error) {
        toast.error(result.error)
        return
      } else if (result.success) {
        toast.success(result.message || "Изображение удалено")
      }
    }

    // Clear the image field
    handleInputChange("image_url", "")
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{banner?.id ? "Редактировать карточку" : "Добавить карточку"}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2">
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Контент</TabsTrigger>
              <TabsTrigger value="button">Кнопка</TabsTrigger>
              <TabsTrigger value="preview">Превью</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Заголовок</Label>
                <Input
                  id="title"
                  value={formData.title || ""}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Введите заголовок карточки"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Введите описание карточки"
                />
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
                        className="pl-10"
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
                    <div className="relative w-full max-w-sm">
                      <div className="relative w-full h-32 rounded-md border overflow-hidden bg-gray-50">
                        <Image
                          src={getImageUrl(formData.image_url) || "/placeholder.svg"}
                          alt="Превью изображения"
                          fill
                          className="object-cover"
                          unoptimized
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
              <div className="space-y-2">
                <Label htmlFor="card_bg_color">Цвет фона карточки</Label>
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
                  />
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
              <Card style={{ backgroundColor: formData.card_bg_color }}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{formData.title || "Заголовок"}</CardTitle>
                      <p className="text-sm text-muted-foreground mb-4">{formData.description || "Описание"}</p>
                      {formData.show_button && (
                        <Button
                          size="sm"
                          style={{
                            backgroundColor: formData.button_bg_color,
                            color: formData.button_text_color,
                          }}
                          className="pointer-events-none"
                        >
                          {formData.button_text}
                        </Button>
                      )}
                    </div>
                    {formData.image_url && (
                      <div className="w-32 h-32 relative ml-4">
                        <Image
                          src={getImageUrl(formData.image_url) || "/placeholder.svg"}
                          alt={formData.title || "Заголовок"}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
