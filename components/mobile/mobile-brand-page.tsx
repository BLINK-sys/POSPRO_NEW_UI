"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Loader2, ChevronDown, ChevronUp, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getProductsByBrandDetailed, getProductsByBrandAndCategory, getCategoriesByBrand, getAllBrands, type AllBrandsData } from "@/app/actions/public"
import { getImageUrl, isImageUrl } from "@/lib/image-utils"
import { isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import MobileProductCard from "./mobile-product-card"

interface MobileBrandPageProps {
  brandName: string
}

export default function MobileBrandPage({ brandName }: MobileBrandPageProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  const [products, setProducts] = useState<any[]>([])
  const [brand, setBrand] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [allBrands, setAllBrands] = useState<AllBrandsData[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }
    if (categoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [categoryDropdownOpen])

  // Show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Initial load & category change (reset products)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setPage(1)
      try {
        const [data, catsResult, brands] = await Promise.all([
          selectedCategory
            ? getProductsByBrandAndCategory(brandName, selectedCategory, { page: 1, perPage: 20 })
            : getProductsByBrandDetailed(brandName, { page: 1, perPage: 20 }),
          getCategoriesByBrand(brandName),
          allBrands.length === 0 ? getAllBrands() : Promise.resolve(allBrands),
        ])
        setProducts(data.products || [])
        if (data.brand) {
          setBrand(data.brand)
        }
        setTotalPages(data.total_pages || 1)
        setCategories(catsResult.categories || [])
        if (allBrands.length === 0) setAllBrands(brands)
      } catch (error) {
        console.error("Error loading brand:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [brandName, selectedCategory])

  // Load more products
  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const data = selectedCategory
        ? await getProductsByBrandAndCategory(brandName, selectedCategory, { page: nextPage, perPage: 20 })
        : await getProductsByBrandDetailed(brandName, { page: nextPage, perPage: 20 })
      setProducts(prev => [...prev, ...(data.products || [])])
      setPage(nextPage)
      setTotalPages(data.total_pages || 1)
    } catch (error) {
      console.error("Error loading more:", error)
    } finally {
      setLoadingMore(false)
    }
  }, [brandName, selectedCategory, page, totalPages, loadingMore])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const selectedCategoryName = selectedCategory
    ? categories.find((c: any) => c.id === selectedCategory)?.name || "Категория"
    : "Все категории"

  // Top 15 brands sorted by product count (descending)
  const topBrands = [...allBrands]
    .sort((a, b) => (b.products_count || 0) - (a.products_count || 0))
    .slice(0, 15)

  return (
    <div className="pb-4">
      {/* Горизонтальная полоса брендов: кнопка "Все" зафиксирована слева */}
      {allBrands.length > 0 && (
        <div className="border-b border-gray-100 flex">
          {/* Fixed "Все бренды" button */}
          <Link href="/brands" className="shrink-0 px-3 py-3 border-r border-gray-100 flex items-center">
            <div className="w-14 h-14 rounded-xl bg-brand-yellow flex flex-col items-center justify-center shadow-md">
              <LayoutGrid className="h-4 w-4 text-black" />
              <span className="text-[7px] font-bold text-black mt-0.5">Бренды</span>
            </div>
          </Link>
          {/* Scrollable brands */}
          <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-hide flex-1" style={{ scrollbarWidth: "none" }}>
            {topBrands.map((b) => (
              <Link
                key={b.id}
                href={`/brand/${encodeURIComponent(b.name)}`}
                className="shrink-0"
              >
                <div className={`w-14 h-14 relative rounded-xl overflow-hidden shadow-[3px_3px_8px_rgba(0,0,0,0.1)] border ${
                  b.name === decodeURIComponent(brandName) ? "border-brand-yellow border-2" : "border-gray-200"
                }`}>
                  {isImageUrl(b.image_url) ? (
                    <Image
                      src={getImageUrl(b.image_url)}
                      alt={b.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center p-1">
                      <span className="text-[8px] font-bold text-gray-700 text-center leading-tight">{b.name}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Заголовок бренда + кнопка категории */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brand && isImageUrl(brand.image_url) && (
              <div className="w-12 h-12 relative bg-gray-50 rounded-lg overflow-hidden shrink-0">
                <Image src={getImageUrl(brand.image_url)} alt={brand.name} fill className="object-contain p-1" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">{decodeURIComponent(brandName)}</h1>
              {brand?.country && <p className="text-xs text-gray-500">{brand.country}</p>}
            </div>
          </div>

          {/* Dropdown категорий */}
          {categories.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory ? "bg-brand-yellow text-black" : "bg-gray-100 text-gray-700"
                }`}
              >
                <span className="max-w-[100px] truncate">{selectedCategoryName}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {categoryDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[14rem] max-w-[90vw] w-max bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedCategory(null); setPage(1); setCategoryDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                        !selectedCategory ? "bg-brand-yellow text-black" : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      Все категории
                    </button>
                    {categories.map((cat: any) => (
                      <button
                        key={cat.id}
                        onClick={() => { setSelectedCategory(cat.id); setPage(1); setCategoryDropdownOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors border-t border-gray-50 ${
                          selectedCategory === cat.id ? "bg-brand-yellow text-black" : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {cat.name} <span className="text-gray-400">({cat.product_count || 0})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Товары */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          {products.map((product: any) => (
            <MobileProductCard key={product.id} product={product} wholesaleUser={wholesaleUser} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 text-sm">Товары не найдены</div>
      )}

      {/* Показать ещё */}
      {page < totalPages && !loading && (
        <div className="flex justify-center px-4 py-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full max-w-xs h-10 rounded-xl font-medium"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {loadingMore ? "Загрузка..." : "Показать ещё"}
          </Button>
        </div>
      )}

      {/* Кнопка наверх */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 z-40 w-10 h-10 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center"
        >
          <ChevronUp className="h-5 w-5 text-black" />
        </button>
      )}
    </div>
  )
}
