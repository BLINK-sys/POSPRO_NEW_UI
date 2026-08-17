"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getImageUrl } from "@/lib/image-utils"

interface Banner {
  id: number
  title: string
  subtitle: string
  image: string
  button_text: string
  button_link: string
  show_button: boolean
  open_in_new_tab?: boolean
  button_color?: string
  button_text_color?: string
  order: number
}

interface HomepageBannerProps {
  banners: Banner[]
  extraTop?: boolean
}

export default function HomepageBanner({ banners, extraTop = false }: HomepageBannerProps) {
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
      <section className={`${extraTop ? "pt-12" : "pt-4"} pb-4`}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative">
            <Card 
              className="overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-300 w-full shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
            >
              <CardContent className="p-0">
                <div className="relative">
                  {firstBanner.image ? (
                    <div className="relative w-full">
                      {/* Native img: ширина 100% контейнера, высота = auto
                          (сохраняет натуральную пропорцию картинки). */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageUrl(firstBanner.image)}
                        alt={firstBanner.title}
                        className="w-full h-auto block"
                      />
                      {(firstBanner.title || firstBanner.subtitle || (firstBanner.show_button && firstBanner.button_text)) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Card className="bg-black/60 backdrop-blur-sm border-0 shadow-lg">
                            <CardContent className="p-6">
                              <div className="text-center text-white">
                                {firstBanner.title && (
                                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                                    {firstBanner.title}
                                  </h2>
                                )}
                                {firstBanner.subtitle && (
                                  <p className="text-lg md:text-xl mb-6 max-w-2xl">
                                    {firstBanner.subtitle}
                                  </p>
                                )}
                                {firstBanner.show_button && firstBanner.button_text && (
                                  <Button
                                    size="lg"
                                    style={{
                                      backgroundColor: firstBanner.button_color || "#fbbf24",
                                      color: firstBanner.button_text_color || "#000000"
                                    }}
                                    asChild
                                  >
                                    <Link
                                      href={firstBanner.button_link || "#"}
                                      target={firstBanner.open_in_new_tab ? "_blank" : "_self"}
                                      rel={firstBanner.open_in_new_tab ? "noopener noreferrer" : undefined}
                                    >
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
                  ) : (
                    <div className="aspect-[16/5] min-h-[220px] bg-gray-100 flex items-center justify-center">
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
                                style={{
                                  backgroundColor: firstBanner.button_color || "#fbbf24",
                                  color: firstBanner.button_text_color || "#000000"
                                }}
                                asChild
                              >
                                <Link 
                                  href={firstBanner.button_link || "#"}
                                  target={firstBanner.open_in_new_tab ? "_blank" : "_self"}
                                  rel={firstBanner.open_in_new_tab ? "noopener noreferrer" : undefined}
                                >
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
    <section className={`${extraTop ? "pt-12" : "pt-4"} pb-4`}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="relative">
          <Card
            className="group overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-300 w-full shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
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
                          <div className="relative w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getImageUrl(banner.image)}
                              alt={banner.title}
                              className="w-full h-auto block"
                            />
                            {(banner.title || banner.subtitle || (banner.show_button && banner.button_text)) && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Card className="bg-black/60 backdrop-blur-sm border-0 shadow-lg">
                                  <CardContent className="p-6">
                                    <div className="text-center text-white">
                                      {banner.title && (
                                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                                          {banner.title}
                                        </h2>
                                      )}
                                      {banner.subtitle && (
                                        <p className="text-lg md:text-xl mb-6 max-w-2xl">
                                          {banner.subtitle}
                                        </p>
                                      )}
                                      {banner.show_button && banner.button_text && (
                                        <Button
                                          size="lg"
                                          style={{
                                            backgroundColor: banner.button_color || "#fbbf24",
                                            color: banner.button_text_color || "#000000"
                                          }}
                                          asChild
                                        >
                                          <Link
                                            href={banner.button_link || "#"}
                                            target={banner.open_in_new_tab ? "_blank" : "_self"}
                                            rel={banner.open_in_new_tab ? "noopener noreferrer" : undefined}
                                          >
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
                        ) : (
                          <div className="aspect-[16/5] min-h-[220px] bg-gray-100 flex items-center justify-center">
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
                                      style={{
                                        backgroundColor: banner.button_color || "#fbbf24",
                                        color: banner.button_text_color || "#000000"
                                      }}
                                      asChild
                                    >
                                      <Link 
                                        href={banner.button_link || "#"}
                                        target={banner.open_in_new_tab ? "_blank" : "_self"}
                                        rel={banner.open_in_new_tab ? "noopener noreferrer" : undefined}
                                      >
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

                {/* Кнопки навигации — прямоугольные, прижаты к краям,
                    скруглены только с внутренней стороны. Появляются при
                    hover на баннере (group), полупрозрачные жёлтые. */}
                {banners.length > 1 && (
                  <>
                    <Button
                      onClick={goToPrevious}
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-20 p-0 rounded-none rounded-r-lg bg-brand-yellow/70 hover:bg-brand-yellow text-black shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button
                      onClick={goToNext}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-20 p-0 rounded-none rounded-l-lg bg-brand-yellow/70 hover:bg-brand-yellow text-black shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100"
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
