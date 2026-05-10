"use client"

/**
 * Админка → Управление страницами → таб «Страница поиска».
 *
 * Курирует контент стартового экрана `/search` (когда юзер ещё ничего
 * не ввёл): два таба «Категории» и «Бренды» с упорядоченными карточками.
 *
 * Что управляется:
 *  - Тогл «показывать таб Категории» / «показывать таб Бренды».
 *    Если оба выключены — на /search панель не показывается, юзер
 *    видит просто пустой стейт со строкой поиска.
 *  - Список курируемых категорий (упорядоченный, добавление/удаление,
 *    реордер через drag-and-drop @dnd-kit).
 *  - Список курируемых брендов — то же самое.
 *
 * Каждое сохранение через server action триггерит revalidateTag('search-page'),
 * на публичной стороне страница обновляется мгновенно.
 */

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Loader2, Plus, X, Tag, Building2, GripVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import AdminLoading from "@/components/admin-loading"
import { useToast } from "@/hooks/use-toast"
import { getCategories, type Category } from "@/app/actions/categories"
import { getBrands, type Brand } from "@/app/actions/meta"
import { getImageUrl } from "@/lib/image-utils"
import { CategorySelectionDialog } from "@/components/category-selection-dialog"
import { BrandMultiSelectDialog } from "@/components/brand-multi-select-dialog"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  getSearchPageSettingsAdmin,
  updateSearchPageSettingsAdmin,
  getSearchPageCategoriesAdmin,
  updateSearchPageCategoriesAdmin,
  getSearchPageBrandsAdmin,
  updateSearchPageBrandsAdmin,
} from "@/app/actions/search-page"
import type { SearchPageSettings } from "@/lib/search-page-types"

// Плоский список категорий (рекурсивно разворачиваем дерево). Нужно
// чтобы можно было добавить любую категорию любого уровня вложенности
// в курируемую панель поиска.
function flattenCategories(cats: Category[], depth = 0): Array<Category & { depth: number }> {
  const out: Array<Category & { depth: number }> = []
  for (const c of cats) {
    out.push({ ...c, depth })
    if (c.children && c.children.length) {
      out.push(...flattenCategories(c.children, depth + 1))
    }
  }
  return out
}

export default function SearchPageTab() {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SearchPageSettings>({
    categories_enabled: true,
    brands_enabled: true,
  })

  const [allCategories, setAllCategories] = useState<Array<Category & { depth: number }>>([])
  const [allBrands, setAllBrands] = useState<Brand[]>([])

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([])

  const [savingCategories, setSavingCategories] = useState(false)
  const [savingBrands, setSavingBrands] = useState(false)
  const [savingSettings, setSavingSettings] = useState<"categories" | "brands" | null>(null)

  const [pickerOpen, setPickerOpen] = useState<"categories" | "brands" | null>(null)

  // Initial load
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [s, catTree, brands, catIds, brandIds] = await Promise.all([
          getSearchPageSettingsAdmin(),
          getCategories(),
          getBrands(),
          getSearchPageCategoriesAdmin(),
          getSearchPageBrandsAdmin(),
        ])
        if (cancelled) return
        setSettings(s)
        setAllCategories(flattenCategories(catTree))
        setAllBrands(brands)
        setSelectedCategoryIds(catIds)
        setSelectedBrandIds(brandIds)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Settings toggles ──────────────────────────────────────────────────

  const handleSettingToggle = async (key: keyof SearchPageSettings, value: boolean) => {
    const prev = settings[key]
    setSettings((s) => ({ ...s, [key]: value }))
    setSavingSettings(key === "categories_enabled" ? "categories" : "brands")
    const res = await updateSearchPageSettingsAdmin({ [key]: value })
    setSavingSettings(null)
    if (!res.success) {
      setSettings((s) => ({ ...s, [key]: prev }))
      toast({ title: "Ошибка", description: res.error || "Не удалось сохранить", variant: "destructive" })
    }
  }

  // ── Categories list management ────────────────────────────────────────

  const persistCategories = async (next: number[]) => {
    setSavingCategories(true)
    const res = await updateSearchPageCategoriesAdmin(next)
    setSavingCategories(false)
    if (!res.success) {
      toast({ title: "Ошибка", description: res.error || "Не удалось сохранить", variant: "destructive" })
      return false
    }
    return true
  }

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSelectedCategoryIds((prev) => {
      const oldIndex = prev.indexOf(Number(active.id))
      const newIndex = prev.indexOf(Number(over.id))
      if (oldIndex < 0 || newIndex < 0) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      persistCategories(next)
      return next
    })
  }

  const removeCategory = (id: number) => {
    setSelectedCategoryIds((prev) => {
      const next = prev.filter((x) => x !== id)
      persistCategories(next)
      return next
    })
  }

  // ── Brands list management ────────────────────────────────────────────

  const persistBrands = async (next: number[]) => {
    setSavingBrands(true)
    const res = await updateSearchPageBrandsAdmin(next)
    setSavingBrands(false)
    if (!res.success) {
      toast({ title: "Ошибка", description: res.error || "Не удалось сохранить", variant: "destructive" })
      return false
    }
    return true
  }

  const handleBrandDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSelectedBrandIds((prev) => {
      const oldIndex = prev.indexOf(Number(active.id))
      const newIndex = prev.indexOf(Number(over.id))
      if (oldIndex < 0 || newIndex < 0) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      persistBrands(next)
      return next
    })
  }

  const removeBrand = (id: number) => {
    setSelectedBrandIds((prev) => {
      const next = prev.filter((x) => x !== id)
      persistBrands(next)
      return next
    })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // ── Derived ──────────────────────────────────────────────────────────

  const categoriesById = useMemo(() => {
    const m = new Map<number, Category & { depth: number }>()
    for (const c of allCategories) m.set(c.id, c)
    return m
  }, [allCategories])

  const brandsById = useMemo(() => {
    const m = new Map<number, Brand>()
    for (const b of allBrands) m.set(b.id, b)
    return m
  }, [allBrands])

  const selectedCategories = useMemo(
    () => selectedCategoryIds.map((id) => categoriesById.get(id)).filter(Boolean) as Array<Category & { depth: number }>,
    [selectedCategoryIds, categoriesById],
  )
  const selectedBrands = useMemo(
    () => selectedBrandIds.map((id) => brandsById.get(id)).filter(Boolean) as Brand[],
    [selectedBrandIds, brandsById],
  )

  if (loading) return <AdminLoading />

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Страница поиска</h3>
        <p className="text-sm text-gray-500 mt-1">
          Настройка стартового экрана страницы /search — какие категории и бренды показываются юзеру до ввода поискового запроса.
        </p>
      </div>

      {/* Тогл-секции */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <Label htmlFor="toggle-categories" className="text-base font-medium cursor-pointer">
                Показывать таб «Категории»
              </Label>
              <p className="text-xs text-gray-500">Курируемые категории под строкой поиска</p>
            </div>
            <div className="flex items-center gap-3">
              {savingSettings === "categories" && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              <Switch
                id="toggle-categories"
                checked={settings.categories_enabled}
                onCheckedChange={(v) => handleSettingToggle("categories_enabled", v)}
                disabled={savingSettings === "categories"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <Label htmlFor="toggle-brands" className="text-base font-medium cursor-pointer">
                Показывать таб «Бренды»
              </Label>
              <p className="text-xs text-gray-500">Курируемые бренды под строкой поиска</p>
            </div>
            <div className="flex items-center gap-3">
              {savingSettings === "brands" && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              <Switch
                id="toggle-brands"
                checked={settings.brands_enabled}
                onCheckedChange={(v) => handleSettingToggle("brands_enabled", v)}
                disabled={savingSettings === "brands"}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Под-табы Категории / Бренды */}
      <Tabs defaultValue="categories">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-1.5" />
            Категории ({selectedCategories.length})
          </TabsTrigger>
          <TabsTrigger value="brands">
            <Building2 className="h-4 w-4 mr-1.5" />
            Бренды ({selectedBrands.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              Выбранные категории отображаются на /search в этом порядке.
            </div>
            <Button
              size="sm"
              onClick={() => setPickerOpen("categories")}
              className="bg-brand-yellow hover:bg-yellow-500 text-black"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </div>

          {selectedCategories.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Tag className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p>Пока ни одной категории. Нажмите «Добавить».</p>
              </CardContent>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={selectedCategories.map((c) => c.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {selectedCategories.map((cat, idx) => (
                    <SortableSquareCard
                      key={cat.id}
                      id={cat.id}
                      name={cat.name}
                      imageUrl={cat.image_url}
                      order={idx + 1}
                      fallbackIcon={<Tag className="h-8 w-8 text-gray-300" />}
                      onRemove={() => removeCategory(cat.id)}
                      removeDisabled={savingCategories}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="brands" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              Выбранные бренды отображаются на /search в этом порядке.
            </div>
            <Button
              size="sm"
              onClick={() => setPickerOpen("brands")}
              className="bg-brand-yellow hover:bg-yellow-500 text-black"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </div>

          {selectedBrands.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p>Пока ни одного бренда. Нажмите «Добавить».</p>
              </CardContent>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBrandDragEnd}>
              <SortableContext items={selectedBrands.map((b) => b.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {selectedBrands.map((brand, idx) => (
                    <SortableSquareCard
                      key={brand.id}
                      id={brand.id}
                      name={brand.name}
                      imageUrl={brand.image_url}
                      order={idx + 1}
                      fallbackIcon={<Building2 className="h-8 w-8 text-gray-300" />}
                      onRemove={() => removeBrand(brand.id)}
                      removeDisabled={savingBrands}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>
      </Tabs>

      {/* Категории — используем такую же модалку как в фильтрах админки
          товаров (CategorySelectionDialog с tree-expand и multi-select). */}
      <CategorySelectionDialog
        open={pickerOpen === "categories"}
        onOpenChange={(o) => !o && setPickerOpen(null)}
        selectedCategories={selectedCategoryIds}
        onCategoriesChange={(ids) => {
          // Сохраняем порядок: ранее бывшие в их прежнем порядке, новые — в конец.
          const ordered: number[] = []
          for (const id of selectedCategoryIds) if (ids.includes(id)) ordered.push(id)
          for (const id of ids) if (!ordered.includes(id)) ordered.push(id)
          setSelectedCategoryIds(ordered)
          persistCategories(ordered)
        }}
        multiple
      />

      {/* Бренды — multi-select клон BrandSelectDialog (фильтр админки
          товаров single-select, у нас выбираем несколько). */}
      <BrandMultiSelectDialog
        open={pickerOpen === "brands"}
        onOpenChange={(o) => !o && setPickerOpen(null)}
        brands={allBrands}
        selectedBrandIds={selectedBrandIds}
        onConfirm={(ids) => {
          setSelectedBrandIds(ids)
          persistBrands(ids)
          setPickerOpen(null)
        }}
      />
    </div>
  )
}

// ── Sortable square card ────────────────────────────────────────────────
// Один-в-один как в HomepageBlockItemsReorderDialogV2 — bagde с порядком
// в верхнем левом углу, grip-индикатор drag в правом верхнем (виден на
// hover), картинка по центру, название внизу. Никаких CSS-transform на
// контейнере — их использует @dnd-kit.

interface SortableSquareCardProps {
  id: number
  name: string
  imageUrl: string | null | undefined
  order: number
  fallbackIcon: React.ReactNode
  onRemove: () => void
  removeDisabled?: boolean
}

function SortableSquareCard({ id, name, imageUrl, order, fallbackIcon, onRemove, removeDisabled }: SortableSquareCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative aspect-square flex flex-col rounded-xl border bg-white overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none ${
        isDragging
          ? "opacity-60 shadow-[0_12px_28px_rgba(0,0,0,0.18)] border-brand-yellow ring-2 ring-brand-yellow/40 z-50"
          : "border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)] hover:border-gray-300"
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Бейдж с номером позиции */}
      <div className="absolute top-2 left-2 z-10 inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-brand-yellow text-black text-xs font-semibold shadow-[0_2px_6px_rgba(250,204,21,0.30)] pointer-events-none">
        #{order}
      </div>
      {/* Кнопка удаления — поверх grip, с pointerDown stop чтобы не запускать drag */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        disabled={removeDisabled}
        className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-red-500 hover:text-red-700 hover:bg-white opacity-0 group-hover:opacity-100 shadow-[0_2px_6px_rgba(0,0,0,0.10)] transition-opacity"
        title="Убрать"
      >
        <X className="h-4 w-4" />
      </button>
      {/* Drag-индикатор — стационарный, виден на hover, под кнопкой удаления */}
      <div className="absolute top-9 right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-gray-400 opacity-0 group-hover:opacity-60 pointer-events-none shadow-[0_2px_6px_rgba(0,0,0,0.10)]">
        <GripVertical className="h-4 w-4" />
      </div>
      {/* Картинка */}
      <div className="flex-1 min-h-0 w-full bg-gray-50 flex items-center justify-center p-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(imageUrl)}
            alt={name}
            draggable={false}
            className="max-w-full max-h-full object-contain pointer-events-none"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            {fallbackIcon}
          </div>
        )}
      </div>
      {/* Название */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-gray-100 bg-white">
        <div className="font-medium text-xs leading-tight text-center text-gray-900 line-clamp-2 min-h-[2rem] flex items-center justify-center">
          {name}
        </div>
      </div>
    </div>
  )
}
