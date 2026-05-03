"use client"

import type React from "react"

import { useState, useEffect, useTransition } from "react"
import Image from "next/image"
import {
  type Category,
  saveCategory,
  uploadCategoryImage,
  deleteCategoryImage,
  setCategoryImageUrl,
  getCategories,
} from "@/app/actions/categories"
import { API_BASE_URL } from "@/lib/api-address"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { ParentCategoryDialog } from "./parent-category-dialog"
import { ImageCropperDialog } from "./image-cropper-dialog"
import { ChevronDown, Crop as CropIcon } from "lucide-react"

interface CategoryEditDialogProps {
  category?: Category | null
  allCategories: Category[]
  parentId?: number | null
  onClose: () => void
  onUpdate?: (updatedCategory?: Category) => void
}

type ImageSource = "none" | "url" | "upload"

function generateSlug(text: string): string {
  const translit: { [key: string]: string } = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  }
  return text
    .toLowerCase()
    .split("")
    .map((char) => translit[char] || char)
    .join("")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Функция для получения обновленной категории
async function getUpdatedCategory(categoryId: number): Promise<Category | null> {
  try {
    const allCategories = await getCategories()

    // Функция для поиска категории в дереве
    const findCategory = (categories: Category[]): Category | null => {
      for (const cat of categories) {
        if (cat.id === categoryId) {
          return cat
        }
        if (cat.children && cat.children.length > 0) {
          const found = findCategory(cat.children)
          if (found) return found
        }
      }
      return null
    }

    return findCategory(allCategories)
  } catch (error) {
    console.error("Error fetching updated category:", error)
    return null
  }
}

export function CategoryEditDialog({
  category,
  allCategories,
  parentId: passedInParentId,
  onClose,
  onUpdate,
}: CategoryEditDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(category?.name ?? "")
  const [slug, setSlug] = useState(category?.slug ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [parentId, setParentId] = useState(String(category?.parent_id ?? passedInParentId ?? "0"))
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(!!category?.slug)
  const [imageSource, setImageSource] = useState<ImageSource>(category?.image_url ? "url" : "none")
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? "")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0) // Ключ для обновления превью
  const [showParentDialog, setShowParentDialog] = useState(false)
  const [showInMenu, setShowInMenu] = useState(category?.show_in_menu ?? true)
  const [cropSource, setCropSource] = useState<{ src: string; name: string; type: string } | null>(null)
  const [urlCropBusy, setUrlCropBusy] = useState(false)

  const isEditMode = !!category && !!category.id

  useEffect(() => {
    if (category?.image_url) {
      const imageUrl = category.image_url.startsWith("http")
        ? category.image_url
        : `${API_BASE_URL}${category.image_url}`
      setPreview(`${imageUrl}?v=${Date.now()}`) // Добавляем timestamp для обновления
    }
    if (category?.show_in_menu !== undefined) {
      setShowInMenu(category.show_in_menu)
    }
  }, [category])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!isSlugManuallyEdited) {
      setSlug(generateSlug(newName))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropSource({ src: String(reader.result), name: file.name, type: file.type || "image/png" })
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleCropApply = (cropped: File) => {
    setSelectedFile(cropped)
    const objectUrl = URL.createObjectURL(cropped)
    setPreview(objectUrl)
    setPreviewKey((prev) => prev + 1)
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

  const handleCropFromUrl = async () => {
    const raw = imageUrl.trim()
    if (!raw) {
      toast({ variant: "destructive", title: "Укажите URL изображения" })
      return
    }
    setUrlCropBusy(true)
    try {
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
      const fileName = raw.split("?")[0].split("/").pop() || "category-image"
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

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value
    setImageUrl(newUrl)
  }

  const handleImageUrlBlur = () => {
    if (imageUrl) {
      setPreview(`${imageUrl}?v=${Date.now()}`)
      setPreviewKey((prev) => prev + 1)
    }
  }

  const handleSubmit = () => {
    if (isEditMode && !category?.id) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "ID категории не найден",
      })
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append("name", name)
      formData.append("slug", slug)
      formData.append("description", description)
      formData.append("parent_id", parentId)
      formData.append("show_in_menu", showInMenu ? "true" : "false")

      // Проверяем, изменилась ли родительская категория
      const originalParentId = category?.parent_id ?? null
      const newParentId = parentId === "0" ? null : Number(parentId)
      const parentChanged = originalParentId !== newParentId

      if (isEditMode && category?.id) {
        formData.append("id", String(category.id))
      } else if (imageSource === "upload" && selectedFile) {
        formData.append("file", selectedFile)
      }

      const saveResult = await saveCategory(formData)

      if (saveResult.error || !saveResult.category) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: saveResult.error || "Не удалось сохранить данные",
        })
        return
      }

      const categoryId = saveResult.category.id
      let imageActionPromise: Promise<any> | null = null

      if (isEditMode && category?.id) {
        // Создаем обновленный объект категории с новыми данными
        const updatedCategory: Category = {
          ...category,
          name,
          slug,
          description,
          parent_id: parentId === "0" ? null : Number(parentId),
        }

        // Priority: a freshly cropped/picked file always wins, regardless of
        // which radio was selected (it could have come from "Обрезать" on URL).
        if (selectedFile) {
          const imageFormData = new FormData()
          imageFormData.append("file", selectedFile)
          imageActionPromise = uploadCategoryImage(category.id, imageFormData)
        } else if (imageSource === "url" && imageUrl) {
          imageActionPromise = setCategoryImageUrl(updatedCategory, imageUrl)
        } else if (imageSource === "none") {
          imageActionPromise = deleteCategoryImage(category.id)
        }
      } else {
        // For new categories: cropped file goes via uploadCategoryImage on the
        // newly-created id; otherwise honour the URL choice.
        if (selectedFile) {
          const imageFormData = new FormData()
          imageFormData.append("file", selectedFile)
          imageActionPromise = uploadCategoryImage(categoryId, imageFormData)
        } else if (imageSource === "url" && imageUrl) {
          const newCategory: Category = {
            id: categoryId,
            name,
            slug,
            description,
            parent_id: parentId === "0" ? null : Number(parentId),
            image_url: null,
            order: 0,
          }
          imageActionPromise = setCategoryImageUrl(newCategory, imageUrl)
        }
      }

      if (imageActionPromise) {
        const imageResult = await imageActionPromise
        if (imageResult.error) {
          toast({
            variant: "destructive",
            title: "Ошибка изображения",
            description: `${imageResult.error} (основные данные сохранены)`,
          })
        }
      }

      toast({ title: "Успех!", description: "Категория успешно сохранена." })

      // Обновляем данные в родительском компоненте
      if (onUpdate) {
        if (isEditMode && category?.id) {
          // Если изменилась родительская категория, полностью обновляем список
          if (parentChanged) {
            onUpdate() // Без параметра - полное обновление
          } else {
            // Если родительская категория не изменилась, обновляем только данные категории
            const updatedCategory = await getUpdatedCategory(category.id)
            onUpdate(updatedCategory || undefined)
          }
        } else {
          // Для создания обновляем весь список
          onUpdate()
        }
      }

      onClose()
    })
  }

  const getValidParentCategories = () => {
    if (!isEditMode || !category?.id) return allCategories
    const descendantIds = new Set<number>()
    const getDescendants = (cat: Category) => {
      descendantIds.add(cat.id)
      cat.children?.forEach(getDescendants)
    }
    getDescendants(category)
    return allCategories.filter((c) => !descendantIds.has(c.id))
  }

  const getSelectedParentName = () => {
    if (parentId === "0" || parentId === "") return "-- Корневая категория --"
    const selectedId = Number(parentId)
    const findCategory = (cats: Category[]): Category | null => {
      for (const cat of cats) {
        if (cat.id === selectedId) return cat
        if (cat.children) {
          const found = findCategory(cat.children)
          if (found) return found
        }
      }
      return null
    }
    const selected = findCategory(allCategories)
    return selected ? selected.name : "-- Корневая категория --"
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Редактировать категорию" : "Создать категорию"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Левая колонка: данные */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={name}
                onChange={handleNameChange}
                required
                className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL (slug)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setIsSlugManuallyEdited(true)
                }}
                required
                className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_id">Родительская категория</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                onClick={() => setShowParentDialog(true)}
              >
                <span className="truncate">{getSelectedParentName()}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
              />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="show_in_menu" className="flex-1">Отображать в меню</Label>
              <Switch
                id="show_in_menu"
                checked={showInMenu}
                onCheckedChange={setShowInMenu}
                disabled={isPending}
              />
            </div>
          </div>
          {/* Правая колонка: изображение */}
          <div className="space-y-4">
            <Label>Изображение</Label>
            <RadioGroup value={imageSource} onValueChange={(v) => setImageSource(v as ImageSource)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="r-none" />
                <Label htmlFor="r-none">Без изображения</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="url" id="r-url" />
                <Label htmlFor="r-url">URL</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="upload" id="r-upload" />
                <Label htmlFor="r-upload">Загрузить</Label>
              </div>
            </RadioGroup>

            {imageSource === "url" && (
              <div className="space-y-2">
                <Label htmlFor="image_url">Ссылка на изображение</Label>
                <div className="flex gap-2">
                  <Input
                    id="image_url"
                    value={imageUrl}
                    onChange={handleImageUrlChange}
                    onBlur={handleImageUrlBlur}
                    disabled={urlCropBusy}
                    className="flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCropFromUrl}
                    disabled={urlCropBusy || !imageUrl.trim()}
                    title="Загрузить картинку с URL и открыть обрезку"
                    className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                  >
                    <CropIcon className="h-4 w-4 mr-2" />
                    {urlCropBusy ? "Загрузка..." : "Обрезать"}
                  </Button>
                </div>
              </div>
            )}
            {imageSource === "upload" && (
              <div className="space-y-2">
                <Label htmlFor="file">Файл</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
                />
                <p className="text-[11px] text-gray-500">
                  После выбора откроется окно обрезки 1:1. Карточка категории квадратная — кадр будет показан на сайте именно так.
                </p>
              </div>
            )}

            {(preview || (imageSource !== "none" && category?.image_url)) && (
              <div className="flex flex-col items-center gap-2 pt-4">
                <Label>Предпросмотр (как карточка на сайте)</Label>
                <div className="w-48 h-48 rounded-md border overflow-hidden bg-gray-50 flex items-center justify-center">
                  <Image
                    src={preview || "/placeholder.svg"}
                    alt="Предпросмотр"
                    width={300}
                    height={300}
                    className="object-cover w-full h-full"
                    unoptimized
                    key={`preview-${previewKey}`}
                    onError={() => setPreview("/placeholder.svg?width=200&height=200")}
                  />
                </div>
                {selectedFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={reopenCropperForCurrentFile}
                    className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                  >
                    <CropIcon className="h-4 w-4 mr-2" />
                    Обрезать заново
                  </Button>
                )}
              </div>
            )}

            <div className="rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 space-y-1">
              <p><strong>Рекомендуемый размер:</strong> 600 × 600 px (квадрат, соотношение 1:1).</p>
              <p>Карточка категории отображается в каталоге как квадрат с обрезкой по краям (object-cover). Минимум — 300 × 300 px. Формат PNG/JPG/WebP, до 5 MB.</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
          >
            {isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Диалог выбора родительской категории */}
      <ParentCategoryDialog
        open={showParentDialog}
        onOpenChange={setShowParentDialog}
        categories={getValidParentCategories()}
        selectedCategoryId={parentId === "0" ? null : Number(parentId)}
        onSelect={(categoryId) => {
          setParentId(categoryId === null ? "0" : String(categoryId))
        }}
        excludeCategoryId={isEditMode ? category?.id : undefined}
        title="Выберите родительскую категорию"
      />

      {cropSource && (
        <ImageCropperDialog
          src={cropSource.src}
          fileName={cropSource.name}
          fileType={cropSource.type}
          aspect={1}
          outputWidth={600}
          title="Обрежьте изображение категории"
          onApply={handleCropApply}
          onCancel={() => setCropSource(null)}
        />
      )}
    </Dialog>
  )
}
