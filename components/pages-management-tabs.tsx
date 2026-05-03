"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import BannersTab from "./banners-tab"
import MainBlocksTab from "./main-blocks-tab"
import CardsTab from "./cards-tab"
import FooterInfoTab from "./footer-info-tab"
import CatalogVisibilityTab from "./catalog-visibility-tab"

export default function PagesManagementTabs() {
  return (
    <Tabs defaultValue="banners" className="w-full">
      <TabsList className="grid w-full grid-cols-5 rounded-lg bg-gray-100 p-1">
        <TabsTrigger
          value="catalog-types"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Типы каталогов
        </TabsTrigger>
        <TabsTrigger
          value="banners"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Баннеры
        </TabsTrigger>
        <TabsTrigger
          value="main-blocks"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Блоки на главной
        </TabsTrigger>
        <TabsTrigger
          value="cards"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Карточки
        </TabsTrigger>
        <TabsTrigger
          value="footer-info"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Инфо подвала
        </TabsTrigger>
      </TabsList>

      <TabsContent value="catalog-types" className="mt-6">
        <CatalogVisibilityTab />
      </TabsContent>

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
