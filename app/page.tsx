import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { getHomepageData } from "./actions/public"
import HomepageBlockComponent from "@/components/homepage-block"

import HomepageBanner from "@/components/homepage-banner"

// Компонент загрузки
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">Загрузка...</span>
    </div>
  )
}

// Компонент ошибки
function ErrorFallback() {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 mb-4">Не удалось загрузить данные</p>
      <Link href="/">
        <Button>
          Попробовать снова
        </Button>
      </Link>
    </div>
  )
}

// Компонент с данными
async function HomepageContent() {
  try {
    const data = await getHomepageData()
    
    // Отладочная информация
    console.log("Homepage data:", data)
    console.log("Banners count:", data.banners?.length || 0)
    console.log("Blocks count:", data.blocks?.length || 0)
    
    if (data.blocks) {
      data.blocks.forEach((block, index) => {
        console.log(`Block ${index}:`, {
          id: block.id,
          type: block.type,
          title: block.title,
          itemsCount: block.items?.length || 0,
          items: block.items
        })
      })
    }

    return (
      <div className="bg-white dark:bg-gray-950">
        {/* Баннеры */}
        <HomepageBanner banners={data.banners} />
        
        {/* Блоки контента */}
        {data.blocks && data.blocks.length > 0 ? (
          data.blocks.map((block, index) => (
            <HomepageBlockComponent 
              key={block.id} 
              block={block} 
              isLastBlock={index === data.blocks.length - 1}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Блоки не найдены</p>
            <p className="text-sm text-gray-400">Проверьте настройки в админ панели</p>
          </div>
        )}
        
        {/* Дефолтный блок если нет данных */}
        {(!data.blocks || data.blocks.length === 0) && (
          <section className="w-full py-12 md:py-24 lg:py-32">
            <div className="container px-4 md:px-6 text-center">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                Откройте для себя лучшие товары
              </h1>
              <p className="max-w-[600px] text-gray-500 md:text-xl mx-auto mt-4">
                Качественная электроника по доступным ценам. Быстрая доставка по всему Казахстану.
              </p>
              <div className="mt-6">
                <Link href="/auth">
                  <Button size="lg" className="bg-brand-yellow text-black hover:bg-yellow-500">
                    Начать покупки
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    )
  } catch (error) {
    console.error("Error loading homepage data:", error)
    return <ErrorFallback />
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HomepageContent />
    </Suspense>
  )
}
