"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HeaderGroupTabs from "./header-group-tabs"
import BannersTab from "./banners-tab"
import MainBlocksTab from "./main-blocks-tab"
import CardsTab from "./cards-tab"
import FooterInfoTab from "./footer-info-tab"
import SearchPageTab from "./search-page-tab"

const TRIGGER_CLS =
  "rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"

// Верхнеуровневые вкладки страниц сайта. «Шапка» — родительский; внутри
// открывается вложенная панель с настройками, относящимися к шапке
// (уведомление, разделы категорий, оплата и доставка, о компании, помощь,
// типы каталогов). Остальные вкладки — независимые разделы контента.
export default function PagesManagementTabs() {
  return (
    <Tabs defaultValue="header" className="w-full">
      <TabsList className="grid w-full grid-cols-6 rounded-lg bg-gray-100 p-1">
        <TabsTrigger value="header" className={TRIGGER_CLS}>Шапка</TabsTrigger>
        <TabsTrigger value="banners" className={TRIGGER_CLS}>Баннеры</TabsTrigger>
        <TabsTrigger value="main-blocks" className={TRIGGER_CLS}>Блоки на главной</TabsTrigger>
        <TabsTrigger value="cards" className={TRIGGER_CLS}>Карточки</TabsTrigger>
        <TabsTrigger value="search-page" className={TRIGGER_CLS}>Страница поиска</TabsTrigger>
        <TabsTrigger value="footer-info" className={TRIGGER_CLS}>Инфо подвала</TabsTrigger>
      </TabsList>

      <TabsContent value="header" className="mt-6">
        <HeaderGroupTabs />
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

      <TabsContent value="search-page" className="mt-6">
        <SearchPageTab />
      </TabsContent>

      <TabsContent value="footer-info" className="mt-6">
        <FooterInfoTab />
      </TabsContent>
    </Tabs>
  )
}
