"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Search, X, Loader2, ChevronUp, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { isWholesaleUser, formatProductPrice, getRetailPriceClass, getWholesalePriceClass } from "@/lib/utils"
import type { ProductData } from "@/app/actions/public"
import { useAuth } from "@/context/auth-context"
import { getApiUrl } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { Slider } from "@/components/ui/slider"

const PAGE_SIZE = 50

export default function DesktopSearchPage() {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const searchParams = useSearchParams()

  const [query, setQuery] = useState("")
  const [allResults, setAllResults] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const searchingRef = useRef(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set())
  const [selectedBrands, setSelectedBrands] = useState<Set<number>>(new Set())
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
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

  // Extract unique categories
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
        if (name) map.set(catId, name)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allResults])

  // Extract unique brands
  const availableBrands = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of allResults) {
      const brandId = p.brand_id ? Number(p.brand_id) : null
      if (brandId && p.brand_info) map.set(brandId, p.brand_info.name)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allResults])

  // Apply filters
  const filteredResults = useMemo(() => {
    let filtered = allResults
    if (selectedCategories.size > 0) filtered = filtered.filter((p) => selectedCategories.has(Number(p.category_id)))
    if (selectedBrands.size > 0) filtered = filtered.filter((p) => selectedBrands.has(Number(p.brand_id)))
    if (priceFrom) { const min = Number(priceFrom); if (!isNaN(min)) filtered = filtered.filter((p) => p.price >= min) }
    if (priceTo) { const max = Number(priceTo); if (!isNaN(max)) filtered = filtered.filter((p) => p.price <= max) }
    return filtered
  }, [allResults, selectedCategories, selectedBrands, priceFrom, priceTo])

  // Min/max prices from all results (for slider bounds)
  const priceRange = useMemo(() => {
    if (allResults.length === 0) return { min: 0, max: 0 }
    const prices = allResults.map((p) => p.price).filter((p) => p > 0)
    if (prices.length === 0) return { min: 0, max: 0 }
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
  }, [allResults])

  const visibleResults = useMemo(() => filteredResults.slice(0, visibleCount), [filteredResults, visibleCount])
  const hasMore = visibleCount < filteredResults.length
  const remaining = Math.max(0, filteredResults.length - visibleCount)

  const hasActiveFilters = !!(selectedCategories.size > 0 || selectedBrands.size > 0 || priceFrom || priceTo)

  const resetFilters = () => {
    setSelectedCategories(new Set())
    setSelectedBrands(new Set())
    setPriceFrom("")
    setPriceTo("")
  }

  // Scroll-to-top
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > window.innerHeight * 2)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Search function
  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setAllResults([])
      setVisibleCount(PAGE_SIZE)
      return
    }
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
        id: product.id, name: product.name, slug: product.slug,
        price: product.price, wholesale_price: product.wholesale_price,
        quantity: product.quantity,
        status: product.status && typeof product.status === "object" ? product.status : undefined,
        brand_id: product.brand_id ? Number(product.brand_id) : null,
        brand_info: product.brand_info, description: product.description,
        category_id: product.category_id ? Number(product.category_id) : undefined,
        category: product.category, image_url: product.image,
        availability_status: product.availability_status ?? undefined,
      }))
      setAllResults(data)
      setHasSearched(true)
      setVisibleCount(PAGE_SIZE)
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

  // Auto-search from URL param ?q=
  useEffect(() => {
    const urlQuery = searchParams.get("q")
    if (urlQuery && urlQuery.trim().length >= 2) {
      setQuery(urlQuery)
      doSearch(urlQuery)
    } else {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [searchParams, doSearch])

  // Reset visible count on filter change
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [selectedCategories, selectedBrands, priceFrom, priceTo])

  // IntersectionObserver for lazy load
  useEffect(() => {
    if (!hasMore) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount((prev) => prev + PAGE_SIZE) },
      { rootMargin: "200px" }
    )
    const el = loadMoreRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [hasMore, filteredResults.length])

  const handleSearch = () => { if (!loading) doSearch(query) }
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !loading) doSearch(query) }

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
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 h-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-md hover:shadow-lg transition-shadow duration-200"
            />
            {query && (
              <Button
                variant="ghost" size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                onClick={() => { setQuery(""); setAllResults([]); setHasSearched(false); inputRef.current?.focus() }}
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasSearched && (
        <div className="text-center py-20 text-gray-400">
          <Search className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Введите название товара и нажмите «Найти»</p>
        </div>
      )}

      {/* No results */}
      {!loading && hasSearched && allResults.length === 0 && (
        <div className="text-center py-16 text-gray-500">Ничего не найдено</div>
      )}

      {/* Main content: sidebar + grid */}
      {!loading && showFilters && (
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
                          <span className="text-sm text-gray-700 group-hover:text-black transition-colors leading-tight">{cat.name}</span>
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
                          <span className="text-sm text-gray-700 group-hover:text-black transition-colors leading-tight">{brand.name}</span>
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
                <div className="flex gap-2 items-center">
                  <Input
                    type="number" placeholder="от" value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    className="h-9 text-sm rounded-lg"
                  />
                  <span className="text-gray-400 text-sm shrink-0">—</span>
                  <Input
                    type="number" placeholder="до" value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                    className="h-9 text-sm rounded-lg"
                  />
                </div>
                {priceRange.max > 0 && (
                  <div className="mt-3 px-0.5">
                    <Slider
                      min={priceRange.min}
                      max={priceRange.max}
                      step={Math.max(1, Math.floor((priceRange.max - priceRange.min) / 100))}
                      value={[
                        priceFrom ? Number(priceFrom) : priceRange.min,
                        priceTo ? Number(priceTo) : priceRange.max,
                      ]}
                      onValueChange={([min, max]) => {
                        setPriceFrom(min <= priceRange.min ? "" : String(min))
                        setPriceTo(max >= priceRange.max ? "" : String(max))
                      }}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-gray-400">{priceRange.min.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-400">{priceRange.max.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Result count */}
              <div className="pt-2 border-t border-gray-200">
                <div className="bg-brand-yellow rounded-xl p-3 text-center">
                  <span className="text-sm font-semibold text-black">
                    Найдено {filteredResults.length} {pluralize(filteredResults.length)}
                  </span>
                  {hasActiveFilters && (
                    <span className="text-xs text-gray-700 block mt-0.5">
                      из {allResults.length} результатов
                    </span>
                  )}
                </div>
              </div>
              </div>
            </div>
          </aside>

          {/* Right — product grid */}
          <main className="flex-1 min-w-0">
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
                                  <span className="font-medium">Цена:</span> {formatProductPrice(product.price)}
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
                                      {product.availability_status.status_name}
                                    </span>
                                  ) : (
                                    <span>{product.quantity} шт.</span>
                                  )}
                                </div>
                                <div onClick={(e) => e.preventDefault()}>
                                  <AddToCartButton
                                    productId={product.id}
                                    productName={product.name}
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

                {/* Load more */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center py-8">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                      className="h-11 px-8 rounded-xl font-medium"
                    >
                      Показать ещё ({remaining} осталось)
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
