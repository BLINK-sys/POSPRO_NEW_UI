"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Search, X, Loader2, SlidersHorizontal, RotateCcw, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { isWholesaleUser } from "@/lib/utils"
import type { ProductData } from "@/app/actions/public"
import { useAuth } from "@/context/auth-context"
import { getApiUrl } from "@/lib/api-address"
import MobileProductCard from "./mobile-product-card"

const PAGE_SIZE = 50

export default function MobileSearchPage() {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  const [query, setQuery] = useState("")
  const [allResults, setAllResults] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const searchingRef = useRef(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

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

  // Extract unique categories from ALL search results
  const availableCategories = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of allResults) {
      const catId = p.category_id ? Number(p.category_id) : null
      if (catId) {
        let name: string | undefined
        if (p.category && typeof p.category === "object" && "name" in p.category) {
          name = (p.category as any).name
        } else if (p.category && typeof p.category === "string") {
          name = p.category as unknown as string
        }
        if (name) {
          map.set(catId, name)
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allResults])

  // Extract unique brands from ALL search results
  const availableBrands = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of allResults) {
      const brandId = p.brand_id ? Number(p.brand_id) : null
      if (brandId && p.brand_info) {
        map.set(brandId, p.brand_info.name)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allResults])

  // Apply client-side filters to ALL results
  const filteredResults = useMemo(() => {
    let filtered = allResults

    if (selectedCategories.size > 0) {
      filtered = filtered.filter((p) => selectedCategories.has(Number(p.category_id)))
    }
    if (selectedBrands.size > 0) {
      filtered = filtered.filter((p) => selectedBrands.has(Number(p.brand_id)))
    }
    if (priceFrom) {
      const min = Number(priceFrom)
      if (!isNaN(min)) {
        filtered = filtered.filter((p) => p.price >= min)
      }
    }
    if (priceTo) {
      const max = Number(priceTo)
      if (!isNaN(max)) {
        filtered = filtered.filter((p) => p.price <= max)
      }
    }

    return filtered
  }, [allResults, selectedCategories, selectedBrands, priceFrom, priceTo])

  // Visible slice for pagination
  const visibleResults = useMemo(
    () => filteredResults.slice(0, visibleCount),
    [filteredResults, visibleCount]
  )

  const hasMore = visibleCount < filteredResults.length
  const remaining = Math.max(0, filteredResults.length - visibleCount)

  // Autofocus
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Search with guard against concurrent calls — direct API call (bypasses server action serialization)
  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setAllResults([])
      setVisibleCount(PAGE_SIZE)
      return
    }
    // Prevent concurrent searches
    if (searchingRef.current) return
    searchingRef.current = true
    setLoading(true)
    try {
      const response = await fetch(
        getApiUrl(`/products/search?q=${encodeURIComponent(searchQuery.trim())}&limit=5000`),
        { cache: "no-store" }
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const products = await response.json()

      const data: ProductData[] = products.map((product: any) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        wholesale_price: product.wholesale_price,
        quantity: product.quantity,
        status: product.status && typeof product.status === "object" ? product.status : undefined,
        brand_id: product.brand_id ? Number(product.brand_id) : null,
        brand_info: product.brand_info,
        description: product.description,
        category_id: product.category_id ? Number(product.category_id) : undefined,
        category: product.category,
        image_url: product.image,
        availability_status: product.availability_status ?? undefined,
      }))

      setAllResults(data)
      setVisibleCount(PAGE_SIZE)
      // Reset filters on new search
      setSelectedCategories(new Set())
      setSelectedBrands(new Set())
      setPriceFrom("")
      setPriceTo("")
    } catch (e) {
      console.error("Search error:", e)
    } finally {
      searchingRef.current = false
      setLoading(false)
    }
  }, [])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedCategories, selectedBrands, priceFrom, priceTo])

  // IntersectionObserver for auto-loading more
  useEffect(() => {
    if (!hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE)
        }
      },
      { rootMargin: "200px" }
    )

    const el = loadMoreRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasMore, filteredResults.length])

  const handleInputChange = (value: string) => {
    setQuery(value)
  }

  const handleSearch = () => {
    if (loading) return
    doSearch(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (loading) return
      doSearch(query)
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
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setQuery("")
                  setAllResults([])
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
              {hasActiveFilters
                ? `${filteredResults.length} из ${allResults.length}`
                : `Найдено: ${allResults.length}`}
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
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && query.trim().length >= 2 && filteredResults.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Ничего не найдено
          </div>
        )}

        {!loading && visibleResults.length > 0 && (
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

            {/* Load more trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center px-4 py-4">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="w-full max-w-xs h-10 rounded-xl font-medium"
                >
                  Показать ещё ({remaining} осталось)
                </Button>
              </div>
            )}
          </>
        )}

        {!loading && !query.trim() && (
          <div className="text-center py-12 text-gray-400">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Введите название товара</p>
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
