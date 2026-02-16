"use client"

import type React from "react"

import { useState, useEffect, useTransition } from "react"
import Image from "next/image"
import { saveBrand, uploadBrandImage, type Brand } from "@/app/actions/meta"
import { API_BASE_URL } from "@/lib/api-address"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Trash2 } from "lucide-react"

type ImageSource = "url" | "upload"

export function BrandEditDialog({ brand, onClose }: { brand?: Brand | null; onClose: () => void }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [brandId] = useState(brand?.id ?? Date.now())
  const [name, setName] = useState(brand?.name ?? "")
  const [country, setCountry] = useState(brand?.country ?? "")
  const [description, setDescription] = useState(brand?.description ?? "")
  const [imageUrl, setImageUrl] = useState(brand?.image_url ?? "")
  const [imageSource, setImageSource] = useState<ImageSource>("url")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(brand?.image_url ?? null)

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile)
      setPreview(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }
    setPreview(imageUrl)
  }, [selectedFile, imageUrl])

  const getImageUrl = (url: string | null) => {
    if (!url) return null
    if (url.startsWith("http") || url.startsWith("blob:")) return url
    return `${API_BASE_URL}${url}`
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0])
      setImageUrl("")
    }
  }

  const handleRemoveImage = () => {
    startTransition(async () => {
      const payload = {
        id: brandId,
        name,
        country,
        description,
        image_url: "",
      }
      const result = await saveBrand(payload)
      if (result.success) {
        toast({ title: "Успех!", description: "Изображение удалено." })
        setImageUrl("")
        setSelectedFile(null)
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleSubmit = async () => {
    startTransition(async () => {
      const payload: Partial<Brand> & { id: number | string } = {
        id: brandId,
        name,
        country,
        description,
      }
      if (imageSource === "url") {
        payload.image_url = imageUrl
      } else if (!selectedFile && brand) {
        payload.image_url = brand.image_url
      }

      const saveResult = await saveBrand(payload)

      if (saveResult.error || !saveResult.brand?.id) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: saveResult.error || "Не удалось сохранить бренд",
        })
        return
      }

      if (imageSource === "upload" && selectedFile) {
        const formData = new FormData()
        formData.append("id", saveResult.brand.id.toString())
        formData.append("file", selectedFile)

        const uploadResult = await uploadBrandImage(formData)

        if (uploadResult.error || !uploadResult.url) {
          toast({
            variant: "destructive",
            title: "Ошибка загрузки",
            description: uploadResult.error || "Файл не был загружен, но текстовые данные сохранены.",
          })
          onClose()
          return
        }

        const finalPayload = {
          id: saveResult.brand.id,
          name,
          country,
          description,
          image_url: uploadResult.url,
        }
        await saveBrand(finalPayload)
      }

      toast({ title: "Успех!", description: "Бренд успешно сохранен." })
      onClose()
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{brand ? "Редактировать бренд" : "Создать бренд"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
          {/* Левая колонка: Текстовые поля */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Страна</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={8}
              />
            </div>
          </div>

          {/* Правая колонка: Изображение */}
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Label>Предпросмотр</Label>
              <div className="w-full aspect-video rounded border bg-gray-50 flex items-center justify-center">
                {preview ? (
                  <Image
                    src={getImageUrl(preview) ?? ""}
                    alt="Предпросмотр"
                    width={300}
                    height={150}
                    className="object-contain h-full w-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm text-gray-400">Предпросмотр</span>
                )}
              </div>
              {imageUrl && (
                <Button variant="destructive" size="sm" onClick={handleRemoveImage} disabled={isPending}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить изображение
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Источник изображения</Label>
              <RadioGroup
                value={imageSource}
                onValueChange={(v) => setImageSource(v as ImageSource)}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="url" id="url" />
                  <Label htmlFor="url">URL</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upload" id="upload" />
                  <Label htmlFor="upload">Загрузить</Label>
                </div>
              </RadioGroup>
            </div>

            {imageSource === "url" ? (
              <div className="space-y-2">
                <Label htmlFor="image_url">URL изображения</Label>
                <Input
                  id="image_url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={isPending}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="file-upload">Файл</Label>
                <Input id="file-upload" type="file" onChange={handleFileChange} accept="image/*" disabled={isPending} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
