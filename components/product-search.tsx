"use client"

import React, { useState, useEffect, useRef } from "react"
import { Search, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ProductData, getAllProducts, searchProducts } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"

interface ProductSearchProps {
  className?: string
  placeholder?: string
}

export default function ProductSearch({ 
  className, 
  placeholder = "Я ищу..." 
}: ProductSearchProps) {
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<ProductData[]>([])
  const [allProducts, setAllProducts] = useState<ProductData[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoadingAll, setIsLoadingAll] = useState(true)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Загружаем все товары при монтировании компонента
  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        setIsLoadingAll(true)
        const data = await getAllProducts()
        setAllProducts(data)
      } catch (error) {
        console.error("Error loading all products:", error)
      } finally {
        setIsLoadingAll(false)
      }
    }
    loadAllProducts()
  }, [])

  // Фильтруем товары локально при вводе текста
  useEffect(() => {
    if (!query.trim()) {
      setFilteredProducts([])
      setShowDropdown(false)
      return
    }

    const filtered = allProducts.filter(product =>
      product.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10) // Ограничиваем до 10 результатов

    setFilteredProducts(filtered)
    setShowDropdown(filtered.length > 0)
  }, [query, allProducts])

  // Поиск через API (для более точного поиска)
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.trim().length >= 2) {
        try {
          setIsLoading(true)
          const searchResults = await searchProducts(query)
          setProducts(searchResults)
          setFilteredProducts(searchResults)
          setShowDropdown(searchResults.length > 0)
        } catch (error) {
          console.error("Error searching products:", error)
          // При ошибке API используем локальный поиск
        } finally {
          setIsLoading(false)
        }
      }
    }, 300) // Задержка 300мс для избежания частых запросов

    return () => clearTimeout(searchTimeout)
  }, [query])

  // Закрываем выпадающий список при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        // Восстанавливаем скролл при закрытии панели
        document.body.style.overflow = 'auto'
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      // Восстанавливаем скролл при размонтировании
      document.body.style.overflow = 'auto'
    }
  }, [])

  // Восстанавливаем скролл при закрытии панели
  useEffect(() => {
    if (!showDropdown) {
      document.body.style.overflow = 'auto'
    }
  }, [showDropdown])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }



  const handleProductClick = () => {
    setShowDropdown(false)
    setQuery("")
  }

  // Функция для получения URL изображения
  const getImageUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") {
      return "/placeholder.svg"
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    if (url.startsWith("/uploads/")) {
      return `${API_BASE_URL}${url}`
    }
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0
    }).format(price)
  }

  return (
    <div ref={searchRef} className={cn("relative w-full", className)}>
      <div className="relative">
                 <Input
           ref={inputRef}
           type="text"
           placeholder={placeholder}
           value={query}
           onChange={handleInputChange}
           className="w-full pl-10 pr-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-brand-yellow focus:outline-none focus:shadow-none shadow-md hover:shadow-lg transition-shadow duration-200"
           onFocus={() => {
             if (filteredProducts.length > 0) {
               setShowDropdown(true)
             }
           }}
           style={{ 
             WebkitAppearance: 'none', 
             MozAppearance: 'none', 
             appearance: 'none',
             outline: 'none',
             border: '1px solid #d1d5db',
             boxShadow: 'none'
           }}
         />
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
         {query && (
           <Button
             variant="ghost"
             size="icon"
             className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
             onClick={() => {
               setQuery("")
               setShowDropdown(false)
               inputRef.current?.focus()
             }}
           >
             <X className="h-4 w-4" />
           </Button>
         )}
         {isLoading && (
           <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
         )}
      </div>

      {/* Выпадающий список результатов */}
      {showDropdown && (
        <Card 
          className="absolute top-full left-0 mt-1 z-50 h-[50vh] overflow-y-auto shadow-lg border-gray-200 w-max min-w-full max-w-[90vw] sm:max-w-[600px]"
          onMouseEnter={(e) => {
            // Блокируем скролл основной страницы при наведении на панель
            document.body.style.overflow = 'hidden'
          }}
          onMouseLeave={(e) => {
            // Разблокируем скролл основной страницы при уходе курсора
            document.body.style.overflow = 'auto'
          }}
        >
          <CardContent className="p-0">
            {isLoadingAll ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Загрузка товаров...</span>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-16 text-xs font-medium text-gray-600 whitespace-nowrap">Фото</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap min-w-[150px]">Название</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap min-w-[80px]">Бренд</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 text-right whitespace-nowrap min-w-[100px]">Цена</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-2">
                          <Link
                            href={`/product/${product.slug}`}
                            onClick={handleProductClick}
                            className="block"
                          >
                            <div className="w-16 h-16 relative rounded-md overflow-hidden border border-gray-200 flex-shrink-0 shadow-md">
                              <Image
                                src={getImageUrl(product.image_url)}
                                alt={product.name}
                                fill
                                className="object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = "/placeholder.svg"
                                }}
                              />
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="py-2">
                          <Link
                            href={`/product/${product.slug}`}
                            onClick={handleProductClick}
                            className="block"
                          >
                            <h4 className="text-sm font-medium text-gray-900 hover:text-brand-yellow transition-colors break-words">
                              {product.name}
                            </h4>
                          </Link>
                        </TableCell>
                        <TableCell className="py-2">
                           {product.brand_info ? (
                             <Link
                               href={`/brand/${encodeURIComponent(product.brand_info.name)}`}
                               onClick={handleProductClick}
                               className="block"
                             >
                               <span className="inline-block px-2 py-1 text-xs bg-gray-100 hover:bg-brand-yellow text-gray-700 hover:text-black rounded-md shadow-md hover:shadow-lg transition-all duration-200 break-words">
                                 {product.brand_info.name}
                               </span>
                             </Link>
                           ) : (
                             <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-md shadow-sm">
                               -
                             </span>
                           )}
                         </TableCell>

                        <TableCell className="py-2 text-right">
                          <Link
                            href={`/product/${product.slug}`}
                            onClick={handleProductClick}
                            className="block"
                          >
                            <p className="text-sm font-semibold text-green-600 whitespace-nowrap">
                              {formatPrice(product.price)}
                            </p>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
