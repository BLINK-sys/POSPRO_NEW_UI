"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import { Search, X, Loader2, SlidersHorizontal, RotateCcw, ChevronUp, Tag, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { isWholesaleUser } from "@/lib/utils"
import { type ProductData, searchProducts as searchProductsAction } from "@/app/actions/public"
import type { SearchPagePublicData, SearchPageCategoryItem, SearchPageBrandItem } from "@/lib/search-page-types"
import { useAuth } from "@/context/auth-context"
import { getApiUrl } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
import MobileProductCard from "./mobile-product-card"

const PAGE_SIZE = 20

export default function MobileSearchPage() {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  const [query, setQuery] = useState("")
  const [allResults, setAllResults] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  // Серверная пагинация: current page + facets.
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [facetsData, setFacetsData] = useState<{
    categories: { id: number; name: string; count: number }[]
    brands: { id: number; name: string; count: number }[]
    price_min: number
    price_max: number
  } | null>(null)
  const isLoadingMoreRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Источник поиска по клику с панели (категория/бренд)
  const [appliedCategory, setAppliedCategory] = useState<{ id: number; name: string } | null>(null)
  const [appliedBrand, setAppliedBrand] = useState<{ id: number; name: string } | null>(null)
  const [searchPageData, setSearchPageData] = useState<SearchPagePublicData | null>(null)
  const [activeTab, setActiveTab] = useState<"categories" | "brands">("categories")

  // Show scroll-to-top after ~2 screens
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > window.innerHeight * 2)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Multi-select filters
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set())
  const [selectedBrands, setSelectedBrands] = useState<Set<number>>(new Set())
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Toggle category selection
  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Toggle brand selection
  const toggleBrand = (id: number) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Все «available»-списки приходят с бэка как facets — фильтры server-side.
  const availableCategories = useMemo(() => {
    const map = new Map<number, { name: string; count?: number }>()
    if (facetsData) {
      for (const c of facetsData.categories) map.set(c.id, { name: c.name, count: c.count })
    }
    for (const id of selectedCategories) {
      if (map.has(id)) continue
      const found = allResults.find((p) => p.category_id != null && Number(p.category_id) === id)
      let name: string | undefined
      if (found?.category && typeof found.category === "object" && "name" in found.category) {
        name = (found.category as any).name
      } else if (found?.category && typeof found.category === "string") {
        name = found.category as unknown as string
      }
      if (name) map.set(id, { name })
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [facetsData, selectedCategories, allResults])

  const availableBrands = useMemo(() => {
    const map = new Map<number, { name: string; count?: number }>()
    if (facetsData) {
      for (const b of facetsData.brands) map.set(b.id, { name: b.name, count: b.count })
    }
    for (const id of selectedBrands) {
      if (map.has(id)) continue
      const found = allResults.find((p) => p.brand_id != null && Number(p.brand_id) === id)
      if (found?.brand_info) map.set(id, { name: found.brand_info.name })
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [facetsData, selectedBrands, allResults])

  // Серверная пагинация: items накапливаются в allResults при скролле.
  const filteredResults = allResults
  const visibleResults = allResults
  const hasMore = totalCount !== null && allResults.length < totalCount
  const remaining = totalCount !== null ? Math.max(0, totalCount - allResults.length) : 0

  // Autofocus
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // AbortController текущего запроса — для отмены предыдущего при новом
  // нажатии клавиши (live-search). Ref не вызывает ререндер.
  const searchAbortRef = useRef<AbortController | null>(null)

  // Server-side search: фильтры + пагинация на бэке. Идентичная логика
  // как в desktop-search-page — см. там более подробные комментарии.
  const doSearch = useCallback(async (
    args: {
      query?: string
      categoryIds?: number[]
      brandIds?: number[]
      pmin?: string | number
      pmax?: string | number
      page?: number
      append?: boolean
    } = {}
  ) => {
    const trimmedQuery = (args.query ?? "").trim()
    const categoryIds = args.categoryIds ?? []
    const brandIds = args.brandIds ?? []
    const pminStr = args.pmin !== undefined ? String(args.pmin) : ""
    const pmaxStr = args.pmax !== undefined ? String(args.pmax) : ""
    const page = args.page ?? 1
    const append = !!args.append

    const hasAnyFilter = categoryIds.length > 0 || brandIds.length > 0 || pminStr || pmaxStr
    if (!hasAnyFilter && (!trimmedQuery || trimmedQuery.length < 2)) {
      searchAbortRef.current?.abort()
      setAllResults([])
      setTotalCount(null)
      setFacetsData(null)
      setCurrentPage(1)
      setLoading(false)
      return
    }
    searchAbortRef.current?.abort()
    const ac = new AbortController()
    searchAbortRef.current = ac
    if (append) isLoadingMoreRef.current = true
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (trimmedQuery) params.set("q", trimmedQuery)
      if (categoryIds.length === 1) params.set("category_id", String(categoryIds[0]))
      else if (categoryIds.length > 1) params.set("category_ids", categoryIds.join(","))
      if (brandIds.length === 1) params.set("brand_id", String(brandIds[0]))
      else if (brandIds.length > 1) params.set("brand_ids", brandIds.join(","))
      if (pminStr) params.set("pmin", pminStr)
      if (pmaxStr) params.set("pmax", pmaxStr)
      params.set("page", String(page))
      params.set("per_page", String(PAGE_SIZE))
      if (!append) params.set("with_facets", "1")

      const resp = await fetch(`/api/public/products/search?${params.toString()}`, {
        method: "GET",
        signal: ac.signal,
        cache: "no-store",
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const raw = await resp.json()
      const items: any[] = Array.isArray(raw) ? raw : (raw.items || [])
      const total: number | null = Array.isArray(raw) ? items.length : (raw.total_count ?? items.length)
      const respFacets = (!Array.isArray(raw) && raw.facets) ? raw.facets : null

      const data: ProductData[] = items.map((product: any) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        wholesale_price: product.wholesale_price,
        quantity: product.quantity,
        status: product.status && typeof product.status === "object" ? product.status : undefined,
        brand_id: product.brand_id ? Number(product.brand_id) : null,
        brand_info: product.brand_info,
        supplier_id: product.supplier_id ?? null,
        supplier_name: product.supplier_name || product.supplier?.name || null,
        description: product.description,
        category_id: product.category_id ? Number(product.category_id) : undefined,
        category: product.category,
        image_url: product.image_url || product.image,
        availability_status: product.availability_status ?? undefined,
      }))

      if (!ac.signal.aborted) {
        if (append) {
          setAllResults(prev => [...prev, ...data])
        } else {
          setAllResults(data)
          setFacetsData(respFacets)
        }
        setTotalCount(total)
        setCurrentPage(page)
        setHasSearched(true)
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("Search error:", e)
      }
    } finally {
      if (searchAbortRef.current === ac) {
        setLoading(false)
        isLoadingMoreRef.current = false
      }
    }
  }, [])

  // Live-search debounce 300ms. Реагирует на смену query И фильтров —
  // фильтры теперь идут на бэк. Пропускаем когда активен применённый
  // category/brand с панели (там отдельный поток).
  useEffect(() => {
    if (appliedCategory || appliedBrand) return
    const trimmed = query.trim()
    const hasAnyFilter = selectedCategories.size > 0 || selectedBrands.size > 0 || priceFrom || priceTo
    if (!hasAnyFilter && (!trimmed || trimmed.length < 2)) {
      searchAbortRef.current?.abort()
      setAllResults([])
      setTotalCount(null)
      setFacetsData(null)
      setCurrentPage(1)
      setLoading(false)
      return
    }
    const t = setTimeout(() => {
      doSearch({
        query: trimmed,
        categoryIds: Array.from(selectedCategories),
        brandIds: Array.from(selectedBrands),
        pmin: priceFrom,
        pmax: priceTo,
        page: 1,
      })
    }, 300)
    return () => clearTimeout(t)
  }, [query, selectedCategories, selectedBrands, priceFrom, priceTo, appliedCategory, appliedBrand, doSearch])

  // Загрузка курируемой панели один раз — прямой fetch на API route
  useEffect(() => {
    let cancelled = false
    fetch("/api/public/search-page", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: SearchPagePublicData) => {
        if (cancelled) return
        setSearchPageData(data)
        if (activeTab === "categories" && !data.settings.categories_enabled && data.settings.brands_enabled) {
          setActiveTab("brands")
        } else if (activeTab === "brands" && !data.settings.brands_enabled && data.settings.categories_enabled) {
          setActiveTab("categories")
        }
      })
      .catch((err) => {
        console.error("Failed to load search-page data:", err)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchByCategory = (cat: SearchPageCategoryItem) => {
    setQuery("")
    setAppliedCategory({ id: cat.id, name: cat.name })
    setAppliedBrand(null)
    doSearch({ categoryIds: [cat.id], page: 1 })
  }

  const searchByBrand = (brand: SearchPageBrandItem) => {
    setQuery("")
    setAppliedBrand({ id: brand.id, name: brand.name })
    setAppliedCategory(null)
    doSearch({ brandIds: [brand.id], page: 1 })
  }

  const clearAppliedSource = () => {
    setAppliedCategory(null)
    setAppliedBrand(null)
    setAllResults([])
    setHasSearched(false)
  }

  // Infinite scroll: достижение sentinel → подгрузка следующей серверной страницы.
  // appliedCategory/appliedBrand имеют приоритет над selectedCategories/Brands —
  // при поиске через табы категорий/брендов фильтр сидит в отдельном state,
  // и без этого учёта подгрузка ушла бы с пустыми фильтрами и схлопнула грид.
  useEffect(() => {
    if (!hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        if (loading || isLoadingMoreRef.current) return
        const catIds = appliedCategory
          ? [appliedCategory.id]
          : Array.from(selectedCategories)
        const brandIds = appliedBrand
          ? [appliedBrand.id]
          : Array.from(selectedBrands)
        doSearch({
          query,
          categoryIds: catIds,
          brandIds,
          pmin: priceFrom,
          pmax: priceTo,
          page: currentPage + 1,
          append: true,
        })
      },
      { rootMargin: "200px" }
    )
    const el = loadMoreRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [hasMore, loading, currentPage, query, selectedCategories, selectedBrands, priceFrom, priceTo, appliedCategory, appliedBrand, doSearch])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (appliedCategory || appliedBrand) {
      setAppliedCategory(null)
      setAppliedBrand(null)
    }
  }

  const handleSearch = () => {
    if (loading) return
    setAppliedCategory(null)
    setAppliedBrand(null)
    doSearch({ query, page: 1 })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (loading) return
      setAppliedCategory(null)
      setAppliedBrand(null)
      doSearch({ query, page: 1 })
    }
  }

  const resetFilters = () => {
    setSelectedCategories(new Set())
    setSelectedBrands(new Set())
    setPriceFrom("")
    setPriceTo("")
  }

  const hasActiveFilters = !!(selectedCategories.size > 0 || selectedBrands.size > 0 || priceFrom || priceTo)
  const activeFilterCount = selectedCategories.size + selectedBrands.size + (priceFrom ? 1 : 0) + (priceTo ? 1 : 0)

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      {/* Header with search */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 px-4 h-14">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Поиск товаров..."
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-9 h-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-0 focus-visible:ring-0"
            />
            {(query || appliedCategory || appliedBrand) && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setQuery("")
                  clearAppliedSource()
                  inputRef.current?.focus()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            size="sm"
            className="h-10 px-4 shrink-0 bg-brand-yellow hover:bg-yellow-500 text-black font-medium rounded-full"
            onClick={handleSearch}
            disabled={loading || query.trim().length < 2}
          >
            Найти
          </Button>
        </div>

        {/* Filter toggle bar — only show when there are results */}
        {allResults.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800">
            <Button
              variant="outline"
              size="sm"
              className={`h-8 text-xs gap-1.5 ${
                hasActiveFilters
                  ? "bg-brand-yellow border-brand-yellow text-black hover:bg-yellow-500"
                  : ""
              }`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Фильтры
              {hasActiveFilters && (
                <span className="ml-0.5 bg-black text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-gray-500"
                onClick={resetFilters}
              >
                Сбросить
              </Button>
            )}
            <span className="text-xs text-gray-500">
              Найдено: {totalCount ?? allResults.length}
            </span>
          </div>
        )}
      </div>

      {/* Filters drawer (bottom sheet) */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex flex-row items-center justify-between pb-2">
            <DrawerTitle>Фильтры</DrawerTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-gray-500 gap-1"
                onClick={resetFilters}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сбросить
              </Button>
            )}
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-4 space-y-5">
            {/* Categories — multi-select */}
            {availableCategories.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Категория
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat.id}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedCategories.has(cat.id)
                          ? "bg-brand-yellow text-black"
                          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brands — multi-select */}
            {availableBrands.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Бренд
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableBrands.map((brand) => (
                    <button
                      key={brand.id}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedBrands.has(brand.id)
                          ? "bg-brand-yellow text-black"
                          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                      onClick={() => toggleBrand(brand.id)}
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price range */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Цена
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="от"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
                <span className="text-gray-400 text-sm shrink-0">—</span>
                <Input
                  type="number"
                  placeholder="до"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <Button
              className="w-full h-12 bg-brand-yellow hover:bg-yellow-500 text-black font-semibold rounded-xl text-sm"
              onClick={() => setFiltersOpen(false)}
            >
              Показать {filteredResults.length} {filteredResults.length === 1 ? "товар" : filteredResults.length < 5 ? "товара" : "товаров"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Results */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Full-screen loading — только когда у нас ещё ничего не загружено.
            При refetch'е грид остаётся, мерцания нет. */}
        {loading && !hasSearched && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && query.trim().length >= 2 && filteredResults.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Ничего не найдено
          </div>
        )}

        {visibleResults.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2 px-4 py-3">
              {visibleResults.map((product) => (
                <MobileProductCard
                  key={product.id}
                  product={product}
                  wholesaleUser={wholesaleUser}
                />
              ))}
            </div>

            {/* Load more trigger — sentinel для IntersectionObserver, кнопка как fallback. */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center px-4 py-4">
                <Button
                  variant="outline"
                  onClick={() => doSearch({
                    query,
                    categoryIds: appliedCategory ? [appliedCategory.id] : Array.from(selectedCategories),
                    brandIds: appliedBrand ? [appliedBrand.id] : Array.from(selectedBrands),
                    pmin: priceFrom,
                    pmax: priceTo,
                    page: currentPage + 1,
                    append: true,
                  })}
                  disabled={loading}
                  className="w-full max-w-xs h-10 rounded-xl font-medium"
                >
                  {loading ? "Загрузка…" : `Показать ещё (${remaining} осталось)`}
                </Button>
              </div>
            )}
          </>
        )}

        {!loading && !query.trim() && !hasSearched && (() => {
          const s = searchPageData?.settings
          const cats = searchPageData?.categories || []
          const brands = searchPageData?.brands || []
          const showCategoriesTab = s?.categories_enabled && cats.length > 0
          const showBrandsTab = s?.brands_enabled && brands.length > 0
          const hasAnyTab = showCategoriesTab || showBrandsTab

          if (!searchPageData || !hasAnyTab) {
            return (
              <div className="text-center py-12 text-gray-400">
                <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Введите название товара</p>
              </div>
            )
          }

          const effectiveTab = activeTab === "categories" && !showCategoriesTab
            ? "brands"
            : activeTab === "brands" && !showBrandsTab
            ? "categories"
            : activeTab

          return (
            <div className="pt-4">
              <div className="flex justify-center mb-4">
                <div className="inline-flex bg-gray-100 rounded-full p-1 shadow-inner">
                  {showCategoriesTab && (
                    <button
                      onClick={() => setActiveTab("categories")}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                        effectiveTab === "categories" ? "bg-white text-black shadow-md" : "text-gray-600"
                      }`}
                    >
                      Категории
                    </button>
                  )}
                  {showBrandsTab && (
                    <button
                      onClick={() => setActiveTab("brands")}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                        effectiveTab === "brands" ? "bg-white text-black shadow-md" : "text-gray-600"
                      }`}
                    >
                      Бренды
                    </button>
                  )}
                </div>
              </div>

              {effectiveTab === "categories" && showCategoriesTab && (
                <div className="grid grid-cols-3 gap-3 px-3">
                  {cats.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => searchByCategory(cat)}
                      className="flex flex-col bg-white rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.12)] active:shadow-[0_6px_16px_rgba(0,0,0,0.16)] active:scale-[0.98] transition-all"
                    >
                      <div className="relative w-full aspect-square bg-white overflow-hidden">
                        {cat.image_url ? (
                          <Image src={getImageUrl(cat.image_url)} alt={cat.name} fill className="object-contain p-2" sizes="33vw" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Tag className="h-7 w-7 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5 bg-yellow-400 min-h-[2.5rem] flex items-center">
                        <span className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2">{cat.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {effectiveTab === "brands" && showBrandsTab && (
                <div className="grid grid-cols-3 gap-3 px-3">
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => searchByBrand(brand)}
                      className="relative aspect-square w-full bg-white rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.12)] active:shadow-[0_6px_16px_rgba(0,0,0,0.16)] active:scale-[0.98] transition-all p-1.5"
                    >
                      <div className="relative w-full h-full rounded-lg overflow-hidden bg-white">
                        {brand.image_url ? (
                          <Image src={getImageUrl(brand.image_url)} alt={brand.name} fill className="object-contain" sizes="33vw" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Building2 className="h-7 w-7 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Чип источника */}
        {!loading && hasSearched && (appliedCategory || appliedBrand) && (
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs font-medium border-brand-yellow bg-yellow-50">
              {appliedCategory ? <Tag className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
              {appliedCategory ? `Категория: ${appliedCategory.name}` : `Бренд: ${appliedBrand?.name}`}
              <button
                onClick={() => { setQuery(""); clearAppliedSource() }}
                className="ml-1 rounded-full hover:bg-yellow-200 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 right-4 z-40 w-10 h-10 bg-brand-yellow text-black rounded-full shadow-lg flex items-center justify-center"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
