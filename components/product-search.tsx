"use client"

import React, { useState, useEffect, useRef } from "react"
import { Search, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Image from "next/image"
import Link from "next/link"
import { cn, formatProductPrice, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { ProductData, searchProducts } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"
import { FavoriteButton } from "@/components/favorite-button"
import { useAuth } from "@/context/auth-context"

interface ProductSearchProps {
  className?: string
  placeholder?: string
}

export default function ProductSearch({ 
  className, 
  placeholder = "Я ищу..." 
}: ProductSearchProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  
  const [query, setQuery] = useState("")
  const [filteredProducts, setFilteredProducts] = useState<ProductData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [modalQuery, setModalQuery] = useState("")
  const [modalProducts, setModalProducts] = useState<ProductData[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalInputRef = useRef<HTMLInputElement>(null)

  // Поиск через API (для более точного поиска)
  useEffect(() => {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) {
      setFilteredProducts([])
      setShowDropdown(false)
      return
    }

    const searchTimeout = setTimeout(async () => {
      try {
        setIsLoading(true)
        setShowDropdown(true)
        const searchResults = await searchProducts(trimmedQuery)
        setFilteredProducts(searchResults)
        setShowDropdown(searchResults.length > 0)
      } catch (error) {
        console.error("Error searching products:", error)
        setFilteredProducts([])
        setShowDropdown(false)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  // Поиск для модального окна
  useEffect(() => {
    const trimmedQuery = modalQuery.trim()

    if (trimmedQuery.length < 2) {
      setModalProducts([])
      return
    }

    const searchTimeout = setTimeout(async () => {
      try {
        setModalLoading(true)
        const searchResults = await searchProducts(trimmedQuery)
        setModalProducts(searchResults)
      } catch (error) {
        console.error("Error searching products:", error)
        setModalProducts([])
      } finally {
        setModalLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [modalQuery])

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

  // Блокируем скролл при открытии модального окна
  useEffect(() => {
    if (showSearchModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [showSearchModal])

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


  return (
    <div ref={searchRef} className={cn("relative w-full", className)}>
      <div className="flex items-center gap-0">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            className="w-full pl-10 pr-10 rounded-l-full rounded-r-none border-r-0 border-gray-300 focus:border-brand-yellow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-md hover:shadow-lg transition-shadow duration-200"
            onFocus={(e) => {
              e.target.style.borderTop = '1px solid #facc15' // Желтая рамка при фокусе
              e.target.style.borderBottom = '1px solid #facc15'
              e.target.style.borderLeft = '1px solid #facc15'
              e.target.style.borderRight = 'none' // Убираем правую границу для соединения с кнопкой
              e.target.style.outline = 'none'
              // Тень управляется через классы Tailwind (shadow-md hover:shadow-lg)
              if (filteredProducts.length > 0) {
                setShowDropdown(true)
              }
            }}
            onBlur={(e) => {
              e.target.style.borderTop = '1px solid #d1d5db' // Серая рамка без фокуса
              e.target.style.borderBottom = '1px solid #d1d5db'
              e.target.style.borderLeft = '1px solid #d1d5db'
              e.target.style.borderRight = 'none' // Убираем правую границу для соединения с кнопкой
            }}
            style={{ 
              WebkitAppearance: 'none', 
              MozAppearance: 'none', 
              appearance: 'none',
              outline: 'none',
              border: '1px solid #d1d5db',
              borderRight: 'none' // Убираем правую границу для соединения с кнопкой
              // Тень управляется через классы Tailwind (shadow-md hover:shadow-lg)
            }}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
              onClick={() => {
                setQuery("")
                setShowDropdown(false)
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Кнопка открытия расширенного поиска */}
        <Button
          onClick={() => {
            setShowSearchModal(true)
            // Фокусируемся на поле поиска в модальном окне после открытия
            setTimeout(() => {
              modalInputRef.current?.focus()
            }, 100)
          }}
          className="h-10 w-10 p-0 rounded-l-none rounded-r-full border border-gray-300 border-l-0 bg-brand-yellow hover:bg-yellow-500 text-black shadow-md hover:shadow-lg transition-shadow duration-200 flex-shrink-0"
          title="Расширенный поиск"
        >
          <Search className="h-5 w-5" />
        </Button>
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
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Поиск товаров...</span>
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
                              {formatProductPrice(product.price)}
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

      {/* Модальное окно расширенного поиска */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          onClick={() => {
            setShowSearchModal(false)
            setModalQuery("")
            setModalProducts([])
          }}
        >
          <div
            className="relative flex flex-col w-[90vw] max-w-[1200px] h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onWheel={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок с полем поиска */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-6 pb-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="font-bold text-2xl text-gray-900">Поиск товаров</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 rounded-full"
                  onClick={() => {
                    setShowSearchModal(false)
                    setModalQuery("")
                    setModalProducts([])
                  }}
                  aria-label="Закрыть"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Поле поиска */}
              <div className="relative">
                <Input
                  ref={modalInputRef}
                  type="text"
                  placeholder={placeholder}
                  value={modalQuery}
                  onChange={(e) => setModalQuery(e.target.value)}
                  className="w-full pl-10 pr-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-0 focus:ring-offset-0 focus:outline-none"
                  onFocus={(e) => {
                    e.target.style.border = '1px solid #facc15' // Желтая рамка при фокусе
                    e.target.style.outline = 'none'
                    e.target.style.boxShadow = 'none'
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid #d1d5db' // Серая рамка без фокуса
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
                {modalQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                    onClick={() => {
                      setModalQuery("")
                      modalInputRef.current?.focus()
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Контент с карточками товаров */}
            <div className="flex-1 p-6 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
              {modalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span className="text-lg text-gray-500">Поиск товаров...</span>
                </div>
              ) : modalProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {modalProducts.map((product) => (
                    <div key={product.id} className="group">
                      <Link
                        href={`/product/${product.slug}`}
                        onClick={() => {
                          setShowSearchModal(false)
                          setModalQuery("")
                          setModalProducts([])
                        }}
                        className="block"
                      >
                        <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer group">
                          <CardContent className="p-0 h-full flex flex-col">
                            {/* Изображение товара */}
                            <div className="relative w-full h-48 bg-white flex items-center justify-center overflow-hidden">
                              <Image
                                src={getImageUrl(product.image_url)}
                                alt={product.name}
                                fill
                                className="object-contain group-hover:scale-110 transition-transform duration-300"
                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = "/placeholder.svg"
                                }}
                              />
                              
                              {/* Кнопка избранного - только для клиентов */}
                              {user && user.role === "client" && (
                                <div 
                                  className="absolute top-2 right-2 z-10"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                >
                                  <FavoriteButton
                                    productId={product.id}
                                    productName={product.name}
                                    className="w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md hover:shadow-lg"
                                    size="sm"
                                  />
                                </div>
                              )}
                            </div>
                            
                            {/* Информация о товаре */}
                            <div className="p-4 flex-1 flex flex-col">
                              <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 group-hover:text-brand-yellow transition-colors">
                                {product.name}
                              </h4>
                              
                              {/* Бренд с кнопкой перехода */}
                              {product.brand_info && (
                                <div className="mb-2">
                                  <span className="text-xs text-gray-600 mr-1">Бренд:</span>
                                  <Link
                                    href={`/brand/${encodeURIComponent(product.brand_info.name)}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowSearchModal(false)
                                      setModalQuery("")
                                      setModalProducts([])
                                    }}
                                    className="inline-block text-xs font-medium text-brand-yellow hover:text-yellow-600 hover:underline transition-colors"
                                  >
                                    {product.brand_info.name}
                                  </Link>
                                </div>
                              )}
                              
                              {/* Цены: Розница и Опт */}
                              <div className="mt-auto pt-2 space-y-1">
                                <div className={`text-sm font-bold ${getRetailPriceClass(product.price, wholesaleUser)}`}>
                                  <span className="text-xs font-normal text-gray-600 mr-1">Розница:</span>
                                  {formatProductPrice(product.price)}
                                </div>
                                
                                {wholesaleUser && (
                                  <div className={`text-sm font-bold ${getWholesalePriceClass()}`}>
                                    <span className="text-xs font-normal text-gray-600 mr-1">Опт:</span>
                                    {formatProductPrice(product.wholesale_price)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : modalQuery.trim() && !modalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <p className="text-gray-500 text-lg mb-2">Товары не найдены</p>
                    <p className="text-sm text-gray-400">Попробуйте изменить запрос</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Введите название товара для поиска</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
