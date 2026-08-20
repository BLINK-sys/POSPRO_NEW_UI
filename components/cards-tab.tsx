"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Truck, Shield, Clock, Headphones } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import BenefitsTab from "./benefits-tab"
import SmallBannersTab from "./small-banners-tab"
import SectionCardsTab from "./section-cards-tab"

interface InfoCard {
  id: number
  title: string
  description: string
  icon: string
  is_active: boolean
  order: number
}

export default function CardsTab() {
  const searchParams = useSearchParams()
  const [innerTab, setInnerTab] = useState<string>("benefits")

  // Deep-link из карандашика: если пришли по ?edit-section-card=<id> —
  // переключаемся на «Карточки разделов» (модалку откроет SectionCardsTab).
  useEffect(() => {
    if (searchParams.get("edit-section-card")) setInnerTab("sections")
  }, [searchParams])

  const [cards, setCards] = useState<InfoCard[]>([
    {
      id: 1,
      title: "Быстрая доставка",
      description: "Доставляем заказы в течение 24 часов",
      icon: "truck",
      is_active: true,
      order: 1,
    },
    {
      id: 2,
      title: "Гарантия качества",
      description: "Все товары проходят контроль качества",
      icon: "shield",
      is_active: true,
      order: 2,
    },
    {
      id: 3,
      title: "Круглосуточная поддержка",
      description: "Наша команда готова помочь в любое время",
      icon: "headphones",
      is_active: true,
      order: 3,
    },
    {
      id: 4,
      title: "Экономия времени",
      description: "Быстрое оформление заказа онлайн",
      icon: "clock",
      is_active: false,
      order: 4,
    },
  ])

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "truck":
        return <Truck className="h-8 w-8" />
      case "shield":
        return <Shield className="h-8 w-8" />
      case "headphones":
        return <Headphones className="h-8 w-8" />
      case "clock":
        return <Clock className="h-8 w-8" />
      default:
        return <Shield className="h-8 w-8" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Управление карточками</h3>
        <p className="text-sm text-muted-foreground">
          Управляйте преимуществами и информационными карточками, которые отображаются на сайте.
        </p>
      </div>

      <Tabs value={innerTab} onValueChange={setInnerTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-lg bg-gray-100 p-1">
          <TabsTrigger
            value="benefits"
            className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            Преимущества
          </TabsTrigger>
          <TabsTrigger
            value="information"
            className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            Информация
          </TabsTrigger>
          <TabsTrigger
            value="sections"
            className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            Карточки разделов
          </TabsTrigger>
        </TabsList>

        <TabsContent value="benefits" className="mt-6">
          <BenefitsTab />
        </TabsContent>

        <TabsContent value="information" className="mt-6">
          <SmallBannersTab />
        </TabsContent>

        <TabsContent value="sections" className="mt-6">
          <SectionCardsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
