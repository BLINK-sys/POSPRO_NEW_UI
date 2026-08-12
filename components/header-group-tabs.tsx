"use client"

/**
 * Вложенные табы группы «Шапка» — всё, что относится к шапке сайта:
 *   - Основное (уведомление + разделы категорий шапки)
 *   - Типы каталогов (какие каталоги показывать/скрывать)
 *   - Оплата и доставка (страница из info-bar)
 *   - О компании (страница из info-bar)
 *   - Помощь (страница из info-bar)
 *
 * Рендерится под основной панелью табов /admin/pages, когда выбран
 * родительский таб «Шапка».
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HeaderInfoTab from "./header-info-tab"
import CatalogVisibilityTab from "./catalog-visibility-tab"
import { PayDeliveryTab, AboutTab, HelpTab } from "./static-page-tab"

const TRIGGER_CLS =
  "rounded-md text-sm data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm transition-all"

export default function HeaderGroupTabs() {
  return (
    <Tabs defaultValue="header-main" className="w-full">
      <TabsList className="grid w-full grid-cols-5 rounded-lg bg-gray-100 p-1">
        <TabsTrigger value="header-main" className={TRIGGER_CLS}>Основное</TabsTrigger>
        <TabsTrigger value="catalog-types" className={TRIGGER_CLS}>Типы каталогов</TabsTrigger>
        <TabsTrigger value="pay-delivery" className={TRIGGER_CLS}>Оплата и доставка</TabsTrigger>
        <TabsTrigger value="about" className={TRIGGER_CLS}>О компании</TabsTrigger>
        <TabsTrigger value="help" className={TRIGGER_CLS}>Помощь</TabsTrigger>
      </TabsList>

      <TabsContent value="header-main" className="mt-6">
        <HeaderInfoTab />
      </TabsContent>

      <TabsContent value="catalog-types" className="mt-6">
        <CatalogVisibilityTab />
      </TabsContent>

      <TabsContent value="pay-delivery" className="mt-6">
        <PayDeliveryTab />
      </TabsContent>

      <TabsContent value="about" className="mt-6">
        <AboutTab />
      </TabsContent>

      <TabsContent value="help" className="mt-6">
        <HelpTab />
      </TabsContent>
    </Tabs>
  )
}
