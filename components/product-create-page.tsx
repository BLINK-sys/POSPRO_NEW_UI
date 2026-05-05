"use client"

import type React from "react"
import { useState, useEffect, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  createProductDraft,
  deleteProductDraft,
  finalizeProduct,
  bulkAddCharacteristicsByKey,
  uploadProductImageFromUrl,
} from "@/app/actions/products"
import { markImportLogSaved } from "@/app/actions/ai-logs"
import type { Category } from "@/app/actions/categories"
import type { Brand, Status } from "@/app/actions/meta"
import type { Supplier } from "@/app/actions/suppliers"
import { type Warehouse, getWarehouses } from "@/app/actions/warehouses"
import { type ProductCost, createProductCost, updateProductCost, deleteProductCost } from "@/app/actions/product-costs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2, List, ImageIcon, FileText, ChevronsUpDown, ArrowLeft, BookOpen,
  Warehouse as WarehouseIcon, Plus, Trash2, Wand2,
} from "lucide-react"
import { ParentCategoryDialog } from "./parent-category-dialog"
import { BrandSelectDialog } from "./brand-select-dialog"
import { ProductCharacteristicsDialog } from "./product-characteristics-dialog"
import { ProductMediaDialog } from "./product-media-dialog"
import { ProductDocumentsDriversDialog } from "./product-documents-drivers-dialog"
import { CharacteristicsListDialog } from "./characteristics-list-dialog"
import { ProductImportFromUrlDialog, type ImportedProductData } from "./product-import-from-url-dialog"
import { cn } from "@/lib/utils"

// Единая стилизация в духе таблицы товаров: убираем чёрную рамку фокуса и
// добавляем мягкую тень с небольшим лифтом на hover, чтобы все элементы
// смотрелись «объёмно» и одинаково.
const FOCUS_NO_RING =
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  FOCUS_NO_RING
const CARD_CLASS =
  "rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface ProductCreatePageProps {
  categories: Category[]
  brands: Brand[]
  statuses: Status[]
  suppliers: Supplier[]
}

function generateSlug(text: string): string {
  const translit: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
    ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
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

export function ProductCreatePage({ categories, brands, statuses, suppliers }: ProductCreatePageProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isInitializing, setIsInitializing] = useState(true)
  const draftCreationRef = useRef(false)

  const [draftId, setDraftId] = useState<number | null>(null)
  const [serverSlug, setServerSlug] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const draftIdRef = useRef<number | null>(null)

  const [name, setName] = useState("")
  const [article, setArticle] = useState("")
  const [price, setPrice] = useState(0)
  const [wholesalePrice, setWholesalePrice] = useState(0)
  const [quantity, setQuantity] = useState(0)
  const [statusId, setStatusId] = useState("no-status")
  const [isVisible, setIsVisible] = useState(true)
  const [country, setCountry] = useState("")
  const [brandId, setBrandId] = useState("no-brand")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("0")
  const [categoryName, setCategoryName] = useState("-- Без категории --")
  const [supplierId, setSupplierId] = useState("no-supplier")
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)

  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showBrandDialog, setShowBrandDialog] = useState(false)
  const [showCharacteristicsDialog, setShowCharacteristicsDialog] = useState(false)
  const [showMediaDialog, setShowMediaDialog] = useState(false)
  const [showDocumentsDriversDialog, setShowDocumentsDriversDialog] = useState(false)
  const [showCharacteristicsListDialog, setShowCharacteristicsListDialog] = useState(false)

  // AI URL-import access — checked once on mount. The button stays hidden
  // until backend confirms the current system user is in the
  // allowed_product_import_user_ids list (or is the owner).
  const [importAccess, setImportAccess] = useState<boolean | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importing, setImporting] = useState(false)
  // ID лога импорта — приходит из диалога после успешного auto-fill.
  // Используется при handleSave чтобы PATCH-нуть статус лога на 'saved'
  // и связать с реально созданным product_id.
  const [importLogId, setImportLogId] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/product-import/access", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setImportAccess(Boolean(d?.has_access))
      })
      .catch(() => {
        if (!cancelled) setImportAccess(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Warehouse costs
  const [allCosts, setAllCosts] = useState<ProductCost[]>([])
  const [supplierWarehouses, setSupplierWarehouses] = useState<Warehouse[]>([])
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false)
  const [addingWarehouseId, setAddingWarehouseId] = useState("")
  const [addingCostPrice, setAddingCostPrice] = useState("")
  const [addingQuantity, setAddingQuantity] = useState("")
  const quantityDebouncesRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // Create draft on mount
  useEffect(() => {
    if (!draftCreationRef.current) {
      draftCreationRef.current = true
      createProductDraft().then((result) => {
        if (result.success && result.id) {
          setDraftId(result.id)
          draftIdRef.current = result.id
          if (result.article) setArticle(result.article)
          toast({ title: "Черновик создан", description: "Можете начать заполнение данных товара." })
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.error || "Не удалось создать черновик." })
          router.push("/admin/catalog/products")
        }
        setIsInitializing(false)
      }).catch(() => {
        toast({ variant: "destructive", title: "Ошибка", description: "Ошибка при создании черновика." })
        setIsInitializing(false)
        router.push("/admin/catalog/products")
      })
    }
  }, [toast, router])

  // Warn on page reload/close + delete draft
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draftIdRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // Intercept all link clicks — if navigating away, delete draft first
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest("a")
      if (!link) return

      const href = link.getAttribute("href")
      if (!href || href === "#") return

      // If navigating away from create page and draft exists
      if (!href.includes("/admin/catalog/products/create") && draftIdRef.current) {
        e.preventDefault()
        e.stopPropagation()
        const id = draftIdRef.current
        draftIdRef.current = null
        deleteProductDraft(id).then(() => {
          router.push(href)
        }).catch(() => {
          router.push(href)
        })
      }
    }
    window.addEventListener("click", handleClick, true)
    return () => window.removeEventListener("click", handleClick, true)
  }, [router])

  // Intercept browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      if (draftIdRef.current) {
        const id = draftIdRef.current
        draftIdRef.current = null
        deleteProductDraft(id).catch(() => {})
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Load supplier warehouses
  useEffect(() => {
    if (supplierId === "no-supplier") {
      setSupplierWarehouses([])
      return
    }
    setIsLoadingWarehouses(true)
    getWarehouses(Number(supplierId)).then((warehouses) => {
      setSupplierWarehouses(warehouses || [])
      setIsLoadingWarehouses(false)
    })
  }, [supplierId])

  // Category name
  useEffect(() => {
    const findName = (id: string, cats: Category[]): string => {
      if (id === "0") return "-- Без категории --"
      for (const cat of cats) {
        if (String(cat.id) === id) return cat.name
        if (cat.children) {
          const found = findName(id, cat.children)
          if (found !== "-- Без категории --") return found
        }
      }
      return "-- Без категории --"
    }
    setCategoryName(findName(categoryId, categories))
  }, [categoryId, categories])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!isSlugManuallyEdited) setServerSlug(generateSlug(newName))
  }

  const handleBrandChange = (selectedBrandId: string) => {
    setBrandId(selectedBrandId)
    if (selectedBrandId === "no-brand") {
      setCountry("")
    } else {
      const selectedBrand = brands.find((b) => b.id === Number(selectedBrandId))
      if (selectedBrand) setCountry(selectedBrand.country || "")
    }
  }

  const handleSelectCategory = (catId: number | null) => {
    setCategoryId(catId === null ? "0" : String(catId))
  }

  const handleAddWarehouseCost = () => {
    if (!addingWarehouseId || !addingCostPrice || !draftId) return
    startTransition(async () => {
      const result = await createProductCost({
        product_id: draftId,
        warehouse_id: Number(addingWarehouseId),
        cost_price: Number(addingCostPrice),
        quantity: Math.max(0, Number(addingQuantity) || 0),
      })
      if (result.success && result.data) {
        setAllCosts([...allCosts, result.data])
        setAddingWarehouseId("")
        setAddingCostPrice("")
        setAddingQuantity("")
        toast({ title: "Себестоимость добавлена" })
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleDeleteWarehouseCost = (costId: number) => {
    startTransition(async () => {
      const result = await deleteProductCost(costId)
      if (result.success) {
        setAllCosts(allCosts.filter((c) => c.id !== costId))
        toast({ title: "Удалено" })
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  // Inline-редактирование остатка с дебаунсом 500мс — то же поведение, что
  // на product-edit-page.tsx, чтобы UX был одинаковым на создании и правке.
  const handleQuantityChange = (costId: number, raw: string) => {
    const value = Math.max(0, parseInt(raw || "0", 10) || 0)
    setAllCosts((prev) => prev.map((c) => (c.id === costId ? { ...c, quantity: value } : c)))

    if (quantityDebouncesRef.current[costId]) {
      clearTimeout(quantityDebouncesRef.current[costId])
    }
    quantityDebouncesRef.current[costId] = setTimeout(async () => {
      const result = await updateProductCost(costId, { quantity: value })
      if (!result.success) {
        toast({ variant: "destructive", title: "Не удалось сохранить остаток", description: result.error })
      }
    }, 500)
  }

  // Apply AI auto-fill result: fills form fields, then asynchronously
  // creates characteristics and downloads images (both attached to the
  // existing draft on the backend). Errors per item are reported as toasts
  // but don't abort the rest — partial success is better than zero.
  const handleImported = async (data: ImportedProductData) => {
    if (!draftId) {
      toast({ variant: "destructive", title: "Нет черновика", description: "Подождите создания черновика и повторите импорт." })
      return
    }
    setImporting(true)

    // Запоминаем ID лога импорта — пометим как 'saved' после реального
    // сохранения товара. data.import_log_id может быть null если бэк не
    // смог записать лог (тихий fallback, основной флоу не страдает).
    if (data.import_log_id) {
      setImportLogId(data.import_log_id)
    }

    if (data.name) setName(data.name)
    if (data.description) setDescription(data.description)

    const tasks: Promise<void>[] = []
    let charsAdded = 0
    let imagesAdded = 0
    let imagesFailed = 0

    if (data.characteristics.length > 0) {
      tasks.push(
        bulkAddCharacteristicsByKey(draftId, data.characteristics).then((res) => {
          if (res.success) charsAdded = res.added
        })
      )
    }

    data.image_urls.forEach((url, idx) => {
      tasks.push(
        uploadProductImageFromUrl(draftId, url, idx).then((res) => {
          if (res.success) imagesAdded += 1
          else imagesFailed += 1
        })
      )
    })

    await Promise.all(tasks)

    setImporting(false)

    const parts: string[] = []
    if (charsAdded > 0) parts.push(`${charsAdded} характ.`)
    if (imagesAdded > 0) parts.push(`${imagesAdded} фото`)
    if (imagesFailed > 0) parts.push(`${imagesFailed} фото не загрузилось`)
    toast({
      title: "Импорт завершён",
      description: parts.length > 0 ? parts.join(" · ") : "Заполнены поля name/описания",
    })
  }

  const handleSave = () => {
    draftCreationRef.current = false
    if (!draftId) {
      toast({ variant: "destructive", title: "Ошибка", description: "ID товара не определен." })
      return
    }
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
        status: statusId === "no-status" ? "no" : statusId,
        is_visible: isVisible,
        country: country.trim(),
        brand_id: brandId === "no-brand" ? null : Number(brandId),
        description: description?.trim() || null,
        category_id: categoryId === "0" ? null : Number(categoryId),
        supplier_id: supplierId === "no-supplier" ? null : Number(supplierId),
      }
      const result = await finalizeProduct(draftId, payload)
      if (result.success) {
        setIsSaved(true)
        draftIdRef.current = null  // Prevent cleanup from deleting finalized product

        // Если товар был создан из AI-импорта — обновляем лог: статус 'saved'
        // + product_id + product_name. Fire-and-forget: ошибка PATCH не должна
        // ломать основной флоу (товар уже создан).
        if (importLogId && draftId) {
          markImportLogSaved(importLogId, draftId, payload.name).catch(() => {})
        }

        toast({ title: "Успех!", description: "Товар успешно создан." })
        router.push("/admin/catalog/products")
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleCancel = () => {
    draftCreationRef.current = false
    if (draftId) {
      draftIdRef.current = null  // Prevent double-delete from unmount cleanup
      startTransition(async () => {
        await deleteProductDraft(draftId)
        toast({ title: "Черновик удалён" })
        router.push("/admin/catalog/products")
      })
    } else {
      router.push("/admin/catalog/products")
    }
  }

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-4 text-gray-600">Создание черновика...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Создать новый товар</h1>
        </div>
        <div className="flex items-center gap-2">
          {importAccess && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowImportDialog(true)}
              disabled={isPending || importing || !draftId}
              className={cn(
                "gap-2 rounded-lg border-brand-yellow/50 bg-brand-yellow/10 hover:bg-brand-yellow/20",
                "shadow-[0_2px_6px_rgba(250,204,21,0.20)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.30)] transition-shadow"
              )}
              title="Заполнить карточку из URL через PosPro AI"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              PosPro AI помощник
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            className={SECONDARY_BTN}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isPending || !draftId} className={PRIMARY_BTN}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input value={name} onChange={handleNameChange} required disabled={isPending} className={SOFT_CONTROL} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL (slug)</Label>
                  <Input value={serverSlug} disabled placeholder="Генерируется" className={cn("bg-gray-50", SOFT_CONTROL)} />
                </div>
                <div className="space-y-2">
                  <Label>Артикул</Label>
                  <Input value={article} onChange={(e) => setArticle(e.target.value)} disabled={isPending} className={SOFT_CONTROL} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} disabled={isPending} className={SOFT_CONTROL} />
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Цена и количество</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Цена</Label>
                  <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} disabled={isPending} className={SOFT_CONTROL} />
                </div>
                <div className="space-y-2">
                  <Label>Оптовая цена</Label>
                  <Input type="number" value={wholesalePrice} onChange={(e) => setWholesalePrice(Number(e.target.value))} disabled={isPending} className={SOFT_CONTROL} />
                </div>
                <div className="space-y-2">
                  <Label>Кол-во</Label>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} disabled={isPending} className={SOFT_CONTROL} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Классификация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Статус</Label>
                  <Select value={statusId} onValueChange={setStatusId} disabled={isPending}>
                    <SelectTrigger className={SOFT_CONTROL}><SelectValue placeholder="Статус" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-status">Без статуса</SelectItem>
                      {statuses.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Бренд</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBrandDialog(true)}
                    disabled={isPending}
                    className={cn("w-full justify-between font-normal bg-transparent", SOFT_CONTROL)}
                  >
                    <span className={brandId === "no-brand" ? "text-gray-400" : ""}>
                      {brandId === "no-brand"
                        ? "Без бренда"
                        : brands.find((b) => String(b.id) === brandId)?.name || "Выберите бренд"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Страна</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} disabled={isPending} className={SOFT_CONTROL} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <Button
                  variant="outline"
                  className={cn("w-full justify-between bg-transparent", SOFT_CONTROL)}
                  onClick={() => setShowCategoryDialog(true)}
                  disabled={isPending}
                >
                  <span>{categoryName}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Поставщик</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={isPending}>
                <SelectTrigger className={SOFT_CONTROL}><SelectValue placeholder="Поставщик" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-supplier">Без поставщика</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader className="p-4 flex-row items-center justify-between">
              <CardDescription>Укажите будет ли виден товар для клиентов на страницах магазина</CardDescription>
              <div className="flex items-center space-x-2">
                <Label>{isVisible ? "Виден" : "Скрыт"}</Label>
                <Switch checked={isVisible} onCheckedChange={setIsVisible} disabled={isPending} />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Характеристики</CardTitle>
              <CardDescription>Управление списком характеристик для товара и их очередностью</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCharacteristicsDialog(true)}
                disabled={isPending || !draftId}
                className={SECONDARY_BTN}
              >
                <List className="mr-2 h-4 w-4" /> Характеристики
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCharacteristicsListDialog(true)}
                disabled={isPending}
                className={SECONDARY_BTN}
              >
                <BookOpen className="mr-2 h-4 w-4" /> Справочник
              </Button>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Медиа</CardTitle>
              <CardDescription>Добавьте изображения и видео для товара</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowMediaDialog(true)}
                disabled={isPending || !draftId}
                className={SECONDARY_BTN}
              >
                <ImageIcon className="mr-2 h-4 w-4" /> Медиа
              </Button>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Документы</CardTitle>
              <CardDescription>Документация и Драйвера для товара</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowDocumentsDriversDialog(true)}
                disabled={isPending || !draftId}
                className={SECONDARY_BTN}
              >
                <FileText className="mr-2 h-4 w-4" /> Документы/Драйверы
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Warehouse Costs - Full Width */}
      {supplierId !== "no-supplier" && (
        <Card className={cn(CARD_CLASS, "mt-6")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WarehouseIcon className="h-4 w-4" />
              Склады и себестоимость
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Editable costs */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Себестоимость по складам</h3>
                <p className="text-xs text-gray-500">Склады выбранного поставщика</p>
                {isLoadingWarehouses ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />Загрузка...
                  </div>
                ) : (
                  <>
                    {allCosts.filter((c) => supplierWarehouses.some((w) => w.id === c.warehouse_id)).length > 0 && (
                      <div className="space-y-2">
                        {allCosts.filter((c) => supplierWarehouses.some((w) => w.id === c.warehouse_id)).map((cost) => {
                          const wh = supplierWarehouses.find((w) => w.id === cost.warehouse_id)
                          return (
                            <div key={cost.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                              <div>
                                <div className="font-medium text-sm">{wh?.name || `Склад #${cost.warehouse_id}`}</div>
                                <div className="text-xs text-gray-500">{wh?.city && `${wh.city} · `}{wh?.currency?.code || ""}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end gap-0.5">
                                  <Label className="text-[10px] text-gray-500 uppercase tracking-wide">Остаток</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={cost.quantity ?? 0}
                                    onChange={(e) => handleQuantityChange(cost.id, e.target.value)}
                                    className={cn("h-8 w-20 text-sm text-right font-mono", SOFT_CONTROL)}
                                  />
                                </div>
                                <div className="text-right">
                                  <div className="font-mono text-sm">{cost.cost_price.toLocaleString("ru-RU")} {wh?.currency?.code || ""}</div>
                                  {cost.calculated_price ? (
                                    <div className="text-xs text-green-600 font-semibold">→ {cost.calculated_price.toLocaleString("ru-RU")} тг</div>
                                  ) : (
                                    <div className="text-xs text-gray-400">Нет формулы</div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteWarehouseCost(cost.id)}
                                  disabled={isPending}
                                  className="rounded-full hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {supplierWarehouses.length > 0 ? (
                      <div className="flex items-end gap-2 pt-2 border-t">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Склад</Label>
                          <Select value={addingWarehouseId} onValueChange={setAddingWarehouseId}>
                            <SelectTrigger className={cn("text-sm", SOFT_CONTROL)}><SelectValue placeholder="Выберите склад" /></SelectTrigger>
                            <SelectContent>
                              {supplierWarehouses.filter((w) => !allCosts.some((c) => c.warehouse_id === w.id)).map((w) => (
                                <SelectItem key={w.id} value={String(w.id)}>{w.name} ({w.currency?.code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-[120px] space-y-1">
                          <Label className="text-xs">Себестоимость</Label>
                          <Input type="number" step="0.01" value={addingCostPrice} onChange={(e) => setAddingCostPrice(e.target.value)} placeholder="0" className={cn("text-sm", SOFT_CONTROL)} disabled={isPending} />
                        </div>
                        <div className="w-[90px] space-y-1">
                          <Label className="text-xs">Остаток</Label>
                          <Input type="number" min={0} step={1} value={addingQuantity} onChange={(e) => setAddingQuantity(e.target.value)} placeholder="0" className={cn("text-sm", SOFT_CONTROL)} disabled={isPending} />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleAddWarehouseCost}
                          disabled={isPending || !addingWarehouseId || !addingCostPrice || !draftId}
                          className={PRIMARY_BTN}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-2">У этого поставщика нет складов.</div>
                    )}
                  </>
                )}
              </div>

              {/* Right: All costs info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Все склады товара</h3>
                <p className="text-xs text-gray-500">Информация по всем поставщикам</p>
                {allCosts.length > 0 ? (
                  <div className="space-y-1.5">
                    {allCosts.map((cost) => {
                      const wh = supplierWarehouses.find((w) => w.id === cost.warehouse_id)
                      return (
                        <div key={cost.id} className="flex items-center justify-between py-2 px-3 text-sm border rounded-lg bg-gray-50">
                          <div className="flex-1">
                            <span className="text-gray-500">{wh?.supplier_name || "—"}</span>
                            <span className="mx-1 text-gray-300">·</span>
                            <span className="font-medium">{wh?.name || `#${cost.warehouse_id}`}</span>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <span
                              className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                                (cost.quantity ?? 0) > 0
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                              title="Остаток на складе"
                            >
                              {cost.quantity ?? 0}
                            </span>
                            <span className="font-mono text-xs text-gray-500">{cost.cost_price.toLocaleString("ru-RU")} {wh?.currency?.code || ""}</span>
                            {cost.calculated_price ? (
                              <span className="font-mono text-xs font-semibold text-green-600">→ {cost.calculated_price.toLocaleString("ru-RU")} тг</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-4">Нет данных о складах</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {importAccess && (
        <ProductImportFromUrlDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImported={handleImported}
        />
      )}

      <ParentCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        categories={categories}
        selectedCategoryId={categoryId === "0" ? null : Number(categoryId)}
        onSelect={handleSelectCategory}
        title="Выберите категорию товара"
      />

      <BrandSelectDialog
        open={showBrandDialog}
        onOpenChange={setShowBrandDialog}
        brands={brands}
        selectedBrandId={brandId === "no-brand" ? null : Number(brandId)}
        onSelect={(id) => handleBrandChange(id === null ? "no-brand" : String(id))}
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
      <CharacteristicsListDialog open={showCharacteristicsListDialog} onOpenChange={setShowCharacteristicsListDialog} />
    </div>
  )
}
