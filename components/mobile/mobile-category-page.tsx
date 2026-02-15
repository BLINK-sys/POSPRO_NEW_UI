"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, SlidersHorizontal, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCategoryData } from "@/app/actions/public"
import { getImageUrl, isImageUrl } from "@/lib/image-utils"
import { isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import MobileProductCard from "./mobile-product-card"
import MobileFilterSheet from "./mobile-filter-sheet"

interface MobileCategoryPageProps {
  slug: string
}

export default function MobileCategoryPage({ slug }: MobileCategoryPageProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  const [category, setCategory] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBrand, setSelectedBrand] = useState("all")
  const [sortBy, setSortBy] = useState("default")
  const [filterOpen, setFilterOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Initial load & filter/sort change (reset products)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setPage(1)
      try {
        const data = await getCategoryData(slug, {
          page: 1,
          perPage: 20,
          search: searchQuery || undefined,
          brand: selectedBrand !== "all" ? selectedBrand : undefined,
          sort: sortBy !== "default" ? sortBy : undefined,
        })
        setCategory(data.category)
        setProducts(data.products || [])
        setSubcategories(data.children || [])
        setBrands(data.brands || [])
        setTotalPages(data.pagination?.total_pages || 1)
        setTotalCount(data.pagination?.total_count || data.products?.length || 0)
      } catch (error) {
        console.error("Error loading category:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, searchQuery, selectedBrand, sortBy])

  // Load more products
  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const data = await getCategoryData(slug, {
        page: nextPage,
        perPage: 20,
        search: searchQuery || undefined,
        brand: selectedBrand !== "all" ? selectedBrand : undefined,
        sort: sortBy !== "default" ? sortBy : undefined,
      })
      setProducts(prev => [...prev, ...(data.products || [])])
      setPage(nextPage)
      setTotalPages(data.pagination?.total_pages || 1)
    } catch (error) {
      console.error("Error loading more:", error)
    } finally {
      setLoadingMore(false)
    }
  }, [slug, searchQuery, selectedBrand, sortBy, page, totalPages, loadingMore])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const sortOptions = [
    { value: "default", label: "По умолчанию" },
    { value: "price_asc", label: "Цена: по возрастанию" },
    { value: "price_desc", label: "Цена: по убыванию" },
    { value: "name_asc", label: "Название: А-Я" },
    { value: "name_desc", label: "Название: Я-А" },
  ]

  const brandOptions = brands.map((b: any) => ({
    value: String(b.id || b.name),
    label: b.name,
  }))

  if (loading && !category) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-4">
      {/* Заголовок категории */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold">{category?.name || "Категория"}</h1>
        {category?.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{category.description}</p>
        )}
      </div>

      {/* Подкатегории */}
      {subcategories.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-4 py-3 border-b border-gray-100 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {subcategories.map((sub: any) => (
            <Link key={sub.id} href={`/category/${sub.slug}`} className="shrink-0 w-[130px]">
              <Card className="overflow-hidden border-0 shadow-md h-full flex flex-col">
                <CardContent className="p-0 flex flex-col flex-1">
                  <div className="relative h-24 bg-white flex items-center justify-center overflow-hidden">
                    {isImageUrl(sub.image_url) ? (
                      <Image
                        src={getImageUrl(sub.image_url)}
                        alt={sub.name}
                        fill
                        className="object-contain p-2"
                      />
                    ) : (
                      <span className="text-2xl">📁</span>
                    )}
                  </div>
                  <div className="bg-brand-yellow px-2 py-2 mt-auto">
                    <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight text-center">
                      {sub.name}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Кнопка фильтров + счётчик */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {totalCount > 0 ? `Найдено: ${totalCount}` : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Фильтры
        </Button>
      </div>

      {/* Сетка товаров */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 px-4">
          {products.map((product: any) => (
            <MobileProductCard
              key={product.id}
              product={product}
              wholesaleUser={wholesaleUser}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 text-sm">
          Товары не найдены
        </div>
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
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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

      {/* Bottom sheet фильтры */}
      <MobileFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        brands={brandOptions}
        selectedBrand={selectedBrand}
        onBrandChange={setSelectedBrand}
        sortOptions={sortOptions}
        selectedSort={sortBy}
        onSortChange={setSortBy}
        onApply={() => { setPage(1) }}
        onReset={() => {
          setSearchQuery("")
          setSelectedBrand("all")
          setSortBy("default")
          setPage(1)
        }}
      />
    </div>
  )
}
