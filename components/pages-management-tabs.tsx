"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import BannersTab from "./banners-tab"
import MainBlocksTab from "./main-blocks-tab"
import CardsTab from "./cards-tab"
import FooterInfoTab from "./footer-info-tab"

export default function PagesManagementTabs() {
  return (
    <Tabs defaultValue="banners" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="banners">Баннеры</TabsTrigger>
        <TabsTrigger value="main-blocks">Блоки на главной</TabsTrigger>
        <TabsTrigger value="cards">Карточки</TabsTrigger>
        <TabsTrigger value="footer-info">Инфо подвала</TabsTrigger>
      </TabsList>

      <TabsContent value="banners" className="mt-6">
        <BannersTab />
      </TabsContent>

      <TabsContent value="main-blocks" className="mt-6">
        <MainBlocksTab />
      </TabsContent>

      <TabsContent value="cards" className="mt-6">
        <CardsTab />
      </TabsContent>

      <TabsContent value="footer-info" className="mt-6">
        <FooterInfoTab />
      </TabsContent>
    </Tabs>
  )
}
