"use client"

import type React from "react"
import { useState, useEffect, useTransition, useRef } from "react"
import {
  type Product,
  createProductDraft,
  deleteProductDraft,
  finalizeProduct,
  updateProduct,
} from "@/app/actions/products"
import type { Category } from "@/app/actions/categories"
import type { Brand, Status } from "@/app/actions/meta"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, List, ImageIcon, FileText, ChevronsUpDown, BookOpen } from "lucide-react"
import { ParentCategoryDialog } from "./parent-category-dialog"
import { ProductCharacteristicsDialog } from "./product-characteristics-dialog"
import { ProductMediaDialog } from "./product-media-dialog"
import { ProductDocumentsDriversDialog } from "./product-documents-drivers-dialog"
import { CharacteristicsListDialog } from "./characteristics-list-dialog"

interface ProductEditDialogProps {
  product?: Product | null
  categories: Category[]
  brands: Brand[]
  statuses: Status[]
  onClose: () => void
  onUpdate: () => void
}

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

export function ProductEditDialog({
  product,
  categories,
  brands,
  statuses,
  onClose,
  onUpdate,
}: ProductEditDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isInitializing, setIsInitializing] = useState(!product)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const draftCreationRef = useRef(false)

  const [draftId, setDraftId] = useState<number | null>(product?.id ?? null)
  const [serverSlug, setServerSlug] = useState<string>("")

  const [name, setName] = useState(product?.name ?? "")
  const [article, setArticle] = useState(product?.article ?? "")
  const [price, setPrice] = useState(product?.price ?? 0)
  const [wholesalePrice, setWholesalePrice] = useState(product?.wholesale_price ?? 0)
  const [quantity, setQuantity] = useState(product?.quantity ?? 0)

  // Правильная обработка статуса
  const getInitialStatusId = () => {
    if (!product) return "no-status"
    if (typeof product.status === "string") {
      return product.status === "no" ? "no-status" : product.status
    }
    return product.status?.id ? String(product.status.id) : "no-status"
  }
  const [statusId, setStatusId] = useState(getInitialStatusId())

  const [isVisible, setIsVisible] = useState(product?.is_visible ?? true)
  const [country, setCountry] = useState(product?.country ?? "")
  // Если бренд null/undefined или "no", устанавливаем "no-brand"
  const [brandName, setBrandName] = useState(product?.brand === "no" || !product?.brand ? "no-brand" : product.brand)
  const [description, setDescription] = useState(product?.description ?? "")
  const [categoryId, setCategoryId] = useState(String(product?.category_id ?? "0"))
  const [categoryName, setCategoryName] = useState("")

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(!!product?.slug)

  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showCharacteristicsDialog, setShowCharacteristicsDialog] = useState(false)
  const [showMediaDialog, setShowMediaDialog] = useState(false)
  const [showDocumentsDriversDialog, setShowDocumentsDriversDialog] = useState(false)
  const [showCharacteristicsListDialog, setShowCharacteristicsListDialog] = useState(false)

  const isEditMode = !!product

  // Создаем черновик только при создании нового товара
  useEffect(() => {
    if (!isEditMode && isInitializing && !isCreatingDraft && !draftCreationRef.current) {
      console.log("Creating product draft...")
      draftCreationRef.current = true
      setIsCreatingDraft(true)
      
      createProductDraft().then((result) => {
        console.log("Create draft result:", result)
        if (result.success && result.id) {
          console.log("Setting draft ID:", result.id)
          setDraftId(result.id)
          // Устанавливаем артикул от сервера
          if (result.article) {
            setArticle(result.article)
          }
          toast({ title: "Черновик создан", description: "Можете начать заполнение данных товара." })
        } else {
          console.error("Failed to create draft:", result.error)
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: result.error || "Не удалось создать черновик.",
          })
          onClose()
        }
        setIsInitializing(false)
        setIsCreatingDraft(false)
      }).catch((error) => {
        console.error("Error creating draft:", error)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Произошла ошибка при создании черновика.",
        })
        setIsInitializing(false)
        setIsCreatingDraft(false)
        onClose()
      })
    }
  }, [isEditMode, isInitializing, isCreatingDraft, toast])

  useEffect(() => {
    const findCategoryName = (id: string, cats: Category[]): string => {
      if (id === "0") return "-- Без категории --"
      for (const cat of cats) {
        if (String(cat.id) === id) return cat.name
        if (cat.children) {
          const foundName = findCategoryName(id, cat.children)
          if (foundName && foundName !== "-- Без категории --") return foundName
        }
      }
      return "-- Без категории --"
    }
    setCategoryName(findCategoryName(categoryId, categories))
  }, [categoryId, categories])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!isSlugManuallyEdited) {
      setServerSlug(generateSlug(newName))
    }
  }

  const handleBrandChange = (selectedBrandName: string) => {
    setBrandName(selectedBrandName)
    if (selectedBrandName === "no-brand") {
      setCountry("")
    } else {
      const selectedBrand = brands.find((b) => b.name === selectedBrandName)
      if (selectedBrand) {
        setCountry(selectedBrand.country)
      }
    }
  }

  const handleSelectCategory = (categoryId: number | null) => {
    setCategoryId(categoryId === null ? "0" : String(categoryId))
    if (categoryId === null) {
      setCategoryName("-- Без категории --")
    } else {
      const findCategoryName = (id: number, cats: Category[]): string => {
        for (const cat of cats) {
          if (cat.id === id) return cat.name
          if (cat.children) {
            const foundName = findCategoryName(id, cat.children)
            if (foundName && foundName !== "-- Без категории --") return foundName
          }
        }
        return "-- Без категории --"
      }
      setCategoryName(findCategoryName(categoryId, categories))
    }
  }

  const handleSave = () => {
    // Сбрасываем флаг создания черновика
    draftCreationRef.current = false
    
    if (!draftId) {
      toast({ variant: "destructive", title: "Ошибка", description: "ID товара не определен. Попробуйте снова." })
      return
    }

    // Проверяем только обязательное поле - название
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Ошибка", description: "Название товара обязательно." })
      return
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        article: article.trim() || undefined,
        price: Number(price) || 0,
        wholesale_price: Number(wholesalePrice) || 0,
        quantity: Number(quantity) || 0,
        // Если выбран "no-status", отправляем 'no', иначе отправляем число как строку
        status: statusId === "no-status" ? "no" : statusId,
        is_visible: isVisible,
        country: country.trim(),
        // Если выбран "no-brand", отправляем 'no', иначе отправляем название бренда
        brand: brandName === "no-brand" ? "no" : brandName,
        description: description?.trim() || null,
        category_id: categoryId === "0" ? null : Number(categoryId),
      }

      let result

      if (isEditMode) {
        result = await updateProduct(draftId, payload)
        if (!result.success) {
          toast({ variant: "destructive", title: "Ошибка сохранения", description: result.error })
        } else {
          toast({
            title: "Успех!",
            description: `Товар успешно обновлен.`,
          })
          onUpdate()
          onClose()
        }
      } else {
        result = await finalizeProduct(draftId, payload)
        if (!result.success) {
          toast({ variant: "destructive", title: "Ошибка сохранения", description: result.error })
        } else {
          toast({
            title: "Успех!",
            description: `Товар успешно создан.`,
          })
          onUpdate()
          onClose()
        }
      }
    })
  }

  const handleCancel = () => {
    console.log("handleCancel called", { isEditMode, draftId })
    
    // Сбрасываем флаг создания черновика
    draftCreationRef.current = false
    
    if (!isEditMode && draftId) {
      // Для создания товара - удаляем черновик
      console.log("Attempting to delete draft with ID:", draftId)
      startTransition(async () => {
        try {
          const result = await deleteProductDraft(draftId)
          console.log("Delete draft result:", result)
          if (!result.success) {
            toast({
              variant: "destructive",
              title: "Предупреждение",
              description: `Не удалось удалить черновик: ${result.error}`,
            })
          } else {
            toast({
              title: "Черновик удален",
              description: "Черновик товара успешно удален.",
            })
          }
        } catch (error) {
          console.error("Error in handleCancel:", error)
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: "Произошла ошибка при удалении черновика.",
          })
        }
        onClose()
      })
    } else {
      // Для редактирования товара - просто закрываем форму
      console.log("Closing form without deleting draft")
      onClose()
    }
  }

  // Показываем загрузку только при инициализации создания нового товара
  if (isInitializing) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="mt-4 text-gray-600">Создание черновика...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={true} onOpenChange={handleCancel}>
        <DialogContent className="sm:max-w-4xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? `Редактировать: ${name}` : "Создать новый товар"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
            {/* Left Column */}
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="name">Название *</Label>
                  <Input id="name" value={name} onChange={handleNameChange} required disabled={isPending} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="slug">URL (slug)</Label>
                  <Input
                    id="slug"
                    value={product?.slug || serverSlug}
                    disabled={true}
                    placeholder="Генерируется сервером"
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="article">Артикул</Label>
                  <Input
                    id="article"
                    value={article}
                    onChange={(e) => setArticle(e.target.value)}
                    disabled={isPending}
                    placeholder={!article ? "Генерируется сервером" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Цена</Label>
                  <Input
                    id="price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wholesale_price">Оптовая цена</Label>
                  <Input
                    id="wholesale_price"
                    type="number"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(Number(e.target.value))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Кол-во</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status_id">Статус</Label>
                  <Select value={statusId} onValueChange={setStatusId} disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-status">Без статуса</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_name">Бренд</Label>
                  <Select value={brandName} onValueChange={handleBrandChange} disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите бренд" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-brand">Без бренда</SelectItem>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.name}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Страна</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Категория</Label>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-transparent"
                  onClick={() => setShowCategoryDialog(true)}
                  disabled={isPending}
                >
                  <span>{categoryName}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </div>

              <Card>
                <CardHeader className="p-4 flex-row items-center justify-between">
                  <CardDescription>Укажите будет ли виден товар для клиентов на страницах магазина</CardDescription>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="is_visible">{isVisible ? "Виден" : "Скрыт"}</Label>
                    <Switch id="is_visible" checked={isVisible} onCheckedChange={setIsVisible} disabled={isPending} />
                  </div>
                </CardHeader>
              </Card>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={description ?? ""}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  disabled={isPending}
                />
              </div>

              <Card>
                <CardHeader className={`p-4 ${isEditMode ? 'flex-row items-center justify-between' : 'flex-col items-start space-y-3'}`}>
                  <CardDescription>
                    Тут вы можете управлять списком характеристик для товара, и их очерёдностью
                  </CardDescription>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCharacteristicsDialog(true)}
                      disabled={isPending || !draftId}
                    >
                      <List className="mr-2 h-4 w-4" /> Характеристики
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCharacteristicsListDialog(true)}
                      disabled={isPending}
                    >
                      <BookOpen className="mr-2 h-4 w-4" /> Справочник
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className={`p-4 ${isEditMode ? 'flex-row items-center justify-between' : 'flex-col items-start space-y-3'}`}>
                  <CardDescription>
                    Тут вы можете добавить Изображения и Видео для товара, и указать их очерёдность
                  </CardDescription>
                  <Button variant="outline" onClick={() => setShowMediaDialog(true)} disabled={isPending || !draftId}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Медиа
                  </Button>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className={`p-4 ${isEditMode ? 'flex-row items-center justify-between' : 'flex-col items-start space-y-3'}`}>
                  <CardDescription>Тут вы можете добавить Документацию и Драйвера для товара</CardDescription>
                  <Button
                    variant="outline"
                    onClick={() => setShowDocumentsDriversDialog(true)}
                    disabled={isPending || !draftId}
                  >
                    <FileText className="mr-2 h-4 w-4" /> Документы/Драйверы
                  </Button>
                </CardHeader>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={isPending}>
              {isPending && !isEditMode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isPending || !draftId}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParentCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        categories={categories}
        selectedCategoryId={categoryId === "0" ? null : Number(categoryId)}
        onSelect={handleSelectCategory}
        title="Выберите категорию товара"
      />

      {showCharacteristicsDialog && draftId && (
        <ProductCharacteristicsDialog productId={draftId} onClose={() => setShowCharacteristicsDialog(false)} />
      )}
      {showMediaDialog && draftId && (
        <ProductMediaDialog productId={draftId} onClose={() => setShowMediaDialog(false)} />
      )}
      {showDocumentsDriversDialog && draftId && (
        <ProductDocumentsDriversDialog productId={draftId} onClose={() => setShowDocumentsDriversDialog(false)} />
      )}
      
      <CharacteristicsListDialog
        open={showCharacteristicsListDialog}
        onOpenChange={setShowCharacteristicsListDialog}
      />
    </>
  )
}
