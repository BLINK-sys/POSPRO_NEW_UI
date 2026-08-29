"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProductCard } from "@/components/product-card"
import type { ProductData } from "@/app/actions/public"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PAGE_SIZE = 50

interface Facet { id: number; name: string; count: number }
interface FacetsResponse {
  categories: Facet[]
  brands: Facet[]
  price_min: number
  price_max: number
}

/**
 * Модалка «Добавить товар в КП» — на всю страницу.
 * Строка поиска по центру сверху; слева — панель фильтров (две равные
 * секции: Категории и Бренды, каждая со своим скроллом), появляется
 * только когда есть результаты (юзер что-то ввёл). Справа — сетка
 * товаров + пагинация. Модалка не закрывается после добавления —
 * менеджер добавляет пачкой.
 */
export function KpAddProductDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [brandId, setBrandId] = useState<number | null>(null)

  const [products, setProducts] = useState<ProductData[]>([])
  const [facets, setFacets] = useState<FacetsResponse | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const hasAnyFilter = !!debouncedQuery || categoryId != null || brandId != null
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 0

  const doSearch = useCallback(async (page: number, keepFacets: boolean) => {
    abortRef.current?.abort()
    if (!hasAnyFilter) {
      setProducts([])
      setFacets(null)
      setTotalCount(0)
      setCurrentPage(1)
      setLoading(false)
      setError(null)
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedQuery) params.set("q", debouncedQuery)
      if (categoryId != null) params.set("category_id", String(categoryId))
      if (brandId != null) params.set("brand_id", String(brandId))
      params.set("page", String(page))
      params.set("per_page", String(PAGE_SIZE))
      if (!keepFacets) params.set("with_facets", "1")

      const resp = await fetch(`/api/public/products/search?${params.toString()}`, {
        method: "GET",
        signal: ac.signal,
        cache: "no-store",
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const raw = await resp.json()
      const items: any[] = Array.isArray(raw) ? raw : (raw.items || [])
      const total: number = Array.isArray(raw) ? items.length : (raw.total_count ?? items.length)
      const respFacets: FacetsResponse | null = (!Array.isArray(raw) && raw.facets) ? raw.facets : null

      const data: ProductData[] = items.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        wholesale_price: p.wholesale_price,
        quantity: p.quantity,
        status: p.status && typeof p.status === "object" ? p.status : undefined,
        brand_id: p.brand_id ? Number(p.brand_id) : null,
        brand_info: p.brand_info,
        supplier_id: p.supplier_id ?? null,
        supplier_name: p.supplier_name || p.supplier?.name || null,
        description: p.description,
        category_id: p.category_id ? Number(p.category_id) : undefined,
        category: p.category,
        image_url: p.image_url || p.image,
        availability_status: p.availability_status ?? undefined,
      }))

      if (ac.signal.aborted) return
      setProducts(data)
      setTotalCount(total)
      setCurrentPage(page)
      if (respFacets) setFacets(respFacets)
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Ошибка поиска")
      }
    } finally {
      if (abortRef.current === ac) setLoading(false)
    }
  }, [debouncedQuery, categoryId, brandId, hasAnyFilter])

  useEffect(() => {
    if (!open) return
    doSearch(1, /* keepFacets */ false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedQuery, categoryId, brandId])

  const goToPage = useCallback((page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages) || page === currentPage) return
    doSearch(page, /* keepFacets */ true)
  }, [doSearch, currentPage, totalPages])

  const resetFilters = useCallback(() => {
    setQuery("")
    setDebouncedQuery("")
    setCategoryId(null)
    setBrandId(null)
  }, [])

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setQuery("")
      setDebouncedQuery("")
      setCategoryId(null)
      setBrandId(null)
      setProducts([])
      setFacets(null)
      setTotalCount(0)
      setCurrentPage(1)
      setError(null)
    }
  }, [open])

  const pageList = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 1) return [1]
    const pages = new Set<number>([1, totalPages])
    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
      if (i >= 1 && i <= totalPages) pages.add(i)
    }
    const sorted = [...pages].sort((a, b) => a - b)
    const out: (number | "...")[] = []
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("...")
      out.push(sorted[i])
    }
    return out
  }, [totalPages, currentPage])

  // Панель фильтров показываем только когда есть результаты — до этого
  // менеджер видит пустой центр с приглашением к поиску, без «шума».
  const showFilters = facets != null && (facets.categories.length > 0 || facets.brands.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Full-screen: без max-*, без rounded, без padding shadcn.
          "w-screen h-screen max-w-none max-h-none rounded-none p-0 gap-0 flex flex-col",
          "[&>button.absolute]:hidden",
        )}
      >
        <DialogTitle className="sr-only">Добавить товар в КП</DialogTitle>

        {/* Header: слева — инфо о результатах, по центру — строка поиска,
            справа — крестик закрытия. Инфо и крестик позиционируем absolute
            чтобы центр input'а не смещался при появлении/исчезновении текста. */}
        <div className="relative px-5 py-1.5 border-b border-gray-100 shrink-0 flex items-center justify-center gap-4">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 text-xs text-muted-foreground max-w-[35%] pointer-events-auto">
            <span className="truncate">
              {loading
                ? "Ищем…"
                : hasAnyFilter
                  ? `Найдено: ${totalCount}${totalPages > 1 ? ` · стр. ${currentPage} из ${totalPages}` : ""}`
                  : "Начните с ввода запроса"}
            </span>
            {(categoryId != null || brandId != null) && (
              <button
                type="button"
                onClick={() => { setCategoryId(null); setBrandId(null) }}
                className="text-gray-500 hover:text-black hover:underline shrink-0"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
          <div className="relative w-full max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название, артикул…"
              className="pl-9 pr-9 h-10 text-base focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-yellow"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={resetFilters}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                aria-label="Очистить"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
            title="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: filters (если есть) + results */}
        <div className="flex-1 min-h-0 flex">
          {showFilters && (
            <aside className="w-[344px] shrink-0 flex flex-col min-h-0 gap-3 p-3 bg-gray-50 border-r border-gray-100">
              {/* Категории — верхняя карточка */}
              <FilterList
                title="Категории"
                items={facets!.categories}
                selectedId={categoryId}
                onSelect={setCategoryId}
              />
              {/* Бренды — нижняя карточка, равная по высоте */}
              <FilterList
                title="Бренды"
                items={facets!.brands}
                selectedId={brandId}
                onSelect={setBrandId}
              />
            </aside>
          )}

          <main className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {loading && products.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Ищем товары…
                </div>
              ) : error ? (
                <div className="text-center py-16 text-sm text-red-600">{error}</div>
              ) : !hasAnyFilter ? (
                <div className="text-center py-16 text-sm text-muted-foreground">
                  Введите название товара или артикул
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground">Ничего не найдено</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} showKP />
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex justify-center items-center gap-1 flex-wrap bg-white">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Назад
                </Button>
                {pageList.map((p, i) =>
                  p === "..." ? (
                    <span key={`el-${i}`} className="px-2 text-muted-foreground select-none">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === currentPage ? "default" : "outline"}
                      size="sm"
                      disabled={loading}
                      onClick={() => goToPage(p)}
                      className={cn(
                        "min-w-9 px-3",
                        p === currentPage && "bg-brand-yellow text-black hover:bg-yellow-500",
                      )}
                    >
                      {p}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Вперёд <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Одна секция фильтра (Категории или Бренды). Занимает половину высоты
 * левой панели (`flex-1 basis-0`) с внутренним скроллом. Клик по строке —
 * single-select; повторный клик по активной — сброс.
 */
function FilterList({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  items: Facet[]
  selectedId: number | null
  onSelect: (id: number | null) => void
}) {
  const [q, setQ] = useState("")
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter((it) => it.name.toLowerCase().includes(needle))
  }, [items, q])
  return (
    <div className="flex-1 basis-0 min-h-0 flex flex-col rounded-xl border border-gray-200 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-600 uppercase tracking-wide flex items-center justify-between shrink-0">
        <span>{title}</span>
        {selectedId != null && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[10px] text-gray-500 hover:text-black hover:underline"
          >
            сбросить
          </button>
        )}
      </div>
      {/* Локальный поиск по текущему списку — фильтрует на клиенте по name. */}
      <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск…"
            className="w-full pl-6 pr-6 h-7 text-[11px] rounded-md border border-gray-200 bg-white focus:outline-none focus:border-brand-yellow"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700"
              aria-label="Очистить"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400 text-center">
            {items.length === 0 ? "Пусто" : "Ничего не найдено"}
          </div>
        ) : (
          filtered.map((it) => {
            const isSel = selectedId === it.id
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelect(isSel ? null : it.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors",
                  isSel ? "bg-brand-yellow text-black font-medium" : "text-gray-700 hover:bg-yellow-50",
                )}
              >
                <span className="truncate">{it.name}</span>
                <span className={cn("tabular-nums shrink-0 text-[10px]", isSel ? "text-black/70" : "text-gray-400")}>
                  {it.count}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
