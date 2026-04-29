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
import { Trash2, Crop as CropIcon } from "lucide-react"
import { ImageCropperDialog } from "./image-cropper-dialog"

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
  // Source for the cropper modal — we read the picked file as a data URL,
  // open the cropper, and replace selectedFile with the cropped result.
  const [cropSource, setCropSource] = useState<{ src: string; name: string; type: string } | null>(null)

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
    const file = e.target.files?.[0]
    if (!file) return
    // Open the cropper instead of accepting the raw file directly. The cropper
    // calls back with a 600x600 1:1 crop that we then use as selectedFile.
    const reader = new FileReader()
    reader.onload = () => {
      setCropSource({ src: String(reader.result), name: file.name, type: file.type || "image/png" })
    }
    reader.readAsDataURL(file)
    // Reset the input so re-picking the same file still triggers onChange.
    e.target.value = ""
  }

  const handleCropApply = (cropped: File) => {
    setSelectedFile(cropped)
    setImageUrl("")
    setCropSource(null)
  }

  const reopenCropperForCurrentFile = () => {
    if (!selectedFile) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropSource({ src: String(reader.result), name: selectedFile.name, type: selectedFile.type || "image/png" })
    }
    reader.readAsDataURL(selectedFile)
  }

  const [urlCropBusy, setUrlCropBusy] = useState(false)
  const handleCropFromUrl = async () => {
    const raw = imageUrl.trim()
    if (!raw) {
      toast({ variant: "destructive", title: "Укажите URL изображения" })
      return
    }
    setUrlCropBusy(true)
    try {
      // For absolute (external) URLs we go through our same-origin proxy to
      // sidestep CORS / tainted-canvas. For internal /uploads/... the proxy
      // also works fine.
      const absolute = raw.startsWith("http") ? raw : `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`
      const proxied = `/api/proxy-image?url=${encodeURIComponent(absolute)}`
      const resp = await fetch(proxied)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(new Error("Не удалось прочитать файл"))
        r.readAsDataURL(blob)
      })
      const fileName = raw.split("?")[0].split("/").pop() || "brand-image"
      setCropSource({ src: dataUrl, name: fileName, type: blob.type || "image/png" })
    } catch (err: any) {
      console.error("URL crop fetch failed:", err)
      toast({
        variant: "destructive",
        title: "Не удалось загрузить картинку",
        description: err?.message || "Проверьте URL и доступность файла",
      })
    } finally {
      setUrlCropBusy(false)
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
      // Priority: a freshly cropped/picked file always wins (it might have come
      // from either the upload picker or the "crop from URL" button). After
      // that, we honour the radio selection. Finally, fall back to whatever
      // image the brand already had so we don't accidentally clear it.
      if (selectedFile) {
        // image_url will be set after the upload below
      } else if (imageSource === "url") {
        payload.image_url = imageUrl
      } else if (brand) {
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

      if (selectedFile) {
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
              <Label>Предпросмотр (как карточка на сайте)</Label>
              <div className="w-64 aspect-square rounded-xl border bg-gray-50 flex items-center justify-center overflow-hidden">
                {preview ? (
                  <Image
                    src={getImageUrl(preview) ?? ""}
                    alt="Предпросмотр"
                    width={400}
                    height={400}
                    className="object-cover h-full w-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm text-gray-400">Предпросмотр</span>
                )}
              </div>
              <div className="flex gap-2">
                {selectedFile && (
                  <Button variant="outline" size="sm" onClick={reopenCropperForCurrentFile} disabled={isPending}>
                    <CropIcon className="mr-2 h-4 w-4" />
                    Обрезать заново
                  </Button>
                )}
                {imageUrl && (
                  <Button variant="destructive" size="sm" onClick={handleRemoveImage} disabled={isPending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить изображение
                  </Button>
                )}
              </div>
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
                <div className="flex gap-2">
                  <Input
                    id="image_url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={isPending || urlCropBusy}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCropFromUrl}
                    disabled={isPending || urlCropBusy || !imageUrl.trim()}
                    title="Загрузить картинку с URL и открыть обрезку"
                  >
                    <CropIcon className="h-4 w-4 mr-2" />
                    {urlCropBusy ? "Загрузка..." : "Обрезать"}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Без обрезки картинка по URL сохранится как есть. Нажмите «Обрезать» чтобы кадрировать её под квадрат 1:1.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="file-upload">Файл</Label>
                <Input id="file-upload" type="file" onChange={handleFileChange} accept="image/*" disabled={isPending} />
                <p className="text-[11px] text-gray-500">
                  После выбора файла откроется окно обрезки 1:1. Кнопка «Обрезать заново» в превью позволит изменить кадр до сохранения.
                </p>
              </div>
            )}

            <div className="rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 space-y-1">
              <p><strong>Рекомендуемый размер:</strong> 600 × 600 px (квадрат, соотношение 1:1).</p>
              <p>Логотип бренда отображается в каталоге и на главной как квадратная карточка с обрезкой по краям (object-cover). Минимум — 300 × 300 px.</p>
              <p>Формат: PNG (с прозрачным или белым фоном) / JPG / WebP. Размер файла: до 5 MB.</p>
            </div>
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

      {cropSource && (
        <ImageCropperDialog
          src={cropSource.src}
          fileName={cropSource.name}
          fileType={cropSource.type}
          aspect={1}
          outputWidth={600}
          title="Обрежьте логотип бренда"
          onApply={handleCropApply}
          onCancel={() => setCropSource(null)}
        />
      )}
    </Dialog>
  )
}
