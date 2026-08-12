"use client"

/**
 * Компактный пикер товаров — маленькие плотные карточки (не крупные как
 * в `ElementsSelectionDialog`, которая используется в homepage-blocks).
 * Одна строка = одна карточка с preview + название + артикул + цена
 * (без крупных полей и лишнего пространства). 5-6 в ряд на десктопе,
 * пагинация через «Показать ещё».
 *
 * Layout: sticky-сайдбар слева с фильтрами (категория / бренд), справа —
 * шапка с поиском и счётчиками + сетка карточек.
 *
 * Используется в `HeaderMenuItemDialog` для выбора товаров custom-раздела.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Search, Check, Package, X as XIcon, ChevronsUpDown } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getImageUrl } from "@/lib/image-utils"
import { getProducts, type Product, type PaginatedProducts } from "@/app/actions/products"
import { getBrands, type Brand } from "@/app/actions/brands"
import { getCategories, type Category } from "@/app/actions/categories"
import { getSuppliers, type Supplier } from "@/app/actions/suppliers"
import { ParentCategoryDialog } from "@/components/parent-category-dialog"
import { BrandSelectDialog } from "@/components/brand-select-dialog"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

const PAGE_SIZE = 40

// Ищет имя категории по id в дереве (для отображения на кнопке-фильтре).
function findCategoryName(nodes: Category[], id: number): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.name
    if (n.children && n.children.length) {
      const r = findCategoryName(n.children, id)
      if (r) return r
    }
  }
  return null
}

export default function CompactProductPicker({ open, onOpenChange, selectedIds, onChange }: Props) {
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [brandId, setBrandId] = useState<number | null>(null)
  const [supplierId, setSupplierId] = useState<string>("all")

  const [brands, setBrands] = useState<Brand[]>([])
  const [catTree, setCatTree] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Диалоги фильтров
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [brandDialogOpen, setBrandDialogOpen] = useState(false)

  const [localSelected, setLocalSelected] = useState<Set<number>>(new Set(selectedIds))

  // Синхронизация выбранных при открытии
  useEffect(() => {
    if (open) setLocalSelected(new Set(selectedIds))
  }, [open, selectedIds])

  // Debounce поиска
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Загрузка фильтр-справочников — только один раз при первом открытии
  useEffect(() => {
    if (!open) return
    if (brands.length === 0) getBrands().then(setBrands).catch(() => {})
    if (catTree.length === 0) getCategories().then(setCatTree).catch(() => {})
    if (suppliers.length === 0) getSuppliers().then(setSuppliers).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const categoryFilterLabel = useMemo(() => {
    if (categoryId === null) return "Все категории"
    return findCategoryName(catTree, categoryId) ?? "Выберите категорию"
  }, [categoryId, catTree])
  const brandFilterLabel = useMemo(() => {
    if (brandId === null) return "Все бренды"
    return brands.find((b) => b.id === brandId)?.name ?? "Выберите бренд"
  }, [brandId, brands])

  // Загрузка страницы товаров при изменении фильтров / открытии
  useEffect(() => {
    if (!open) return
    setPage(1)
    setLoading(true)
    const brandName = brandId !== null ? brands.find((b) => b.id === brandId)?.name : undefined
    getProducts({
      page: 1,
      perPage: PAGE_SIZE,
      search: searchDebounced || undefined,
      categoryId: categoryId ?? undefined,
      brand: brandName,
      supplier: supplierId !== "all" ? supplierId : undefined,
    })
      .then((res: PaginatedProducts) => {
        setItems(res.products || [])
        setTotal(res.total_count || 0)
      })
      .finally(() => setLoading(false))
  }, [open, searchDebounced, categoryId, brandId, supplierId, brands])

  const loadMore = async () => {
    setLoading(true)
    try {
      const next = page + 1
      const brandName = brandId !== null ? brands.find((b) => b.id === brandId)?.name : undefined
      const res = await getProducts({
        page: next,
        perPage: PAGE_SIZE,
        search: searchDebounced || undefined,
        categoryId: categoryId ?? undefined,
        brand: brandName,
        supplier: supplierId !== "all" ? supplierId : undefined,
      })
      setItems((prev) => [...prev, ...(res.products || [])])
      setPage(next)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id: number) => {
    setLocalSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const apply = () => {
    onChange(Array.from(localSelected))
    onOpenChange(false)
  }

  const resetFilters = () => {
    setSearch("")
    setCategoryId(null)
    setBrandId(null)
    setSupplierId("all")
  }

  const hasMore = items.length < total
  const filtersActive = search.trim() !== "" || categoryId !== null || brandId !== null || supplierId !== "all"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-base">Выбор товаров</DialogTitle>
            <span className="text-xs text-gray-500">
              Найдено: <span className="font-medium text-gray-900">{total}</span>
              {localSelected.size > 0 && (
                <> · выбрано: <span className="font-medium text-brand-yellow">{localSelected.size}</span></>
              )}
            </span>
            {/* Строка поиска — растягивается на всё свободное место */}
            <div className="relative flex-1 min-w-[240px] max-w-2xl">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск: название или артикул"
                className="pl-8 pr-8 h-8 text-sm w-full focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
                  aria-label="Очистить поиск"
                >
                  <XIcon className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Grid: sticky-сайдбар с фильтрами + правая колонка с сеткой */}
        <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr] overflow-hidden">
          {/* ── Сайдбар фильтров: reuse готовых диалогов ParentCategoryDialog
              и BrandSelectDialog (тех же что в ElementsSelectionDialog) —
              там дерево категорий с раскрытием и селектор брендов. */}
          <aside className="border-r border-gray-100 p-3 space-y-3 overflow-y-auto bg-gray-50/60">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-gray-500">Категория</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between h-8 font-normal text-sm"
                onClick={() => setCatDialogOpen(true)}
              >
                <span className="truncate text-left">{categoryFilterLabel}</span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50 shrink-0" />
              </Button>
              {categoryId !== null && (
                <button
                  type="button"
                  onClick={() => setCategoryId(null)}
                  className="text-[11px] text-gray-500 hover:text-black px-1"
                >Сбросить</button>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-gray-500">Бренд</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between h-8 font-normal text-sm"
                onClick={() => setBrandDialogOpen(true)}
              >
                <span className="truncate text-left">{brandFilterLabel}</span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50 shrink-0" />
              </Button>
              {brandId !== null && (
                <button
                  type="button"
                  onClick={() => setBrandId(null)}
                  className="text-[11px] text-gray-500 hover:text-black px-1"
                >Сбросить</button>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-gray-500">Поставщик</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-8 text-sm focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none data-[state=open]:ring-0">
                  <SelectValue placeholder="Все поставщики" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">Все поставщики</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtersActive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="w-full h-8 text-xs"
              >
                Сбросить фильтры
              </Button>
            )}
          </aside>

          {/* ── Сетка карточек ──────────────────────────────────────── */}
          <div className="overflow-y-auto p-3">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка…
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">Ничего не найдено</div>
            ) : (
              // Плотная сетка: на full-screen (100vw) 8-10 колонок вместо 6,
              // карточки существенно мельче.
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-10 gap-2">
                {items.map((p) => {
                  const isSel = localSelected.has(p.id)
                  const img = p.image ? getImageUrl(p.image) : (p.media?.[0]?.url ? getImageUrl(p.media[0].url) : null)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "group text-left rounded-xl bg-white transition-all overflow-hidden flex flex-col",
                        "border shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
                        isSel
                          ? "border-brand-yellow ring-2 ring-brand-yellow"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                        {img ? (
                          <Image
                            src={img}
                            alt={p.name}
                            fill
                            className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-200"
                            sizes="140px"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-gray-300" />
                        )}
                        {isSel && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brand-yellow flex items-center justify-center shadow ring-1 ring-white">
                            <Check className="h-2.5 w-2.5 text-black stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        <div className="text-[10px] font-medium text-gray-900 line-clamp-2 leading-tight min-h-[26px]">
                          {p.name}
                        </div>
                        <div className="text-[9px] text-gray-400 truncate font-mono">
                          {p.article || "—"}
                        </div>
                        <div className="text-[10px] font-semibold text-gray-900">
                          {p.price != null ? `${Math.round(p.price).toLocaleString("ru-RU")} ₸` : "—"}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loading}
                  className="h-8 text-xs"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Показать ещё ({total - items.length})
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-gray-100 shrink-0 bg-white flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-auto">Выбрано товаров: {localSelected.size}</span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button size="sm" onClick={apply} className="bg-brand-yellow hover:bg-yellow-500 text-black">
            Готово
          </Button>
        </DialogFooter>

        {/* Готовые диалоги фильтров — reuse из elements-selection-dialog */}
        <ParentCategoryDialog
          open={catDialogOpen}
          onOpenChange={setCatDialogOpen}
          categories={catTree}
          selectedCategoryId={categoryId}
          onSelect={(id) => setCategoryId(id)}
          title="Выберите категорию"
        />
        <BrandSelectDialog
          open={brandDialogOpen}
          onOpenChange={setBrandDialogOpen}
          brands={brands as any}
          selectedBrandId={brandId}
          onSelect={(id) => setBrandId(id)}
          title="Выберите бренд"
        />
      </DialogContent>
    </Dialog>
  )
}
