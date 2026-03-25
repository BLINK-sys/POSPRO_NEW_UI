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
        <TabsList>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Поставщики
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="flex items-center gap-2">
            <WarehouseIcon className="h-4 w-4" />
            Склады
          </TabsTrigger>
          <TabsTrigger value="currencies" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Справочник валют
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="suppliers">
        <Card>
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
        <Card>
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
        <Card>
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
