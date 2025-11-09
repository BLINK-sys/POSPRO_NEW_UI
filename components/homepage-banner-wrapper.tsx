"use client"

import { useCatalogPanel } from "@/context/catalog-panel-context"
import { getCatalogCategories, CategoryData } from "@/app/actions/public"
import { useEffect, useState } from "react"
import HomepageBanner from "./homepage-banner"
import CatalogPanel from "./catalog-panel"
import { Loader2 } from "lucide-react"

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

interface HomepageBannerWrapperProps {
  banners: Banner[]
}

export default function HomepageBannerWrapper({ banners }: HomepageBannerWrapperProps) {
  const { isCatalogPanelOpen } = useCatalogPanel()
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true)
        const data = await getCatalogCategories()
        setCategories(data)
      } catch (error) {
        console.error("Error loading categories:", error)
        setCategories([])
      } finally {
        setCategoriesLoading(false)
      }
    }
    loadCategories()
  }, [])

  // Если панель каталога открыта, показываем её вместо баннера
  if (isCatalogPanelOpen) {
    if (categoriesLoading) {
      return (
        <section className="py-8 md:py-12 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Загрузка категорий...</span>
            </div>
          </div>
        </section>
      )
    }
    return <CatalogPanel categories={categories} />
  }

  // Иначе показываем баннер
  return <HomepageBanner banners={banners} />
}

