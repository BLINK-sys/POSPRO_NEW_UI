"use client"

import { useEffect, useMemo, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import MobileBrandsPage from "@/components/mobile/mobile-brands-page"
import { Loader2, Search, X } from "lucide-react"
import { getAllBrands, type AllBrandsData } from "@/app/actions/public"
import { BrandCard } from "@/components/brand-card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function DesktopBrandsPage() {
  const [brands, setBrands] = useState<AllBrandsData[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getAllBrands()
      .then((data) => { if (!ignore) setBrands(data || []) })
      .catch((err) => console.error("Error loading brands:", err))
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  // Уникальные страны из брендов (только непустые), отсортированные.
  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const b of brands) {
      if (b.country && b.country.trim()) set.add(b.country.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"))
  }, [brands])

  // Фильтрация по стране + подстроке в name/country/description.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return brands.filter((b) => {
      if (selectedCountry && (b.country || "").trim() !== selectedCountry) return false
      if (!q) return true
      return (
        b.name.toLowerCase().includes(q) ||
        (b.country || "").toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q)
      )
    })
  }, [brands, query, selectedCountry])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const chipCls = (active: boolean) => cn(
    "whitespace-nowrap px-2.5 py-1 text-[11px] rounded-full transition-colors border cursor-pointer",
    active
      ? "bg-brand-yellow text-black border-brand-yellow shadow-sm font-medium"
      : "bg-white text-gray-700 border-gray-200 hover:bg-yellow-50 hover:border-yellow-200 hover:text-black",
  )

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Все бренды</h1>

      {/* Поиск + фильтр по странам в 2 колонки */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,320px)_1fr] gap-4 mb-6 items-start">
        {/* Поиск (без focus-ring) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по наименованию"
            className="pl-9 pr-9 h-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Фильтр по странам */}
        {countries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCountry(null)}
              className={chipCls(selectedCountry === null)}
            >
              Все страны
            </button>
            {countries.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCountry(c)}
                className={chipCls(selectedCountry === c)}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filtered.map((brand) => (
            <BrandCard key={brand.id} brand={brand as any} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 text-sm">
          Ничего не найдено
        </div>
      )}
    </div>
  )
}

export default function BrandsPage() {
  const isMobile = useIsMobile()

  if (isMobile === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return isMobile ? <MobileBrandsPage /> : <DesktopBrandsPage />
}
