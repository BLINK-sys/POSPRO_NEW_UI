"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Search, X, Loader2, ChevronUp, RotateCcw, Tag, Building2, ChevronRight } from "lucide-react"
import { getSuppliersText, getWinningWarehouseSuffix } from "@/lib/product-helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { isWholesaleUser, formatProductPrice, getRetailPriceClass, getWholesalePriceClass, cn } from "@/lib/utils"
import { type ProductData, searchProducts as searchProductsAction } from "@/app/actions/public"
import type { SearchPagePublicData, SearchPageCategoryItem, SearchPageBrandItem } from "@/lib/search-page-types"
import { useAuth } from "@/context/auth-context"
import { getApiUrl } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { AddToKPButton } from "@/components/add-to-kp-button"
import { Slider } from "@/components/ui/slider"
import { QuickViewButton } from "@/components/quick-view-modal"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"

const PAGE_SIZE = 20

export default function DesktopSearchPage() {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const isSystemUser = user?.role === "admin" || user?.role === "system"
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Initial values from URL — preserved when user comes back from a product detail page.
  const initialQuery = searchParams.get("q") || ""
  // ВАЖНО: пустой "" .split(",") даёт [""], а Number("") === 0 — поэтому
  // без явной проверки на пустоту мы получаем initialCats = [0], URL
  // самозаполняется ?cat=0 и фильтр «застревает» на несуществующей
  // категории с id=0. Раньше работало случайно, баг проявился сейчас.
  const parseIdsParam = (param: string | null): number[] => {
    if (!param) return []
    return param
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
  }
  const initialCats = parseIdsParam(searchParams.get("cat"))
  const initialBrands = parseIdsParam(searchParams.get("brand"))
  const initialPmin = searchParams.get("pmin") || ""
  const initialPmax = searchParams.get("pmax") || ""

  const [query, setQuery] = useState(initialQuery)
  const [allResults, setAllResults] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  // Текущая страница серверной пагинации. Стартует с 1, инкрементится при скролле.
  // Сбрасывается в 1 при смене query или любого фильтра.
  const [currentPage, setCurrentPage] = useState(1)
  // total_count из последнего ответа бэка — для подсказки и подсчёта hasMore.
  const [totalCount, setTotalCount] = useState<number | null>(null)
  // Facets от бэка — счётчики по ВСЕМ матчам, не по странице.
  // Используются для рендера UI фильтров (категорий, брендов, диапазона цен).
  // null = ещё не получали (первый рендер до search'а).
  const [facetsData, setFacetsData] = useState<{
    categories: { id: number; name: string; count: number }[]
    brands: { id: number; name: string; count: number }[]
    price_min: number
    price_max: number
  } | null>(null)
  // Защита от подгрузки follow-up страниц во время первого fetch'а.
  const isLoadingMoreRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const searchingRef = useRef(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  // Tracks the query that was actually submitted as a search. When the user
  // edits the input away from this value, restored filters become stale and
  // are auto-cleared so that the new query isn't crippled by leftovers.
  const lastSearchedQuery = useRef(initialQuery)

  // Source-filter — задаётся когда юзер кликнул карточку категории/бренда
  // на «пустом» состоянии. В отличие от обычного текстового поиска, где
  // фильтрация по имени, здесь бэк фильтрует по реальному category_id /
  // brand_id. Один из двух — null означает обычный текстовый поиск.
  const [appliedCategory, setAppliedCategory] = useState<{ id: number; name: string } | null>(null)
  const [appliedBrand, setAppliedBrand] = useState<{ id: number; name: string } | null>(null)

  // Курируемая панелька «Категории/Бренды» под строкой поиска. Грузится
  // один раз при маунте (через unstable_cache на серверной стороне).
  const [searchPageData, setSearchPageData] = useState<SearchPagePublicData | null>(null)
  const [activeTab, setActiveTab] = useState<"categories" | "brands">("categories")

  // Filters — initialized from URL
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set(initialCats))
  const [selectedBrands, setSelectedBrands] = useState<Set<number>>(new Set(initialBrands))
  const [priceFrom, setPriceFrom] = useState(initialPmin)
  const [priceTo, setPriceTo] = useState(initialPmax)
  // Live position of the price slider while the user is dragging. We don't
  // commit it to priceFrom/priceTo until they release the thumb — otherwise
  // the facet list would reshape on every micro-step and yank the slider
  // out from under the cursor.
  const [pricePreview, setPricePreview] = useState<[number, number] | null>(null)
  const [categorySearch, setCategorySearch] = useState("")
  const [brandSearch, setBrandSearch] = useState("")
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showAllBrands, setShowAllBrands] = useState(false)

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleBrand = (id: number) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const extractCategoryName = (p: ProductData): string | undefined => {
    if (p.category && typeof p.category === "object" && "name" in p.category) return (p.category as any).name
    if (p.category && typeof p.category === "string") return p.category as unknown as string
    return undefined
  }

  // Все «available»-списки приходят с бэка как facets — фильтры server-side.
  // Селект которого нет в текущем facets-снимке (например юзер только что
  // выбрал бренд который теперь подсветил всю категорию) — тоже добавляем
  // чтобы можно было его снять.
  const availableCategories = useMemo(() => {
    const map = new Map<number, { name: string; count?: number }>()
    if (facetsData) {
      for (const c of facetsData.categories) {
        map.set(c.id, { name: c.name, count: c.count })
      }
    }
    for (const id of selectedCategories) {
      if (map.has(id)) continue
      const found = allResults.find((p) => p.category_id != null && Number(p.category_id) === id)
      const name = found ? extractCategoryName(found) : undefined
      if (name) map.set(id, { name })
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [facetsData, selectedCategories, allResults])

  const availableBrands = useMemo(() => {
    const map = new Map<number, { name: string; count?: number }>()
    if (facetsData) {
      for (const b of facetsData.brands) {
        map.set(b.id, { name: b.name, count: b.count })
      }
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

  // Price range из facets — реальный диапазон по ВСЕМ матчам, не по странице.
  const priceRange = useMemo(() => {
    if (facetsData) {
      return {
        min: Math.floor(facetsData.price_min || 0),
        max: Math.ceil(facetsData.price_max || 0),
      }
    }
    return { min: 0, max: 0 }
  }, [facetsData])

  // Серверная пагинация: items накапливаются в allResults при скролле.
  // Локальной фильтрации больше нет — бэк уже отфильтровал.
  const filteredResults = allResults
  const visibleResults = allResults
  const hasMore = totalCount !== null && allResults.length < totalCount
  const remaining = totalCount !== null ? Math.max(0, totalCount - allResults.length) : 0

  const hasActiveFilters = !!(selectedCategories.size > 0 || selectedBrands.size > 0 || priceFrom || priceTo)

  const resetFilters = () => {
    setSelectedCategories(new Set())
    setSelectedBrands(new Set())
    setPriceFrom("")
    setPriceTo("")
    setPricePreview(null)
  }

  // Drop selected category/brand IDs that don't exist anywhere in the current
  // search results (i.e. they're stale leftovers from a previous query in URL).
  // We compare against the *unfiltered* set of cats/brands in allResults — not
  // against availableCategories/Brands, since those are now narrowed by the
  // facet logic above and we don't want to nuke a selection just because
  // another active filter temporarily hides it.
  useEffect(() => {
    if (allResults.length === 0) return
    const allCatIds = new Set<number>()
    const allBrandIds = new Set<number>()
    for (const p of allResults) {
      if (p.category_id) allCatIds.add(Number(p.category_id))
      if (p.brand_id) allBrandIds.add(Number(p.brand_id))
    }
    setSelectedCategories((prev) => {
      const filtered = new Set(Array.from(prev).filter((id) => allCatIds.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
    setSelectedBrands((prev) => {
      const filtered = new Set(Array.from(prev).filter((id) => allBrandIds.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
  }, [allResults])

  // Scroll-to-top
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > window.innerHeight * 2)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // AbortController текущего запроса — нужен чтобы при каждом нажатии
  // клавиши убивать предыдущий fetch. Сам ref не вызывает ререндер.
  const searchAbortRef = useRef<AbortController | null>(null)

  // Server-side search: фильтры (категории/бренды/цена) + пагинация
  // полностью на бэке. На первый запрос (page=1) запрашиваем facets;
  // при подгрузке follow-up страниц facets не нужны (они уже есть).
  // Прямой fetch на /api/public/products/search с AbortController — server
  // action не используем (его клиентский abort не отменяет работу на бэке).
  const doSearch = useCallback(async (
    args: {
      query?: string
      categoryIds?: number[]
      brandIds?: number[]
      pmin?: string | number
      pmax?: string | number
      page?: number
      append?: boolean  // true = добавить к существующим (скролл), false = заменить (новый поиск/фильтр)
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
    // Текстовый поиск без фильтров требует минимум 2 символа.
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
      // facets просим только на первой странице — на скролле они уже есть.
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
        id: product.id, name: product.name, slug: product.slug,
        price: product.price, wholesale_price: product.wholesale_price,
        quantity: product.quantity,
        status: product.status && typeof product.status === "object" ? product.status : undefined,
        brand_id: product.brand_id ? Number(product.brand_id) : null,
        brand_info: product.brand_info,
        supplier_id: product.supplier_id ?? null,
        supplier_name: product.supplier_name || product.supplier?.name || null,
        description: product.description,
        category_id: product.category_id ? Number(product.category_id) : undefined,
        category: product.category, image_url: product.image_url || product.image,
        availability_status: product.availability_status ?? undefined,
      }))
      // Только применяем результат если запрос всё ещё актуален.
      if (!ac.signal.aborted) {
        if (append) {
          setAllResults(prev => [...prev, ...data])
        } else {
          setAllResults(data)
          setFacetsData(respFacets)
          lastSearchedQuery.current = trimmedQuery
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

  // Initial search on mount — восстанавливаем фильтры из URL и стартуем
  // первую страницу. Зависит ТОЛЬКО от mount чтобы не reflowить когда мы
  // сами переписываем URL ниже через router.replace.
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 2) {
      doSearch({
        query: initialQuery,
        categoryIds: Array.from(selectedCategories),
        brandIds: Array.from(selectedBrands),
        pmin: priceFrom,
        pmax: priceTo,
        page: 1,
      })
    } else {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-search: debounce 300ms на изменение query. Также реагирует на смену
  // фильтров (selectedCategories/Brands/priceFrom/priceTo) — все они идут
  // на бэк, поэтому любая смена должна перезапросить page=1 с новыми условиями.
  // appliedCategory/appliedBrand → пропускаем, чтобы при возврате с карточки
  // товара не дёрнуть лишний раз.
  useEffect(() => {
    if (appliedCategory || appliedBrand) return
    const trimmed = query.trim()
    const hasAnyFilter = selectedCategories.size > 0 || selectedBrands.size > 0 || priceFrom || priceTo
    // Меньше 2 символов И нет фильтров — мгновенно чистим без debounce.
    if (!hasAnyFilter && trimmed.length < 2) {
      searchAbortRef.current?.abort()
      setAllResults([])
      setTotalCount(null)
      setFacetsData(null)
      setCurrentPage(1)
      setLoading(false)
      lastSearchedQuery.current = trimmed
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

  // Загружаем настройки и данные курируемой панели один раз при маунте.
  // Через прямой fetch к Next.js API route, не через server action —
  // server-action путь имел баг где promise зависал в Next.js 14.
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
      .catch(() => { /* silent — search page просто не покажет панель */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Клик по карточке категории — отдаём в поиск с category_id, поле
  // ввода чистим (юзер ищет не по имени, а по факту категории).
  const searchByCategory = (cat: SearchPageCategoryItem) => {
    setQuery("")
    setAppliedCategory({ id: cat.id, name: cat.name })
    setAppliedBrand(null)
    clearFiltersIfAny()
    doSearch({ categoryIds: [cat.id], page: 1 })
  }

  const searchByBrand = (brand: SearchPageBrandItem) => {
    setQuery("")
    setAppliedBrand({ id: brand.id, name: brand.name })
    setAppliedCategory(null)
    clearFiltersIfAny()
    doSearch({ brandIds: [brand.id], page: 1 })
  }

  // Полный сброс — возвращаемся к стартовому экрану с табами
  const clearAppliedSource = () => {
    setAppliedCategory(null)
    setAppliedBrand(null)
    setAllResults([])
    setHasSearched(false)
    clearFiltersIfAny()
    lastSearchedQuery.current = ""
  }

  // Persist current query + filters to the URL so coming back from a product
  // detail page restores everything.
  useEffect(() => {
    const sp = new URLSearchParams()
    if (query.trim()) sp.set("q", query.trim())
    if (selectedCategories.size > 0) sp.set("cat", Array.from(selectedCategories).join(","))
    if (selectedBrands.size > 0) sp.set("brand", Array.from(selectedBrands).join(","))
    if (priceFrom) sp.set("pmin", priceFrom)
    if (priceTo) sp.set("pmax", priceTo)
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [query, selectedCategories, selectedBrands, priceFrom, priceTo, pathname, router])

  // Infinite scroll: при достижении нижнего sentinel'а догружаем следующую
  // страницу с бэка. Уже летящий запрос (loading) и догрузка (isLoadingMoreRef)
  // блокируют повторный fire. appliedCategory/appliedBrand учитываем как
  // первичный источник — без них бэк получил бы пустой запрос и подгрузка
  // схлопнула бы грид при поиске через табы категорий/брендов.
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

  const clearFiltersIfAny = () => {
    if (selectedCategories.size > 0) setSelectedCategories(new Set())
    if (selectedBrands.size > 0) setSelectedBrands(new Set())
    if (priceFrom) setPriceFrom("")
    if (priceTo) setPriceTo("")
  }

  const handleQueryChange = (val: string) => {
    setQuery(val)
    // Если юзер начал печатать в поиск — сбрасываем applied category/brand
    // (это был отдельный режим), фильтры тоже стираем
    if (appliedCategory || appliedBrand) {
      setAppliedCategory(null)
      setAppliedBrand(null)
    }
    if (val.trim() !== lastSearchedQuery.current) {
      clearFiltersIfAny()
    }
  }

  const triggerNewSearch = () => {
    if (loading) return
    setAppliedCategory(null)
    setAppliedBrand(null)
    clearFiltersIfAny()
    doSearch({ query, page: 1 })
  }
  const handleSearch = () => triggerNewSearch()
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") triggerNewSearch() }

  // Pluralize
  const pluralize = (n: number) => {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return "товар"
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "товара"
    return "товаров"
  }

  const showFilters = allResults.length > 0

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      {/* Search bar — same style as header */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Я ищу..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 h-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-md hover:shadow-lg transition-shadow duration-200"
            />
            {(query || appliedCategory || appliedBrand) && (
              <Button
                variant="ghost" size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
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
            className="h-10 w-10 p-0 rounded-full bg-brand-yellow hover:bg-yellow-500 text-black shadow-md hover:shadow-lg transition-shadow duration-200 flex-shrink-0"
            onClick={handleSearch}
            disabled={loading || query.trim().length < 2}
            title="Найти"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Full-screen loading — только на ПЕРВУЮ загрузку (когда у нас ещё
          ничего нет). При refetch'е (смена фильтра, debounced query) ничего
          не скрываем — это вызывало некрасивое мерцание. */}
      {loading && !hasSearched && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state — курируемая панель «Категории / Бренды» */}
      {!loading && !hasSearched && (() => {
        const s = searchPageData?.settings
        const cats = searchPageData?.categories || []
        const brands = searchPageData?.brands || []
        const showCategoriesTab = s?.categories_enabled && cats.length > 0
        const showBrandsTab = s?.brands_enabled && brands.length > 0
        const hasAnyTab = showCategoriesTab || showBrandsTab
        // Если данные ещё не загрузились — показываем дефолтную подсказку
        if (!searchPageData) {
          return (
            <div className="text-center py-20 text-gray-400">
              <Search className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Введите название товара и нажмите «Найти»</p>
            </div>
          )
        }
        // Если оба таба выключены или пусты — старый фолбэк
        if (!hasAnyTab) {
          return (
            <div className="text-center py-20 text-gray-400">
              <Search className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Введите название товара и нажмите «Найти»</p>
            </div>
          )
        }
        // Если активный таб выключен — переключаемся на тот что доступен
        const effectiveTab = activeTab === "categories" && !showCategoriesTab
          ? "brands"
          : activeTab === "brands" && !showBrandsTab
          ? "categories"
          : activeTab

        return (
          <div className="max-w-6xl mx-auto">
            {/* Таб-переключатель */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex bg-gray-100 rounded-full p-1 shadow-inner">
                {showCategoriesTab && (
                  <button
                    onClick={() => setActiveTab("categories")}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                      effectiveTab === "categories"
                        ? "bg-white text-black shadow-md"
                        : "text-gray-600 hover:text-black"
                    }`}
                  >
                    Категории
                  </button>
                )}
                {showBrandsTab && (
                  <button
                    onClick={() => setActiveTab("brands")}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                      effectiveTab === "brands"
                        ? "bg-white text-black shadow-md"
                        : "text-gray-600 hover:text-black"
                    }`}
                  >
                    Бренды
                  </button>
                )}
              </div>
            </div>

            {/* Сетка карточек. Каждая карточка занимает свою ячейку
                (без фиксированных w-56 — иначе вылезают друг на друга). */}
            {effectiveTab === "categories" && showCategoriesTab && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cats.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => searchByCategory(cat)}
                    className="group bg-white rounded-xl overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-[1.02] transition-all duration-300 cursor-pointer flex flex-col text-left"
                  >
                    {/* Картинка целиком вписывается в область — object-contain
                        без внутреннего padding, чтобы лого/фото занимали max
                        пространство и не появлялись лишние «поля». */}
                    <div className="relative h-44 bg-white overflow-hidden">
                      {cat.image_url ? (
                        <Image
                          src={getImageUrl(cat.image_url)}
                          alt={cat.name}
                          fill
                          className="object-contain group-hover:scale-110 transition-transform duration-300"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Tag className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                    </div>
                    {/* Жёлтая полоса с rounded-xl на всех углах — как на
                        главной. Верхние скругления видны в зоне перехода
                        к картинке, нижние клипаются card overflow-hidden.
                        Стрелка с rounded-tr-lg + rounded-bl-lg — плавно
                        ложится в угол жёлтого блока. */}
                    <div className="relative bg-yellow-400 h-14 px-4 flex items-center rounded-xl">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight pr-10 line-clamp-2">
                        {cat.name}
                      </h3>
                      <div className="absolute top-0 right-0 w-8 h-8 bg-gray-900 rounded-tr-lg rounded-bl-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                        <ChevronRight className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {effectiveTab === "brands" && showBrandsTab && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => searchByBrand(brand)}
                    className="group relative aspect-square w-full bg-white rounded-xl overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-[1.02] transition-all duration-300 cursor-pointer p-3"
                  >
                    {/* Внутренний контейнер с собственным rounded-xl —
                        лого выглядит как «вставленная» карточка с отступом
                        от внешней границы. Прямоугольные/тёмные лого
                        получают свои закруглённые углы. */}
                    <div className="relative w-full h-full rounded-xl overflow-hidden bg-white">
                      {brand.image_url ? (
                        <Image
                          src={getImageUrl(brand.image_url)}
                          alt={brand.name}
                          fill
                          className="object-contain group-hover:scale-110 transition-transform duration-300"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Building2 className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                    </div>
                    {/* Hover-оверлей — на всю карточку (поверх padding) */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center pointer-events-none rounded-xl">
                      <h3 className="font-bold text-white text-base text-center px-3">{brand.name}</h3>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Чип источника поиска (категория/бренд) — показываем над результатами
          когда поиск пришёл из клика по карточке, а не из текста. */}
      {hasSearched && (appliedCategory || appliedBrand) && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Поиск по</span>
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1 text-sm font-medium border-brand-yellow bg-yellow-50"
          >
            {appliedCategory ? <Tag className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
            {appliedCategory ? `Категория: ${appliedCategory.name}` : `Бренд: ${appliedBrand?.name}`}
            <button
              onClick={() => {
                setQuery("")
                clearAppliedSource()
              }}
              className="ml-1 rounded-full hover:bg-yellow-200 p-0.5"
              title="Очистить"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* No results — показываем только когда запрос закончен и результат пуст. */}
      {!loading && hasSearched && allResults.length === 0 && (
        <div className="text-center py-16 text-gray-500">Ничего не найдено</div>
      )}

      {/* Main content: sidebar + grid. Скрываем `!loading &&` убран —
          панель и карточки остаются на месте при refetch'е, без мерцания.
          Loading-state видно только тонким индикатором (spinner в кнопке
          поиска вверху + opacity на гриде). */}
      {showFilters && (
        <div className="flex gap-6">
          {/* Left sidebar — filters */}
          <aside className="min-w-64 max-w-80 w-fit flex-shrink-0">
            <div className="sticky top-28 bg-white rounded-lg shadow-[0_0_12px_rgba(0,0,0,0.12)] p-4 max-h-[calc(100vh-8rem)] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
              <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Фильтры</h3>
                {hasActiveFilters && (
                  <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-black flex items-center gap-1 transition-colors">
                    <RotateCcw className="h-3 w-3" />
                    Сбросить
                  </button>
                )}
              </div>

              {/* Счётчик найденного — сразу после заголовка чтобы юзер
                  не скроллил весь сайдбар до низа. Показываем total_count
                  с бэка (по ВСЕМ совпадениям после фильтров, не только по
                  загруженной странице). */}
              {totalCount !== null && totalCount > 0 && (
                <div className="bg-brand-yellow rounded-xl p-3 text-center">
                  <span className="text-sm font-semibold text-black">
                    Найдено {totalCount} {pluralize(totalCount)}
                  </span>
                </div>
              )}

              {/* Categories */}
              {availableCategories.length > 0 && (() => {
                const LIMIT = 8
                const lowerSearch = categorySearch.toLowerCase()
                const filtered = categorySearch
                  ? availableCategories.filter((c) => c.name.toLowerCase().includes(lowerSearch))
                  : availableCategories
                const visible = showAllCategories || categorySearch ? filtered : filtered.slice(0, LIMIT)
                const hiddenCount = filtered.length - LIMIT

                return (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Категория{selectedCategories.size > 0 && <span className="ml-1 text-brand-yellow">({selectedCategories.size})</span>}
                    </h4>
                    {availableCategories.length > LIMIT && (
                      <input
                        type="text"
                        placeholder="Поиск категории..."
                        value={categorySearch}
                        onChange={(e) => { setCategorySearch(e.target.value); setShowAllCategories(false) }}
                        className="w-full mb-2 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-brand-yellow focus:outline-none transition-colors"
                      />
                    )}
                    <div className="space-y-1">
                      {visible.map((cat) => (
                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                          <Checkbox
                            checked={selectedCategories.has(cat.id)}
                            onCheckedChange={() => toggleCategory(cat.id)}
                            className="h-4 w-4 flex-shrink-0 border-gray-300 data-[state=checked]:bg-brand-yellow data-[state=checked]:border-brand-yellow"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-black transition-colors leading-tight flex-1">
                            {cat.name}
                            {cat.count !== undefined && (
                              <span className="text-gray-400 ml-1">({cat.count})</span>
                            )}
                          </span>
                        </label>
                      ))}
                      {filtered.length === 0 && categorySearch && (
                        <p className="text-xs text-gray-400 py-1">Не найдено</p>
                      )}
                    </div>
                    {!categorySearch && hiddenCount > 0 && (
                      <button
                        onClick={() => setShowAllCategories(!showAllCategories)}
                        className="text-xs text-brand-yellow hover:text-yellow-600 mt-2 font-medium transition-colors"
                      >
                        {showAllCategories ? "Скрыть" : `Ещё ${hiddenCount}`}
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* Brands */}
              {availableBrands.length > 0 && (() => {
                const LIMIT = 8
                const lowerSearch = brandSearch.toLowerCase()
                const filtered = brandSearch
                  ? availableBrands.filter((b) => b.name.toLowerCase().includes(lowerSearch))
                  : availableBrands
                const visible = showAllBrands || brandSearch ? filtered : filtered.slice(0, LIMIT)
                const hiddenCount = filtered.length - LIMIT

                return (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Бренд{selectedBrands.size > 0 && <span className="ml-1 text-brand-yellow">({selectedBrands.size})</span>}
                    </h4>
                    {availableBrands.length > LIMIT && (
                      <input
                        type="text"
                        placeholder="Поиск бренда..."
                        value={brandSearch}
                        onChange={(e) => { setBrandSearch(e.target.value); setShowAllBrands(false) }}
                        className="w-full mb-2 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-brand-yellow focus:outline-none transition-colors"
                      />
                    )}
                    <div className="space-y-1">
                      {visible.map((brand) => (
                        <label key={brand.id} className="flex items-center gap-2 cursor-pointer group">
                          <Checkbox
                            checked={selectedBrands.has(brand.id)}
                            onCheckedChange={() => toggleBrand(brand.id)}
                            className="h-4 w-4 flex-shrink-0 border-gray-300 data-[state=checked]:bg-brand-yellow data-[state=checked]:border-brand-yellow"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-black transition-colors leading-tight flex-1">
                            {brand.name}
                            {brand.count !== undefined && (
                              <span className="text-gray-400 ml-1">({brand.count})</span>
                            )}
                          </span>
                        </label>
                      ))}
                      {filtered.length === 0 && brandSearch && (
                        <p className="text-xs text-gray-400 py-1">Не найдено</p>
                      )}
                    </div>
                    {!brandSearch && hiddenCount > 0 && (
                      <button
                        onClick={() => setShowAllBrands(!showAllBrands)}
                        className="text-xs text-brand-yellow hover:text-yellow-600 mt-2 font-medium transition-colors"
                      >
                        {showAllBrands ? "Скрыть" : `Ещё ${hiddenCount}`}
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* Price range */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Цена</h4>
                {(() => {
                  const hasRange = priceRange.max > 0
                  // Clip user-entered values to the current bounds so the
                  // slider thumbs never sit outside the track when the bounds
                  // shrink (e.g. picking a narrow-price brand).
                  const clip = (v: number) => Math.max(priceRange.min, Math.min(priceRange.max, v))
                  const committedValue: [number, number] = hasRange ? [
                    clip(priceFrom ? Number(priceFrom) : priceRange.min),
                    clip(priceTo ? Number(priceTo) : priceRange.max),
                  ] : [0, 0]
                  const sliderValue = pricePreview ?? committedValue
                  // What the input fields show: priority is dragging preview,
                  // then user-entered value, finally the available range.
                  const displayFrom = pricePreview ? String(pricePreview[0])
                    : (priceFrom || (hasRange ? String(priceRange.min) : ""))
                  const displayTo = pricePreview ? String(pricePreview[1])
                    : (priceTo || (hasRange ? String(priceRange.max) : ""))
                  return (
                    <>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number" placeholder="от" value={displayFrom}
                          onChange={(e) => setPriceFrom(e.target.value)}
                          className="h-9 text-sm rounded-lg"
                        />
                        <span className="text-gray-400 text-sm shrink-0">—</span>
                        <Input
                          type="number" placeholder="до" value={displayTo}
                          onChange={(e) => setPriceTo(e.target.value)}
                          className="h-9 text-sm rounded-lg"
                        />
                      </div>
                      {hasRange && (
                        <div className="mt-3 px-0.5">
                          <Slider
                            min={priceRange.min}
                            max={priceRange.max}
                            step={Math.max(1, Math.floor((priceRange.max - priceRange.min) / 100))}
                            value={sliderValue}
                            onValueChange={([min, max]) => setPricePreview([min, max])}
                            onValueCommit={([min, max]) => {
                              setPriceFrom(min <= priceRange.min ? "" : String(min))
                              setPriceTo(max >= priceRange.max ? "" : String(max))
                              setPricePreview(null)
                            }}
                          />
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              </div>
            </div>
          </aside>

          {/* Right — product grid. При refetch'е (loading=true но карточки
              уже есть) затемняем грид — нет мерцания, видно что идёт обновление. */}
          <main className={cn("flex-1 min-w-0 transition-opacity", loading && visibleResults.length > 0 && "opacity-60 pointer-events-none")}>
            {/* No filtered results */}
            {filteredResults.length === 0 && hasActiveFilters && (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg mb-3">Ничего не найдено по фильтрам</p>
                <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Сбросить фильтры
                </Button>
              </div>
            )}

            {visibleResults.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {visibleResults.map((product) => (
                    <div key={product.id} className="group">
                      <Link href={`/product/${product.slug}`}>
                        <Card className="hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer bg-white rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                          <CardContent className="p-3">
                            <div className="relative">
                              <div className="aspect-square relative bg-white rounded-lg overflow-hidden mb-3">
                                {product.image_url ? (
                                  <Image
                                    src={getImageUrl(product.image_url)}
                                    alt={product.name}
                                    fill
                                    className="object-contain group-hover:scale-110 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-2xl text-gray-400">📦</div>
                                )}

                                {/* Status badge */}
                                {product.status && (
                                  <div className="absolute top-2 left-2 z-10">
                                    <Badge
                                      className="text-xs px-2 py-1 shadow-md"
                                      style={{ backgroundColor: product.status.background_color, color: product.status.text_color }}
                                    >
                                      {product.status.name}
                                    </Badge>
                                  </div>
                                )}

                                {/* Favorite */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                  <FavoriteButton
                                    productId={product.id}
                                    productName={product.name}
                                    className="w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md hover:shadow-lg"
                                    size="sm"
                                  />
                                </div>

                                {/* Кнопка быстрого просмотра */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                  <QuickViewButton slug={product.slug} />
                                </div>

                                {/* Brand on hover */}
                                {product.brand_info && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                    <div className="p-3">
                                      <div className="text-xs text-white"><span className="font-medium">Бренд:</span> {product.brand_info.name}</div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Product info */}
                              <div className="space-y-1.5">
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium">Товар:</span> {product.name}
                                </div>
                                <div className={`text-xs font-bold ${getRetailPriceClass(wholesaleUser)}`}>
                                  <span className="font-medium">Цена:</span> {formatProductPrice(product.price)}{getWinningWarehouseSuffix(product as any, isSystemUser)}
                                </div>
                                {wholesaleUser && (
                                  <div className={`text-xs font-bold ${getWholesalePriceClass()}`}>
                                    <span className="font-medium">Оптовая цена:</span> {formatProductPrice(product.wholesale_price)}
                                  </div>
                                )}
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium">Наличие:</span>{" "}
                                  {product.availability_status ? (
                                    <span
                                      style={{
                                        backgroundColor: product.availability_status.background_color,
                                        color: product.availability_status.text_color,
                                        padding: "2px 6px", borderRadius: "4px", fontSize: "11px"
                                      }}
                                    >
                                      {formatAvailabilityStatusLabel(product.availability_status)}
                                    </span>
                                  ) : (
                                    <span>{product.quantity} шт.</span>
                                  )}
                                </div>
                                {/* Поставщики (только для админов) */}
                                {isSystemUser && (() => {
                                  const txt = getSuppliersText(product as any)
                                  return txt ? (
                                    <div className="text-xs text-gray-500 truncate">
                                      <span className="font-medium">Поставщик:</span> {txt}
                                    </div>
                                  ) : null
                                })()}
                                <div onClick={(e) => e.preventDefault()}>
                                  <AddToCartButton
                                    productId={product.id}
                                    productName={product.name}
                                    productSlug={product.slug}
                                    productPrice={product.price}
                                    productImageUrl={product.image_url}
                                    productArticle={product.article || ''}
                                    className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                                    size="sm"
                                  />
                                </div>
                                <div onClick={(e) => e.preventDefault()}>
                                  <AddToKPButton
                                    productId={product.id}
                                    productName={product.name}
                                    productSlug={product.slug}
                                    productPrice={product.price}
                                    productWholesalePrice={product.wholesale_price}
                                    productImageUrl={product.image_url}
                                    productDescription={product.description}
                                    productSupplierName={product.supplier_name}
                                    productBrandName={product.brand_info?.name}
                                    className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                                    size="sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Sentinel для IntersectionObserver — он сам триггерит
                    подгрузку следующей страницы. Кнопка остаётся как
                    fallback для пользователей с отключённым JS-observer'ом
                    или если автоскролл по какой-то причине не сработал. */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center py-8">
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
                      className="h-11 px-8 rounded-xl font-medium"
                    >
                      {loading ? "Загрузка…" : `Показать ещё (${remaining} осталось)`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 bg-brand-yellow text-black rounded-full shadow-lg flex items-center justify-center hover:bg-yellow-500 transition-colors"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}
