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
import { ProductCard } from "@/components/product-card"
import { CategoryCard } from "@/components/category-card"
import { BrandCard } from "@/components/brand-card"
import CategoryFilter from "@/components/category-filter"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"

interface HomepageBlockComponentProps {
  block: HomepageBlock
  isFirstBlock?: boolean
  isLastBlock?: boolean
  hasSlideCatalog?: boolean
}

export default function HomepageBlockComponent({
  block,
  isFirstBlock = false,
  isLastBlock = false,
  hasSlideCatalog = false,
}: HomepageBlockComponentProps) {
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
          <div>
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
        <div>
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

    // Для брендов — сетка + кнопка «Все бренды» под ней (страница /brands
    // — единственное место с полным списком: в нижнем каталоге и десктопной
    // шапке отдельного пункта на неё нет). Обрабатываем ДО ветки carusel,
    // чтобы кнопка была видна независимо от режима (в БД `carusel:false`).
    if (block.type === 'brand' || block.type === 'brands') {
      return (
        <div>
          {renderGrid()}
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              size="sm"
              className="text-sm px-6 py-2 bg-white hover:bg-gray-50 shadow-md"
              asChild
            >
              <Link href="/brands">Все бренды</Link>
            </Button>
          </div>
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
      // Адаптивное количество карточек в зависимости от ширины экрана.
      // Карточки теперь узкие (aspect-[3/2] картинка) — в ряду помещается
      // больше, поэтому увеличили на 2 по каждой брекпоинте.
      const getItemsPerView = () => {
        if (typeof window === 'undefined') return 6 // по умолчанию для SSR
        const width = window.innerWidth
        if (width < 640) return 2       // мобильные
        if (width < 1024) return 3      // планшеты
        if (width < 1280) return 4      // десктопы
        if (width < 1536) return 5      // большие
        return 6                        // очень большие
      }
      const itemsPerView = typeof window === 'undefined' ? 6 : getItemsPerView()
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-12">
            {currentItems.map((item, index) => (
              <div key={item.id || index}>
                {renderItem(item)}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Для остальных типов - стандартная логика. 6 карточек в ряд с
    // тонким gap — карточки теперь узкие (aspect-[3/2] картинка), в ряду
    // помещается больше.
    const itemsPerView = 6
    const maxIndex = Math.max(0, block.items.length - itemsPerView)
    const currentItems = block.items.slice(currentIndex, currentIndex + itemsPerView)

    return (
      <div className="relative overflow-hidden">
        <div className="py-6 px-8">
          <div className="flex gap-3 overflow-visible">
            {currentItems.map((item, index) => (
              <div key={item.id || index} className="flex-shrink-0 w-1/6">
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

          {/* Карточки с зацикливанием. Обёртка задаёт фикс-ширину (w-56)
              и высоту (h-64) — Card внутри теперь w-full/h-full, поэтому
              без явных размеров у обёртки карточки в flex-row получались
              разного размера. */}
          {Array.from({ length: 3 }, (_, repeatIndex) =>
            block.items.map((_, itemIndex) => {
              const actualIndex = (currentIndex + itemIndex) % totalItems
              const categoryItem = block.items[actualIndex]
              return (
                <div key={`${categoryItem.id}-${repeatIndex}-${itemIndex}`} className="flex-shrink-0 w-56 h-64">
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
    // Для категорий — плотная сетка. Card внутри h-full, поэтому обёртка
    // задаёт высоту (h-64) — все карточки в grid одинакового размера.
    if (block.type === 'category' || block.type === 'categories') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index} className="h-64">
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для брендов — плотная сетка как у категорий (те же breakpoints/gap)
    if (block.type === 'brand' || block.type === 'brands') {
      const itemsCount = itemsToRender.length

      // Если карточек мало — центрируем; ширина ячейки в 2 раза меньше
      // чем раньше (128px lg вместо 176), под размеры карточек категорий.
      if (itemsCount < 6) {
        return (
          <div className="flex flex-wrap justify-center gap-3">
            {itemsToRender.map((item, index) => (
              <div key={item.id || index} className="w-24 sm:w-28 md:w-32">
                {renderItem(item)}
              </div>
            ))}
          </div>
        )
      }

      // 6+ карточек — те же колонки/gap, что у категорий
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для преимуществ — плотная сетка, карточки в 2 раза меньше прежних.
    // Card w-full h-full, обёртка задаёт высоту h-40 (равные размеры).
    if (block.type === 'benefit' || block.type === 'benefits') {
      const itemsCount = itemsToRender.length

      if (itemsCount < 6) {
        return (
          <div className="flex flex-wrap justify-center gap-3">
            {itemsToRender.map((item, index) => (
              <div key={item.id || index} className="w-40 sm:w-44 md:w-52 h-52">
                {renderItem(item)}
              </div>
            ))}
          </div>
        )
      }

      return (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index} className="h-52">
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

    // Для товаров - плотная сетка (в соответствии с новой компактной карточкой)
    if (block.type === 'product' || block.type === 'products') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 py-4">
          {itemsToRender.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для остальных типов - стандартная сетка (более плотная для товаров)
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
    <CategoryCard category={category} />
  )

  // Рендер товара
  const renderProductItem = (product: ProductData) => (
    <ProductCard product={product} />
  )

  // Рендер бренда
  const renderBrandItem = (brand: BrandData) => (
    <BrandCard brand={brand} />
  )

  // Рендер преимущества — центрированная карточка
  const renderBenefitItem = (benefit: BenefitData) => (
    <Card className="group relative hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-300 overflow-hidden bg-white rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] w-full h-full">
      <CardContent className="p-4 h-full flex flex-col items-center text-center gap-2.5">
        {/* Иконка по центру */}
        <div className="w-11 h-11 bg-brand-yellow rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
          {getIcon(benefit.icon)}
        </div>

        {/* Заголовок */}
        <h3 className="font-bold text-sm leading-tight text-gray-900">{benefit.title}</h3>

        {/* Описание — растёт вниз */}
        <p className="text-gray-600 text-xs leading-snug flex-1 line-clamp-5">
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

  // Первому блоку доп top-padding, если сверху висит кнопка «Каталог»
  // от slide-панели (она торчит из-под шапки на BUTTON_HEIGHT=28 и наезжает
  // на первый блок иначе).
  const topPad = isFirstBlock && hasSlideCatalog ? "pt-12" : "pt-4"

  return (
    <section ref={blockRef} className={`${topPad} pb-4`}>
      <div className="container mx-auto px-4 md:px-6">
        {block.show_title && (
          <div className={`mb-6 ${getTitleAlignment()}`}>
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
          <div className="w-full h-px bg-gray-200 mt-6"></div>
        </div>
      )}
    </section>
  )
} 