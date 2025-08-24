"use client"

import { useState } from "react"
import { Truck, Shield, Clock, Headphones } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import BenefitsTab from "./benefits-tab"
import SmallBannersTab from "./small-banners-tab"

interface InfoCard {
  id: number
  title: string
  description: string
  icon: string
  is_active: boolean
  order: number
}

export default function CardsTab() {
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

      <Tabs defaultValue="benefits" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="benefits">Преимущества</TabsTrigger>
          <TabsTrigger value="information">Информация</TabsTrigger>
        </TabsList>

        <TabsContent value="benefits" className="mt-6">
          <BenefitsTab />
        </TabsContent>

        <TabsContent value="information" className="mt-6">
          <SmallBannersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
