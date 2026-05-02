"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react"
import { HomepageBlock, ProductData, CategoryData, BrandData, BenefitData, SmallBannerData } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
import { getSuppliersText, getWinningWarehouseSuffix } from "@/lib/product-helpers"
import { getIcon } from "@/lib/icon-mapping"
import { useAuth } from "@/context/auth-context"
import { formatProductPrice, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"
import { QuickViewButton } from "@/components/quick-view-modal"
import CategoryFilter from "@/components/category-filter"

interface HomepageBlockComponentProps {
  block: HomepageBlock
  isLastBlock?: boolean
}

export default function HomepageBlockComponent({ block, isLastBlock = false }: HomepageBlockComponentProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [infiniteIndex, setInfiniteIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel')
  const [categoryViewMode, setCategoryViewMode] = useState<'carousel' | 'grid'>('carousel')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  const blockRef = useRef<HTMLElement | null>(null)
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const isSystemUser = user?.role === "admin" || user?.role === "system"

  // Автоматическое вращение карусели
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
    }


    // Запускаем автоматическое вращение для информационных карточек в карусели
    if ((block.type === 'small_banner' || block.type === 'small_banners' || block.type === 'info_cards') && 
        block.carusel && 
        block.items && 
        block.items.length > 1) {
      
      const totalItems = block.items.length
      // Задержка перед началом автоматического вращения
      setTimeout(() => {
        autoPlayRef.current = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % totalItems)
        }, 4000) // 4 секунды
      }, 2000) // Задержка 2 секунды перед началом
    }

    // Очистка при размонтировании
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
      }
    }
  }, [block.type, block.carusel, block.items])

  // Отладочная информация
  console.log("Rendering block:", {
    id: block.id,
    type: block.type,
    title: block.title,
    itemsCount: block.items?.length || 0,
    items: block.items
  })


  // Функция для извлечения уникальных категорий из товаров
  const getUniqueCategories = (products: ProductData[]): CategoryData[] => {
    if (!products || products.length === 0) return []
    
    const categoryMap = new Map<number, CategoryData>()
    
    products.forEach(product => {
      if (product.category_id && product.category) {
        categoryMap.set(product.category_id, product.category)
      }
    })
    
    return Array.from(categoryMap.values())
  }

  // Функция для фильтрации товаров по категории
  const getFilteredProducts = (products: ProductData[]): ProductData[] => {
    if (!selectedCategoryId) return products
    return products.filter(product => product.category_id === selectedCategoryId)
  }



  // Получение выравнивания заголовка
  const getTitleAlignment = () => {
    switch (block.title_align) {
      case 'center': return 'text-center'
      case 'right': return 'text-right'
      default: return 'text-left'
    }
  }

  // Рендер элементов в зависимости от типа блока
  const renderItems = () => {
    if (!block.items || block.items.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Элементы не найдены
        </div>
      )
    }

    // Для товаров добавляем общую карточку-контейнер
    if (block.type === 'product' || block.type === 'products') {
      const products = block.items as ProductData[]
      const uniqueCategories = getUniqueCategories(products)
      const filteredProducts = getFilteredProducts(products)
      
      // Если карусель включена - показываем с переключателем
      if (block.carusel) {
        return (
          <div className="py-12">
            <Card className="bg-gray-100 shadow-lg rounded-xl border-0 p-6">
              <CardContent className="p-0">
                {/* Фильтр категорий - только если есть категории */}
                {uniqueCategories.length > 0 && (
                  <div className="mb-6">
                    <CategoryFilter
                      categories={uniqueCategories}
                      selectedCategoryId={selectedCategoryId}
                      onCategorySelect={setSelectedCategoryId}
                      className="justify-start"
                    />
                  </div>
                )}
                
                {viewMode === 'carousel' ? renderCarousel(filteredProducts) : renderGrid(filteredProducts)}
                
                {/* Кнопка переключения режима просмотра */}
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewMode(viewMode === 'carousel' ? 'grid' : 'carousel')
                      // ✅ Прокрутка к началу блока товаров
                      if (blockRef.current) {
                        blockRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                    className="text-sm px-6 py-2 bg-white hover:bg-gray-50 shadow-md"
                  >
                    {viewMode === 'carousel' ? 'Смотреть весь товар' : 'Скрыть весь товар'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }
      
      // Если карусель выключена - показываем сразу сетку без кнопки
      return (
        <div className="py-12">
          <Card className="bg-gray-100 shadow-lg rounded-xl border-0 p-6">
            <CardContent className="p-0">
              {/* Фильтр категорий - только если есть категории */}
              {uniqueCategories.length > 0 && (
                <div className="mb-6">
                  <CategoryFilter
                    categories={uniqueCategories}
                    selectedCategoryId={selectedCategoryId}
                    onCategorySelect={setSelectedCategoryId}
                    className="justify-start"
                  />
                </div>
              )}
              
              {renderGrid(filteredProducts)}
            </CardContent>
          </Card>
        </div>
      )
    }

    if (block.carusel) {
      return renderCarousel()
    }

    return renderGrid()
  }

  // Рендер карусели
  const renderCarousel = (filteredItems?: any[]) => {
    const itemsToRender = filteredItems || block.items
    // Для категорий добавляем переключатель режима просмотра
    if (block.type === 'category' || block.type === 'categories') {
      return (
        <div>
          {categoryViewMode === 'carousel' ? renderCategoryCarousel() : renderGrid()}
          
          {/* Переключатель режима просмотра для категорий - под блоком по центру */}
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCategoryViewMode(categoryViewMode === 'carousel' ? 'grid' : 'carousel')
                // ✅ Прокрутка к началу блока категорий
                if (blockRef.current) {
                  blockRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
              className={`text-sm px-6 py-2 shadow-md transition-all duration-200 ${
                categoryViewMode === 'carousel' 
                  ? 'bg-white hover:bg-gray-50 text-gray-900 hover:text-gray-900' 
                  : 'bg-black hover:bg-gray-800 text-white hover:text-white'
              }`}
            >
              {categoryViewMode === 'carousel' ? 'Смотреть все категории' : 'Скрыть все категории'}
            </Button>
          </div>
        </div>
      )
    }

    // Для брендов всегда показываем сетку
    if (block.type === 'brand' || block.type === 'brands') {
      return renderGrid()
    }

    // Для преимуществ - карусель с одинаковыми размерами карточек
    if (block.type === 'benefit' || block.type === 'benefits') {
      const itemsPerView = 5 // Показываем 5 карточек за раз для преимуществ
      const maxIndex = Math.max(0, itemsToRender.length - itemsPerView)
      const currentItems = itemsToRender.slice(currentIndex, currentIndex + itemsPerView)

      return (
        <div className="relative overflow-hidden">
          <div className="py-6 px-8">
            <div className="flex gap-6 overflow-visible">
              {currentItems.map((item, index) => (
                <div key={item.id || index} className="flex-shrink-0 w-1/5 h-48">
                  {renderItem(item)}
                </div>
              ))}
            </div>
          </div>
          
          {block.items.length > itemsPerView && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute -left-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg rounded-full z-10"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg rounded-full z-10"
                onClick={() => setCurrentIndex(Math.min(maxIndex, currentIndex + 1))}
                disabled={currentIndex === maxIndex}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )
    }

    // Для информационных карточек - одна карточка на всю ширину
    if (block.type === 'small_banner' || block.type === 'small_banners' || block.type === 'info_cards') {
      return renderInfoCardsCarousel()
    }

    // Для товаров - улучшенная карусель с стрелочками
    if (block.type === 'product' || block.type === 'products') {
      // Адаптивное количество карточек в зависимости от ширины экрана
      const getItemsPerView = () => {
        // На сервере всегда возвращаем значение по умолчанию
        if (typeof window === 'undefined') {
          return 4 // по умолчанию для SSR
        }
        
        const width = window.innerWidth
        if (width < 640) return 1 // мобильные
        if (width < 1024) return 2 // планшеты
        if (width < 1280) return 3 // десктопы
        return 4 // большие экраны
      }
      
      // Используем статичное значение для SSR, чтобы избежать ошибок гидратации
      const itemsPerView = typeof window === 'undefined' ? 4 : getItemsPerView()
      const maxIndex = Math.max(0, itemsToRender.length - itemsPerView)
      const currentItems = itemsToRender.slice(currentIndex, currentIndex + itemsPerView)

      return (
        <div className="relative">
          {/* Кнопки навигации по краям */}
          {itemsToRender.length > itemsPerView && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute -left-4 top-1/2 -translate-y-1/2 bg-brand-yellow hover:bg-yellow-500 shadow-xl rounded-full border-0 hover:shadow-2xl transition-all duration-200 w-10 h-10 z-10"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 text-black" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-4 top-1/2 -translate-y-1/2 bg-brand-yellow hover:bg-yellow-500 shadow-xl rounded-full border-0 hover:shadow-2xl transition-all duration-200 w-10 h-10 z-10"
                onClick={() => setCurrentIndex(Math.min(maxIndex, currentIndex + 1))}
                disabled={currentIndex === maxIndex}
              >
                <ChevronRight className="h-4 w-4 text-black" />
              </Button>
            </>
          )}
          
          {/* Карточки товаров */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-12">
            {currentItems.map((item, index) => (
              <div key={item.id || index}>
                {renderItem(item)}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Для остальных типов - стандартная логика
    const itemsPerView = 4
    const maxIndex = Math.max(0, block.items.length - itemsPerView)
    const currentItems = block.items.slice(currentIndex, currentIndex + itemsPerView)

    return (
      <div className="relative overflow-hidden">
        {/* Добавляем дополнительное пространство для увеличенных карточек */}
        <div className="py-6 px-8">
          <div className="flex gap-4 overflow-visible">
            {currentItems.map((item, index) => (
              <div key={item.id || index} className="flex-shrink-0 w-1/4">
                {renderItem(item)}
              </div>
            ))}
          </div>
        </div>
        
        {block.items.length > itemsPerView && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg rounded-full z-10"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg rounded-full z-10"
              onClick={() => setCurrentIndex(Math.min(maxIndex, currentIndex + 1))}
              disabled={currentIndex === maxIndex}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    )
  }

  // Специальная карусель для категорий
  const renderCategoryCarousel = () => {
    const totalItems = block.items.length
    
    if (totalItems === 0) return null

    // Адаптивное количество карточек в зависимости от ширины экрана
    const getItemsPerView = () => {
      // На сервере всегда возвращаем значение по умолчанию
      if (typeof window === 'undefined') {
        return 4 // по умолчанию для SSR
      }
      
      const width = window.innerWidth
      if (width < 640) return 1 // мобильные
      if (width < 1024) return 2 // планшеты
      if (width < 1280) return 3 // десктопы
      if (width < 1536) return 4 // большие экраны
      return 5 // очень большие экраны
    }
    
    // Используем статичное значение для SSR, чтобы избежать ошибок гидратации
    const itemsPerView = typeof window === 'undefined' ? 4 : getItemsPerView()
    
    // Зацикливание: если карточек меньше чем помещается, показываем все
    if (totalItems <= itemsPerView) {
      return (
        <div className="py-6 px-8">
          <div className="flex gap-4 justify-center">
            {block.items.map((item, index) => (
              <div key={item.id || index} className="flex-shrink-0">
                {renderItem(item)}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Зацикливание для бесконечной прокрутки
    const handlePrev = () => {
      setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems)
    }

    const handleNext = () => {
      setCurrentIndex((prev) => (prev + 1) % totalItems)
    }

    // Обработчики для паузы/возобновления автоматического вращения
    const handleMouseEnter = () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
        autoPlayRef.current = null
      }
    }

    const handleMouseLeave = () => {
      if ((block.type === 'category' || block.type === 'categories') && 
          block.carusel && 
          block.items && 
          block.items.length > itemsPerView) {
        autoPlayRef.current = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % totalItems)
        }, 3000)
      }
    }

    return (
      <div 
        className="relative py-6 px-8"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex gap-4 justify-center relative">
          {/* Кнопки навигации внутри контейнера */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-brand-yellow hover:bg-yellow-500 shadow-xl rounded-full z-10 border-0 hover:shadow-2xl transition-all duration-200 w-10 h-10"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4 text-black" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-brand-yellow hover:bg-yellow-500 shadow-xl rounded-full z-10 border-0 hover:shadow-2xl transition-all duration-200 w-10 h-10"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4 text-black" />
          </Button>

          {/* Карточки с зацикливанием */}
          {Array.from({ length: 3 }, (_, repeatIndex) => 
            block.items.map((_, itemIndex) => {
              const actualIndex = (currentIndex + itemIndex) % totalItems
              const categoryItem = block.items[actualIndex]
              return (
                <div key={`${categoryItem.id}-${repeatIndex}-${itemIndex}`} className="flex-shrink-0">
                  {renderItem(categoryItem)}
                </div>
              )
            })
          ).flat().slice(0, itemsPerView)}
        </div>
      </div>
    )
  }


  // Специальная карусель для информационных карточек
  const renderInfoCardsCarousel = () => {
    const totalItems = block.items.length
    
    if (totalItems === 0) return null

    const currentItem = block.items[currentIndex]

    const handlePrev = () => {
      setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems)
    }

    const handleNext = () => {
      setCurrentIndex((prev) => (prev + 1) % totalItems)
    }

    // Обработчики для паузы/возобновления автоматического вращения
    const handleMouseEnter = () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
        autoPlayRef.current = null
      }
    }

    const handleMouseLeave = () => {
      if (totalItems > 1) {
        autoPlayRef.current = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % totalItems)
        }, 4000) // 4 секунды
      }
    }

    return (
      <div 
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full">
          {renderItem(currentItem)}
        </div>
        
        {totalItems > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full z-10 border border-gray-200 hover:shadow-xl transition-all duration-200"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4 text-gray-700" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full z-10 border border-gray-200 hover:shadow-xl transition-all duration-200"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4 text-gray-700" />
            </Button>
          </>
        )}
      </div>
    )
  }

  // Рендер сетки
  const renderGrid = (filteredItems?: any[]) => {
    const itemsToRender = filteredItems || block.items
    // Для категорий используем адаптивную сетку с максимумом 5 колонок
    if (block.type === 'category' || block.type === 'categories') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для брендов используем центрирование или сетку в зависимости от количества
    if (block.type === 'brand' || block.type === 'brands') {
      const itemsCount = itemsToRender.length
      
      // Если карточек меньше 6, центрируем их
      if (itemsCount < 6) {
        return (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-5">
            {itemsToRender.map((item, index) => (
              <div key={item.id || index} className="w-32 sm:w-36 md:w-40 lg:w-44 xl:w-48">
                {renderItem(item)}
              </div>
            ))}
          </div>
        )
      }
      
      // Если карточек 6 и более, используем сетку
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 lg:gap-5">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для преимуществ используем центрирование или сетку в зависимости от количества
    if (block.type === 'benefit' || block.type === 'benefits') {
      const itemsCount = itemsToRender.length
      
      // Если карточек меньше 6, центрируем их
      if (itemsCount < 6) {
        return (
          <div className="flex flex-wrap justify-center gap-4 sm:gap-5 md:gap-6">
            {itemsToRender.map((item, index) => (
              <div key={item.id || index} className="w-48 sm:w-52 md:w-56 lg:w-60 xl:w-64">
                {renderItem(item)}
              </div>
            ))}
          </div>
        )
      }
      
      // Если карточек 6 и более, используем сетку
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 md:gap-6">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для информационных карточек - вертикальная колонка
    if (block.type === 'small_banner' || block.type === 'small_banners' || block.type === 'info_cards') {
      return (
        <div className="space-y-6">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для товаров - улучшенная сетка
    if (block.type === 'product' || block.type === 'products') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 py-4">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для остальных типов - стандартная сетка
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {itemsToRender.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    )
  }

  // Рендер отдельного элемента
  const renderItem = (item: any) => {
    switch (block.type) {
      case 'category':
      case 'categories':
        return renderCategoryItem(item as CategoryData)
      case 'product':
      case 'products':
        return renderProductItem(item as ProductData)
      case 'brand':
      case 'brands':
        return renderBrandItem(item as BrandData)
      case 'benefit':
      case 'benefits':
        return renderBenefitItem(item as BenefitData)
      case 'small_banner':
      case 'small_banners':
      case 'info_cards':
        return renderSmallBannerItem(item as SmallBannerData)
      default:
        return null
    }
  }

  // Рендер категории
  const renderCategoryItem = (category: CategoryData) => (
    <Link href={`/category/${category.slug}`}>
      <Card className="group hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] h-64 w-56 flex-shrink-0 bg-white rounded-xl">
        <CardContent className="p-0 h-full flex flex-col">
          {/* Верхняя часть с изображением на белом фоне */}
          <div className="relative h-48 bg-white flex items-center justify-center rounded-t-xl overflow-hidden p-4">
            {category.image_url ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src={getImageUrl(category.image_url)}
                  alt={category.name}
                  fill
                  className="object-contain group-hover:scale-110 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            ) : (
              <div className="text-4xl text-gray-400">📁</div>
            )}
          </div>
          
          {/* Нижняя часть - ярко-желтый блок с названием и стрелкой */}
          <div className="relative bg-yellow-400 h-16 rounded-xl p-4 flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-sm leading-tight">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-gray-700 text-xs mt-1 line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>
            
            {/* Стрелка в правом верхнем углу желтого блока */}
            <div className="absolute top-0 right-0 w-8 h-8 bg-gray-900 rounded-tr-lg rounded-bl-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  // Рендер товара
  const renderProductItem = (product: ProductData) => (
    <div className="group">
      <Link href={`/product/${product.slug}`}>
        <Card className="hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer bg-white rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          <CardContent className="p-3">
            <div className="relative">
              {/* Изображение товара */}
              <div className="aspect-square relative bg-white rounded-lg overflow-hidden mb-3">
                {product.image_url ? (
                  <Image
                    src={getImageUrl(product.image_url)}
                    alt={product.name}
                    fill
                    className="object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-400 text-2xl">📦</div>
                  </div>
                )}
                
                {/* Статус товара - верхний левый угол */}
                {product.status && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge 
                      className="text-xs px-2 py-1 shadow-md"
                      style={{
                        backgroundColor: product.status.background_color,
                        color: product.status.text_color
                      }}
                    >
                      {product.status.name}
                    </Badge>
                  </div>
                )}
                
                {/* Кнопка "В избранное" - только при наведении */}
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

                {/* Панель с дополнительной информацией при наведении - только снизу */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="p-3 w-full">
                    {product.brand_info && (
                      <div className="text-xs text-white mb-1">
                        <span className="font-medium">Бренд:</span> {product.brand_info.name}
                      </div>
                    )}
                    {product.brand_info?.country && (
                      <div className="text-xs text-white mb-1">
                        <span className="font-medium">Страна:</span> {product.brand_info.country}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Информация о товаре */}
              <div className="space-y-2">
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
                
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Наличие:</span>{" "}
                  {product.availability_status ? (
                    <span
                      style={{
                        backgroundColor: product.availability_status.background_color,
                        color: product.availability_status.text_color,
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "12px"
                      }}
                    >
                      {product.availability_status.status_name}
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

                {/* Кнопка "Добавить в корзину" */}
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
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )

  // Рендер бренда
  const renderBrandItem = (brand: BrandData) => (
    <Link href={`/brand/${encodeURIComponent(brand.name)}`}>
      <Card className="group hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] aspect-square w-full bg-white rounded-xl">
        <CardContent className="p-0 h-full flex flex-col">
          {/* Квадратная карточка с изображением на всю площадь */}
          <div className="relative h-full bg-white rounded-xl overflow-hidden">
            {brand.image_url ? (
              <Image
                src={getImageUrl(brand.image_url)}
                alt={brand.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-4xl text-gray-400">🏢</div>
              </div>
            )}
          </div>
          
          {/* Анимация при наведении - показываем полную информацию */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center rounded-xl pointer-events-none">
            <div className="text-center text-white p-1 sm:p-2 md:p-3 h-full flex flex-col justify-center">
              <h3 className="font-bold text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg mb-0.5 sm:mb-1 leading-tight">{brand.name}</h3>
              {brand.country && (
                <p className="text-white/90 text-[9px] sm:text-xs mb-0.5 sm:mb-1 leading-tight">{brand.country}</p>
              )}
              {brand.description && (
                <p className="text-white/80 text-[8px] sm:text-xs leading-tight overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>
                  {brand.description}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  // Рендер преимущества
  const renderBenefitItem = (benefit: BenefitData) => (
    <Card className="group relative hover:shadow-2xl transition-all duration-300 overflow-hidden bg-white rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] h-60 w-60 flex-shrink-0">
      <CardContent className="p-4 h-full flex flex-col">
        {/* Иконка по центру */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-brand-yellow rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            {getIcon(benefit.icon)}
          </div>
        </div>
        
        {/* Заголовок жирным и прижат к левому краю с отступом */}
        <h3 className="font-bold text-sm mb-3 text-left leading-tight">{benefit.title}</h3>
        
        {/* Описание обычный текст прижат к левому краю с отступом */}
        <p className="text-gray-700 text-xs leading-relaxed text-left flex-1">
          {benefit.description}
        </p>
      </CardContent>
    </Card>
  )

  // Рендер малого баннера
  const renderSmallBannerItem = (banner: SmallBannerData) => (
    <Card 
      className="overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-300 w-full shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
      style={{ 
        backgroundColor: banner.background_image_url ? 'transparent' : banner.card_bg_color,
        backgroundImage: banner.background_image_url ? `url(${getImageUrl(banner.background_image_url)})` : 'none',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {banner.image_url && (
            <div className="w-full md:w-48 h-48 relative flex-shrink-0">
              <Image
                src={getImageUrl(banner.image_url)}
                alt={banner.title}
                fill
                className="object-contain"
              />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <h3 
              className="font-semibold text-2xl mb-4"
              style={{ color: banner.title_text_color || "#000000" }}
            >
              {banner.title}
            </h3>
            <p 
              className="text-lg mb-6 whitespace-pre-line"
              style={{ color: banner.description_text_color || "#666666" }}
            >
              {banner.description}
            </p>
            {banner.show_button && banner.button_text && (
              <Button
                size="lg"
                style={{
                  backgroundColor: banner.button_bg_color,
                  color: banner.button_text_color
                }}
                asChild
              >
                <a 
                  href={banner.button_link || "#"}
                  target={banner.open_in_new_tab ? "_blank" : "_self"}
                  rel={banner.open_in_new_tab ? "noopener noreferrer" : undefined}
                >
                  {banner.button_text}
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <section ref={blockRef} className="py-12">
      <div className="container mx-auto px-4 md:px-6">
        {block.show_title && (
          <div className={`${(block.type === 'product' || block.type === 'products') ? '' : 'mb-8'} ${getTitleAlignment()}`}>
            <h2 className="text-3xl font-bold">
              {block.title}
            </h2>
            {(block as any).description && (
              <p className="text-lg text-gray-600 mt-2 whitespace-pre-line">
                {(block as any).description}
              </p>
            )}
          </div>
        )}
        {renderItems()}
      </div>
      
      {/* Разделительная полоса - только если не последний блок */}
      {!isLastBlock && (
        <div className="container mx-auto px-4 md:px-6">
          <div className="w-full h-px bg-gray-200 mt-8"></div>
        </div>
      )}
    </section>
  )
} 