"use client"

import type React from "react"
import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { type Product, updateProduct } from "@/app/actions/products"
import type { Category } from "@/app/actions/categories"
import type { Brand, Status } from "@/app/actions/meta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, List, ImageIcon, FileText, ChevronsUpDown, ArrowLeft, BookOpen } from "lucide-react"
import { ParentCategoryDialog } from "./parent-category-dialog"
import { ProductCharacteristicsDialog } from "./product-characteristics-dialog"
import { ProductMediaDialog } from "./product-media-dialog"
import { ProductDocumentsDriversDialog } from "./product-documents-drivers-dialog"
import { CharacteristicsListDialog } from "./characteristics-list-dialog"

interface ProductEditPageProps {
  product: Product
  categories: Category[]
  brands: Brand[]
  statuses: Status[]
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

export function ProductEditPage({ product, categories, brands, statuses }: ProductEditPageProps) {
  console.log("ProductEditPage rendered with product:", product)
  console.log("Product ID:", product.id)
  
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(product.name)
  const [article, setArticle] = useState(product.article)
  const [price, setPrice] = useState(product.price)
  const [wholesalePrice, setWholesalePrice] = useState(product.wholesale_price)
  const [quantity, setQuantity] = useState(product.quantity)

  // Правильная обработка статуса
  const getInitialStatusId = () => {
    if (typeof product.status === "string") {
      return product.status === "no" ? "no-status" : product.status
    }
    return product.status?.id ? String(product.status.id) : "no-status"
  }
  const [statusId, setStatusId] = useState(getInitialStatusId())

  const [isVisible, setIsVisible] = useState(product.is_visible)
  const [country, setCountry] = useState(product.country)
  // Если бренд null/undefined или "no", устанавливаем "no-brand"
  const [brandName, setBrandName] = useState(product.brand === "no" || !product.brand ? "no-brand" : product.brand)
  const [description, setDescription] = useState(product.description ?? "")
  const [categoryId, setCategoryId] = useState(String(product.category_id ?? "0"))
  const [categoryName, setCategoryName] = useState("")

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(true)

  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showCharacteristicsDialog, setShowCharacteristicsDialog] = useState(false)
  const [showMediaDialog, setShowMediaDialog] = useState(false)
  const [showDocumentsDriversDialog, setShowDocumentsDriversDialog] = useState(false)
  const [showCharacteristicsListDialog, setShowCharacteristicsListDialog] = useState(false)

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

      const result = await updateProduct(product.id, payload)

      if (result.error) {
        toast({ variant: "destructive", title: "Ошибка сохранения", description: result.error })
      } else {
        toast({
          title: "Успех!",
          description: result.message || "Товар успешно обновлен.",
        })

        // Возвращаемся на страницу товаров с обновленными данными
        const updatedProduct = result.product || {
          ...product,
          ...payload,
          status: statusId === "no-status" ? "no" : statusId,
          brand: brandName === "no-brand" ? "no" : brandName,
        }

        // Передаем обновленные данные через URL параметры или sessionStorage
        sessionStorage.setItem("updatedProduct", JSON.stringify(updatedProduct))
        router.push("/admin/catalog/products")
      }
    })
  }

  const handleCancel = () => {
    router.push("/admin/catalog/products")
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Редактировать товар</h1>
          <p className="text-gray-600">{name || "Новый товар"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Название *</Label>
                  <Input id="name" value={name} onChange={handleNameChange} required disabled={isPending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL (slug)</Label>
                  <Input
                    id="slug"
                    value={product.slug}
                    disabled={true}
                    placeholder="Генерируется сервером"
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="article">Артикул</Label>
                  <Input
                    id="article"
                    value={article}
                    onChange={(e) => setArticle(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Цены и количество</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статус и бренд</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Категория</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-between bg-transparent"
                onClick={() => setShowCategoryDialog(true)}
                disabled={isPending}
              >
                <span>{categoryName}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Характеристики</CardTitle>
                <CardDescription>Управление списком характеристик для товара и их очередностью</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setShowCharacteristicsDialog(true)} disabled={isPending}>
                <List className="mr-2 h-4 w-4" /> Характеристики
              </Button>
              <Button variant="outline" onClick={() => setShowCharacteristicsListDialog(true)} disabled={isPending}>
                <BookOpen className="mr-2 h-4 w-4" /> Справочник
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Медиафайлы</CardTitle>
                <CardDescription>Добавление изображений и видео для товара с настройкой очередности</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="outline" onClick={() => setShowMediaDialog(true)} disabled={isPending}>
                <ImageIcon className="mr-2 h-4 w-4" /> Медиа
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Документы и драйверы</CardTitle>
                <CardDescription>Добавление документации и драйверов для товара</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="outline" onClick={() => setShowDocumentsDriversDialog(true)} disabled={isPending}>
                <FileText className="mr-2 h-4 w-4" /> Документы/Драйверы
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Видимость</CardTitle>
                <CardDescription>Укажите будет ли виден товар для клиентов на страницах магазина</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="is_visible">{isVisible ? "Виден" : "Скрыт"}</Label>
                <Switch id="is_visible" checked={isVisible} onCheckedChange={setIsVisible} disabled={isPending} />
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Description Card - Full Width */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Описание</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              disabled={isPending}
              placeholder="Описание товара..."
            />
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
        <Button type="button" variant="ghost" onClick={handleCancel} disabled={isPending}>
          Отмена
        </Button>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить изменения
        </Button>
      </div>

      <ParentCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        categories={categories}
        selectedCategoryId={categoryId === "0" ? null : Number(categoryId)}
        onSelect={handleSelectCategory}
        title="Выберите категорию товара"
      />

      {showCharacteristicsDialog && (
        <ProductCharacteristicsDialog productId={product.id} onClose={() => setShowCharacteristicsDialog(false)} />
      )}
      {showMediaDialog && (
        <ProductMediaDialog 
          productId={product.id} 
          onClose={() => setShowMediaDialog(false)} 
        />
      )}
      {showDocumentsDriversDialog && (
        <ProductDocumentsDriversDialog productId={product.id} onClose={() => setShowDocumentsDriversDialog(false)} />
      )}
      
      <CharacteristicsListDialog
        open={showCharacteristicsListDialog}
        onOpenChange={setShowCharacteristicsListDialog}
      />
    </div>
  )
}
