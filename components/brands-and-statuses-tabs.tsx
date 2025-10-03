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
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="brands">Бренды</TabsTrigger>
        <TabsTrigger value="statuses">Статусы товаров</TabsTrigger>
        <TabsTrigger value="order-statuses">Статусы заказов</TabsTrigger>
        <TabsTrigger value="product-availability-statuses">Статус наличия товара</TabsTrigger>
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
