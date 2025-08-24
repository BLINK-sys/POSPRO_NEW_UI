"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Banner } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"

interface HomepageBannerProps {
  banners: Banner[]
}

export default function HomepageBanner({ banners }: HomepageBannerProps) {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Получение URL изображения
  const getImageUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== "string" || url.trim() === "") return "/placeholder.svg"
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    if (url.startsWith("/uploads/")) return `${API_BASE_URL}${url}`
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  // Автоматическое переключение
  useEffect(() => {
    if (banners.length <= 1) return
    if (animating) return
    timeoutRef.current = setTimeout(() => handleNext(), 5000)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [current, animating, banners.length])

  // Смена баннера с анимацией
  const startAnimation = (to: number) => {
    if (animating || to === current) return
    setAnimating(true)
    setTimeout(() => {
      setCurrent(to)
      setAnimating(false)
    }, 500)
  }

  const handlePrev = () => {
    if (animating) return
    const to = (current - 1 + banners.length) % banners.length
    startAnimation(to)
  }

  const handleNext = () => {
    if (animating) return
    const to = (current + 1) % banners.length
    startAnimation(to)
  }

  const handleDot = (idx: number) => {
    if (animating || idx === current) return
    startAnimation(idx)
  }

  // Если нет баннеров
  if (!banners || banners.length === 0) return null

  return (
    <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden">
      {/* Контейнер для баннеров */}
      <div className="relative w-full h-full">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              index === current
                ? "opacity-100 translate-x-0"
                : index === (current + 1) % banners.length
                ? "opacity-0 translate-x-full"
                : index === (current - 1 + banners.length) % banners.length
                ? "opacity-0 -translate-x-full"
                : "opacity-0 translate-x-full"
            }`}
            style={{ pointerEvents: index === current ? "auto" : "none" }}
          >
            <Image
              src={getImageUrl(banner.image)}
              alt={banner.title}
              fill
              className="object-cover"
              priority={index === current}
            />
            
            {/* Контент баннера с темной полупрозрачной карточкой */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`bg-black/60 backdrop-blur-sm rounded-lg p-6 md:p-8 max-w-2xl mx-4 text-center text-white transition-all duration-500 ${
                index === current ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}>
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4">
                  {banner.title}
                </h1>
                {banner.subtitle && (
                  <p className="text-base md:text-lg lg:text-xl mb-6 opacity-90">
                    {banner.subtitle}
                  </p>
                )}
                {banner.show_button && banner.button_text && (
                  <Button 
                    size="lg" 
                    className="bg-brand-yellow text-black hover:bg-yellow-500 text-lg px-8 py-3 transition-all duration-300 hover:scale-105"
                    asChild
                  >
                    <a href={banner.button_link || "#"}>
                      {banner.button_text}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Навигация */}
      {banners.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className={`absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-300 hover:scale-110 ${
              animating ? "pointer-events-none opacity-50" : ""
            }`}
            onClick={handlePrev}
            disabled={animating}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className={`absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-300 hover:scale-110 ${
              animating ? "pointer-events-none opacity-50" : ""
            }`}
            onClick={handleNext}
            disabled={animating}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Индикаторы */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  idx === current ? "bg-white scale-110" : "bg-white/50 hover:bg-white/70"
                } ${animating ? "pointer-events-none" : ""}`}
                onClick={() => handleDot(idx)}
                disabled={animating}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
} 