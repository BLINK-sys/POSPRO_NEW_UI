"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Search, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn, formatProductPrice } from "@/lib/utils"
import type { ProductData } from "@/app/actions/public"
import { getApiUrl } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
interface ProductSearchProps {
  className?: string
  placeholder?: string
}

export default function ProductSearch({
  className,
  placeholder = "Я ищу..."
}: ProductSearchProps) {
  const router = useRouter()

  const [query, setQuery] = useState("")
  const [dropdownResults, setDropdownResults] = useState<ProductData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchingRef = useRef(false)

  // Dropdown: direct fetch with limit=50, debounce 300ms
  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      setDropdownResults([])
      setShowDropdown(false)
      return
    }
    const searchTimeout = setTimeout(async () => {
      if (searchingRef.current) return
      searchingRef.current = true
      try {
        setIsLoading(true)
        setShowDropdown(true)
        const response = await fetch(
          getApiUrl(`/products/search?q=${encodeURIComponent(trimmedQuery)}&limit=50`),
          { cache: "no-store" }
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const products = await response.json()
        const data: ProductData[] = products.map((product: any) => ({
          id: product.id, name: product.name, slug: product.slug,
          price: product.price, wholesale_price: product.wholesale_price,
          quantity: product.quantity,
          brand_id: product.brand_id ? Number(product.brand_id) : null,
          brand_info: product.brand_info,
          image_url: product.image,
        }))
        setDropdownResults(data)
        setShowDropdown(data.length > 0)
      } catch (error) {
        console.error("Dropdown search error:", error)
        setDropdownResults([])
        setShowDropdown(false)
      } finally {
        searchingRef.current = false
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(searchTimeout)
  }, [query])

  // Click outside → close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        document.body.style.overflow = 'auto'
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = 'auto'
    }
  }, [])

  useEffect(() => {
    if (!showDropdown) document.body.style.overflow = 'auto'
  }, [showDropdown])

  const handleProductClick = () => {
    setShowDropdown(false)
    setQuery("")
  }

  // Navigate to full search page
  const goToSearchPage = useCallback(() => {
    const trimmed = query.trim()
    if (trimmed.length >= 2) {
      setShowDropdown(false)
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }, [query, router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      goToSearchPage()
    }
  }

  return (
    <div ref={searchRef} className={cn("relative w-full", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-10 h-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-md hover:shadow-lg transition-shadow duration-200"
            onFocus={() => {
              if (dropdownResults.length > 0) setShowDropdown(true)
            }}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          {query && (
            <Button
              variant="ghost" size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
              onClick={() => { setQuery(""); setShowDropdown(false); setDropdownResults([]); inputRef.current?.focus() }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Кнопка перехода на страницу поиска */}
        <Button
          onClick={goToSearchPage}
          className="h-10 w-10 p-0 rounded-full bg-brand-yellow hover:bg-yellow-500 text-black shadow-md hover:shadow-lg transition-shadow duration-200 flex-shrink-0"
          title="Поиск"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {/* Dropdown — первые 50 совпадений */}
      {showDropdown && (
        <Card
          className="absolute top-full left-0 mt-1 z-50 max-h-[50vh] overflow-y-auto shadow-lg border-gray-200 w-full"
          onMouseEnter={() => { document.body.style.overflow = 'hidden' }}
          onMouseLeave={() => { document.body.style.overflow = 'auto' }}
        >
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Поиск товаров...</span>
              </div>
            ) : dropdownResults.length > 0 ? (
              <div className="w-full overflow-hidden">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-14 text-xs font-medium text-gray-600">Фото</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Название</TableHead>
                      <TableHead className="w-28 text-xs font-medium text-gray-600">Бренд</TableHead>
                      <TableHead className="w-24 text-xs font-medium text-gray-600 text-right">Цена</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dropdownResults.map((product) => (
                      <TableRow key={product.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-2">
                          <Link href={`/product/${product.slug}`} onClick={handleProductClick} className="block">
                            <div className="w-10 h-10 relative rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
                              <Image src={getImageUrl(product.image_url)} alt={product.name} fill className="object-contain" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="py-2">
                          <Link href={`/product/${product.slug}`} onClick={handleProductClick} className="block">
                            <h4 className="text-sm font-medium text-gray-900 hover:text-brand-yellow transition-colors truncate">{product.name}</h4>
                          </Link>
                        </TableCell>
                        <TableCell className="py-2">
                          {product.brand_info ? (
                            <Link href={`/brand/${encodeURIComponent(product.brand_info.name)}`} onClick={handleProductClick} className="block">
                              <span className="inline-block px-2 py-1 text-xs bg-gray-100 hover:bg-brand-yellow text-gray-700 hover:text-black rounded-md transition-all duration-200 truncate max-w-full">{product.brand_info.name}</span>
                            </Link>
                          ) : (
                            <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-md">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Link href={`/product/${product.slug}`} onClick={handleProductClick} className="block">
                            <p className="text-sm font-semibold text-green-600 whitespace-nowrap">{formatProductPrice(product.price)}</p>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Ссылка на полный поиск */}
                {dropdownResults.length >= 50 && (
                  <div className="border-t border-gray-100 p-3 text-center">
                    <button
                      onClick={goToSearchPage}
                      className="text-sm text-brand-yellow hover:text-yellow-600 font-medium transition-colors"
                    >
                      Показать все результаты →
                    </button>
                  </div>
                )}
              </div>
            ) : query.trim() && !isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm">Товары не найдены</p>
                <p className="text-xs mt-1">Попробуйте изменить запрос</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
