"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SuppliersManagement } from "@/components/suppliers-management"
import { CurrenciesManagement } from "@/components/currencies-management"
import { WarehousesManagement } from "@/components/warehouses-management"
import type { Supplier } from "@/app/actions/suppliers"
import type { Currency } from "@/app/actions/currencies"
import type { Warehouse } from "@/app/actions/warehouses"
import { Truck, Warehouse as WarehouseIcon, Coins } from "lucide-react"

interface SuppliersPageClientProps {
  initialSuppliers: Supplier[]
  initialCurrencies: Currency[]
  initialWarehouses: Warehouse[]
}

export function SuppliersPageClient({
  initialSuppliers,
  initialCurrencies,
  initialWarehouses,
}: SuppliersPageClientProps) {
  const [activeTab, setActiveTab] = useState("suppliers")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex items-center justify-between mb-4">
        <TabsList className="rounded-lg bg-gray-100 p-1">
          <TabsTrigger
            value="suppliers"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            <Truck className="h-4 w-4" />
            Поставщики
          </TabsTrigger>
          <TabsTrigger
            value="warehouses"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            <WarehouseIcon className="h-4 w-4" />
            Склады
          </TabsTrigger>
          <TabsTrigger
            value="currencies"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            <Coins className="h-4 w-4" />
            Справочник валют
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="suppliers">
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle>Поставщики</CardTitle>
            <CardDescription>
              Управление справочником поставщиков. Создание, редактирование, удаление и поиск поставщиков.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SuppliersManagement initialSuppliers={initialSuppliers} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="warehouses">
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle>Склады</CardTitle>
            <CardDescription>
              Склады поставщиков с формулами расчёта цен. Каждый склад имеет валюту и формулу для автоматического расчёта цены из себестоимости.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WarehousesManagement
              initialWarehouses={initialWarehouses}
              suppliers={initialSuppliers}
              currencies={initialCurrencies}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="currencies">
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle>Справочник валют</CardTitle>
            <CardDescription>
              Валюты для складов. Курс к тенге используется для конвертации себестоимости в итоговую цену.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CurrenciesManagement initialCurrencies={initialCurrencies} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
