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
import { getIcon } from "@/lib/icon-mapping"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"

interface HomepageBlockComponentProps {
  block: HomepageBlock
}

export default function HomepageBlockComponent({ block }: HomepageBlockComponentProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [infiniteIndex, setInfiniteIndex] = useState(0)
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)

  // Автоматическое вращение карусели
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
    }

    // Запускаем автоматическое вращение для категорий в карусели
    if ((block.type === 'category' || block.type === 'categories') && 
        block.carusel && 
        block.items && 
        block.items.length > 6) { // Больше 6 элементов для показа карусели
      
      const totalItems = block.items.length
      // Задержка перед началом автоматического вращения
      setTimeout(() => {
        autoPlayRef.current = setInterval(() => {
          setInfiniteIndex((prev) => {
            const newIndex = prev + 1
            // Сбрасываем индекс каждые 1000 шагов для предотвращения проблем с производительностью
            if (newIndex >= 1000) {
              setTimeout(() => {
                setInfiniteIndex(0)
              }, 500)
              return 0
            }
            return newIndex
          })
          setCurrentIndex((prev) => (prev + 1) % totalItems)
        }, 5000) // 5 секунд
      }, 2000) // Задержка 2 секунды перед началом
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

  // Функция для форматирования цены
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0
    }).format(price)
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

    if (block.carusel) {
      return renderCarousel()
    }

    return renderGrid()
  }

  // Рендер карусели
  const renderCarousel = () => {
    // Для категорий используем специальную логику
    if (block.type === 'category' || block.type === 'categories') {
      return renderCategoryCarousel()
    }

    // Для преимуществ - карусель с одинаковыми размерами карточек
    if (block.type === 'benefit' || block.type === 'benefits') {
      const itemsPerView = 5 // Показываем 5 карточек за раз для преимуществ
      const maxIndex = Math.max(0, block.items.length - itemsPerView)
      const currentItems = block.items.slice(currentIndex, currentIndex + itemsPerView)

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
    const itemsPerView = 6 // Показываем 6 карточек за раз
    const totalItems = block.items.length
    
    if (totalItems === 0) return null

    // Вычисляем смещение для плавной анимации
    const getTransformValue = () => {
      if (totalItems <= 6) {
        return 0
      }
      
      // Вычисляем смещение в пикселях для бесконечного зацикливания
      // Каждая карточка имеет ширину 192px (h-48 w-48 = 12rem = 192px) + gap 16px = 208px
      const itemWidth = 208 // 192px (карточка) + 16px (gap)
      const offset = infiniteIndex * itemWidth
      
      return offset
    }

    const handlePrev = () => {
      if (totalItems <= 6) return
      setInfiniteIndex((prev) => {
        const newIndex = prev - 1
        // Сбрасываем индекс каждые 1000 шагов для предотвращения проблем с производительностью
        if (newIndex <= -1000) {
          setTimeout(() => {
            setInfiniteIndex(0)
          }, 500)
          return 0
        }
        return newIndex
      })
      setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems)
    }

    const handleNext = () => {
      if (totalItems <= 6) return
      setInfiniteIndex((prev) => {
        const newIndex = prev + 1
        // Сбрасываем индекс каждые 1000 шагов для предотвращения проблем с производительностью
        if (newIndex >= 1000) {
          setTimeout(() => {
            setInfiniteIndex(0)
          }, 500)
          return 0
        }
        return newIndex
      })
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
          block.items.length > 6) {
        const totalItems = block.items.length
        autoPlayRef.current = setInterval(() => {
          setInfiniteIndex((prev) => {
            const newIndex = prev + 1
            // Сбрасываем индекс каждые 1000 шагов для предотвращения проблем с производительностью
            if (newIndex >= 1000) {
              setTimeout(() => {
                setInfiniteIndex(0)
              }, 500)
              return 0
            }
            return newIndex
          })
          setCurrentIndex((prev) => (prev + 1) % totalItems)
        }, 3000)
      }
    }

    return (
      <div 
        className="relative px-4 md:px-12 overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Добавляем дополнительное пространство для увеличенных карточек */}
        <div className="py-6 px-8">
          <div className="overflow-visible">
            <div 
              className="flex gap-4 transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${getTransformValue()}px)`
              }}
            >
              {/* Создаём бесконечную ленту элементов */}
              {Array.from({ length: 50 }, (_, repeatIndex) => 
                block.items.map((item, itemIndex) => (
                  <div key={`${item.id}-${repeatIndex}-${itemIndex}`} className="flex-shrink-0">
                    {renderItem(item)}
                  </div>
                ))
              ).flat()}
            </div>
          </div>
        </div>
        
        {totalItems > 6 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-20 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full z-10 border border-gray-200 hover:shadow-xl transition-all duration-200 hidden md:flex"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4 text-gray-700" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-20 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full z-10 border border-gray-200 hover:shadow-xl transition-all duration-200 hidden md:flex"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4 text-gray-700" />
            </Button>
          </>
        )}
        

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
  const renderGrid = () => {
    // Для категорий используем специальную сетку
    if (block.type === 'category' || block.type === 'categories') {
      return (
        <div className="flex flex-wrap gap-4 justify-center">
          {block.items.map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )
    }

    // Для преимуществ - сетка с одинаковыми размерами карточек
    if (block.type === 'benefit' || block.type === 'benefits') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {block.items.map((item, index) => (
            <div key={item.id || index} className="h-48">
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
          {block.items.map((item, index) => (
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
        {block.items.map((item, index) => (
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
      <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-sm h-48 w-48 flex-shrink-0">
        <CardContent className="p-0">
          <div className="relative aspect-square">
            {category.image_url ? (
              <Image
                src={getImageUrl(category.image_url)}
                alt={category.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-300"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-100">
                <div className="text-2xl">📁</div>
              </div>
            )}
            {/* Полупрозрачная тёмная карточка с названием */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3">
              <h3 className="font-semibold text-white text-xs text-center">{category.name}</h3>
              {category.description && (
                <p className="text-white/80 text-xs mt-1 line-clamp-1 text-center">{category.description}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  // Рендер товара
  const renderProductItem = (product: ProductData) => (
    <Link href={`/product/${product.slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="group relative">
            {/* Изображение товара */}
            <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden mb-3">
              {product.image_url ? (
                <Image
                  src={getImageUrl(product.image_url)}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400 text-4xl">📦</div>
                </div>
              )}
              
              {/* Статус товара - верхний левый угол */}
              {product.status && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge 
                    className="text-xs px-2 py-1"
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
                  className="w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-md"
                  size="sm"
                />
              </div>
              
              {/* Панель с дополнительной информацией при наведении - только снизу */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="p-3 w-full">
                  {product.brand && (
                    <div className="text-xs text-white/90 mb-1">
                      <span className="font-medium">Бренд:</span> {product.brand.name}
                    </div>
                  )}
                  {product.brand?.country && (
                    <div className="text-xs text-white/90 mb-1">
                      <span className="font-medium">Страна:</span> {product.brand.country}
                    </div>
                  )}
                  <div className="text-xs text-white/90">
                    <span className="font-medium">Наличие:</span>{" "}
                    {product.availability_status ? (
                      <span
                        style={{
                          backgroundColor: product.availability_status.background_color,
                          color: product.availability_status.text_color,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px"
                        }}
                      >
                        {product.availability_status.status_name}
                      </span>
                    ) : (
                      <span>{product.quantity} шт.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Информация о товаре */}
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Товар:</span> {product.name}
              </div>
              
              {product.price && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Цена:</span> {product.price.toLocaleString()} тг
                </div>
              )}
              
              {/* Кнопка "Добавить в корзину" */}
              <AddToCartButton
                productId={product.id}
                productName={product.name}
                className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-4 rounded-lg"
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  // Рендер бренда
  const renderBrandItem = (brand: BrandData) => (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <Link href={`/brand/${encodeURIComponent(brand.name)}`}>
          <div className="relative aspect-square">
            <Image
              src={getImageUrl(brand.image_url)}
              alt={brand.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg">{brand.name}</h3>
            {brand.country && (
              <p className="text-gray-600 text-sm mt-1">{brand.country}</p>
            )}
            {brand.description && (
              <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                {brand.description}
              </p>
            )}
          </div>
        </Link>
      </CardContent>
    </Card>
  )

  // Рендер преимущества
  const renderBenefitItem = (benefit: BenefitData) => (
    <Card className="group relative h-48 text-center hover:shadow-lg transition-all duration-300 overflow-hidden">
      <CardContent className="p-6 h-full flex flex-col justify-center">
        {/* Основное содержимое */}
        <div className="transition-all duration-300 group-hover:opacity-0 group-hover:scale-90">
          <div className="w-16 h-16 mx-auto mb-4 bg-brand-yellow rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            {getIcon(benefit.icon)}
          </div>
          <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
        </div>
        
        {/* Описание при наведении */}
        <div className="absolute inset-0 flex items-center justify-center p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg">
            <p className="text-gray-700 text-sm leading-relaxed">
              {benefit.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Рендер малого баннера
  const renderSmallBannerItem = (banner: SmallBannerData) => (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow w-full"
      style={{ backgroundColor: banner.card_bg_color }}
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
            <h3 className="font-semibold text-2xl mb-4">{banner.title}</h3>
            <p className="text-lg text-muted-foreground mb-6">{banner.description}</p>
            {banner.show_button && banner.button_text && (
              <Button
                size="lg"
                style={{
                  backgroundColor: banner.button_bg_color,
                  color: banner.button_text_color
                }}
                asChild
              >
                <a href={banner.button_link || "#"}>
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
    <section className="py-12">
      <div className="container mx-auto px-4 md:px-6">
        {block.show_title && (
          <h2 className={`text-3xl font-bold mb-8 ${getTitleAlignment()}`}>
            {block.title}
          </h2>
        )}
        {renderItems()}
      </div>
    </section>
  )
} 