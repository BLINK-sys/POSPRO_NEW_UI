"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Функция для получения правильного URL изображения
const getImageUrl = (url: string | null | undefined): string => {
  if (!url || typeof url !== 'string' || url.trim() === "") {
    return "/placeholder.svg"
  }
  
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  
  if (url.startsWith("/uploads/")) {
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${url}`
  }
  
  return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${url.startsWith("/") ? url : `/${url}`}`
}

interface Banner {
  id: number
  title: string
  subtitle: string
  image: string
  button_text: string
  button_link: string
  show_button: boolean
  order: number
}

interface HomepageBannerProps {
  banners: Banner[]
}

export default function HomepageBanner({ banners }: HomepageBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isClient, setIsClient] = useState(false)

  // Проверяем, что мы на клиенте
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Автоматическое переключение каждые 5 секунд
  useEffect(() => {
    if (!isClient || !isAutoPlaying || !banners || banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isClient, isAutoPlaying, banners])

  if (!banners || banners.length === 0) {
    return null
  }

  // Показываем только первый баннер на сервере, чтобы избежать гидратации
  if (!isClient) {
    const firstBanner = banners[0]
    return (
      <section className="py-8 md:py-12">
        <div className="w-[90vw] mx-auto">
          <div className="relative">
            <Card 
              className="overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-300 w-full shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
            >
              <CardContent className="p-0">
                <div className="relative">
                  {firstBanner.image ? (
                    <div className="relative h-80 md:h-96 lg:h-[28rem] xl:h-[32rem]">
                      <Image
                        src={getImageUrl(firstBanner.image)}
                        alt={firstBanner.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Card className="bg-black/60 backdrop-blur-sm border-0 shadow-lg">
                          <CardContent className="p-6">
                            <div className="text-center text-white">
                              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                                {firstBanner.title}
                              </h2>
                              {firstBanner.subtitle && (
                                <p className="text-lg md:text-xl mb-6 max-w-2xl">
                                  {firstBanner.subtitle}
                                </p>
                              )}
                              {firstBanner.show_button && firstBanner.button_text && (
                                <Button
                                  size="lg"
                                  className="bg-brand-yellow text-black hover:bg-yellow-500"
                                  asChild
                                >
                                  <Link href={firstBanner.button_link || "#"}>
                                    {firstBanner.button_text}
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] bg-gray-100 flex items-center justify-center">
                      <Card className="bg-black/60 backdrop-blur-sm border-0 shadow-lg">
                        <CardContent className="p-6">
                          <div className="text-center text-white">
                            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                              {firstBanner.title}
                            </h2>
                            {firstBanner.subtitle && (
                              <p className="text-lg md:text-xl mb-6 max-w-2xl">
                                {firstBanner.subtitle}
                              </p>
                            )}
                            {firstBanner.show_button && firstBanner.button_text && (
                              <Button
                                size="lg"
                                className="bg-brand-yellow text-black hover:bg-yellow-500"
                                asChild
                              >
                                <Link href={firstBanner.button_link || "#"}>
                                  {firstBanner.button_text}
                                </Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    )
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
    setIsAutoPlaying(false)
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length)
    setIsAutoPlaying(false)
  }

  const currentBanner = banners[currentIndex]

  return (
    <section className="py-8 md:py-12">
      <div className="w-[90vw] mx-auto">
        <div className="relative">
          <Card 
            className="overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-300 w-full shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
          >
            <CardContent className="p-0">
                <div className="relative overflow-hidden">
                  <div 
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                  >
                    {banners.map((banner, index) => (
                      <div key={banner.id} className="w-full flex-shrink-0">
                        {banner.image ? (
                          <div className="relative h-80 md:h-96 lg:h-[28rem] xl:h-[32rem]">
                            <Image
                              src={getImageUrl(banner.image)}
                              alt={banner.title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Card className="bg-black/60 backdrop-blur-sm border-0 shadow-lg">
                                <CardContent className="p-6">
                                  <div className="text-center text-white">
                                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                                      {banner.title}
                                    </h2>
                                    {banner.subtitle && (
                                      <p className="text-lg md:text-xl mb-6 max-w-2xl">
                                        {banner.subtitle}
                                      </p>
                                    )}
                                    {banner.show_button && banner.button_text && (
                                      <Button
                                        size="lg"
                                        className="bg-brand-yellow text-black hover:bg-yellow-500"
                                        asChild
                                      >
                                        <Link href={banner.button_link || "#"}>
                                          {banner.button_text}
                                        </Link>
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        ) : (
                          <div className="h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] bg-gray-100 flex items-center justify-center">
                            <Card className="bg-black/60 backdrop-blur-sm border-0 shadow-lg">
                              <CardContent className="p-6">
                                <div className="text-center text-white">
                                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                                    {banner.title}
                                  </h2>
                                  {banner.subtitle && (
                                    <p className="text-lg md:text-xl mb-6 max-w-2xl">
                                      {banner.subtitle}
                                    </p>
                                  )}
                                  {banner.show_button && banner.button_text && (
                                    <Button
                                      size="lg"
                                      className="bg-brand-yellow text-black hover:bg-yellow-500"
                                      asChild
                                    >
                                      <Link href={banner.button_link || "#"}>
                                        {banner.button_text}
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                {/* Кнопки навигации - только если больше 1 баннера */}
                {banners.length > 1 && (
                  <>
                    <Button
                      onClick={goToPrevious}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-brand-yellow hover:bg-yellow-500 text-black shadow-[0_4px_12px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button
                      onClick={goToNext}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-brand-yellow hover:bg-yellow-500 text-black shadow-[0_4px_12px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </>
                )}

                {/* Индикаторы - только если больше 1 баннера */}
                {banners.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                    {banners.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentIndex(index)
                          setIsAutoPlaying(false)
                        }}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${
                          index === currentIndex
                            ? 'bg-brand-yellow shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
                            : 'bg-white/50 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
