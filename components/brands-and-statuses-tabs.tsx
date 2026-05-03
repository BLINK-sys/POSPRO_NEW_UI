"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Brand, Status } from "@/app/actions/meta"
import { BrandsList } from "./brands-list"
import { StatusesList } from "./statuses-list"
import { OrderStatusesTab } from "./order-statuses-tab"
import ProductAvailabilityStatusesTab from "./product-availability-statuses-tab"

interface BrandsAndStatusesTabsProps {
  initialBrands: Brand[]
  initialStatuses: Status[]
}

export function BrandsAndStatusesTabs({ initialBrands, initialStatuses }: BrandsAndStatusesTabsProps) {
  return (
    <Tabs defaultValue="brands" className="w-full">
      <TabsList className="grid w-full grid-cols-4 rounded-lg bg-gray-100 p-1">
        <TabsTrigger
          value="brands"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Бренды
        </TabsTrigger>
        <TabsTrigger
          value="statuses"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Статусы товаров
        </TabsTrigger>
        <TabsTrigger
          value="order-statuses"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Статусы заказов
        </TabsTrigger>
        <TabsTrigger
          value="product-availability-statuses"
          className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
        >
          Статус наличия товара
        </TabsTrigger>
      </TabsList>
      <TabsContent value="brands">
        <BrandsList brands={initialBrands} />
      </TabsContent>
      <TabsContent value="statuses">
        <StatusesList statuses={initialStatuses} />
      </TabsContent>
      <TabsContent value="order-statuses">
        <OrderStatusesTab />
      </TabsContent>
      <TabsContent value="product-availability-statuses">
        <ProductAvailabilityStatusesTab />
      </TabsContent>
    </Tabs>
  )
}
