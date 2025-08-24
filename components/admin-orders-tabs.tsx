'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter } from 'lucide-react'
import { AdminOrdersTable } from './admin-orders-table'
import { 
  getNewOrders, 
  getMyOrders, 
  getCompletedOrders,
  AdminOrder, 
  Manager, 
  OrderStatus 
} from '@/app/actions/admin-orders'

interface AdminOrdersTabsProps {
  managers: Manager[]
  statuses: OrderStatus[]
}

export function AdminOrdersTabs({ managers, statuses }: AdminOrdersTabsProps) {
  const [activeTab, setActiveTab] = useState('new')
  
  // Состояние для новых заказов
  const [newOrders, setNewOrders] = useState<AdminOrder[]>([])
  const [newOrdersLoading, setNewOrdersLoading] = useState(false)
  
  // Состояние для моих заказов
  const [myOrders, setMyOrders] = useState<AdminOrder[]>([])
  const [myOrdersLoading, setMyOrdersLoading] = useState(false)
  
  // Состояние для завершенных заказов
  const [completedOrders, setCompletedOrders] = useState<AdminOrder[]>([])
  const [completedOrdersLoading, setCompletedOrdersLoading] = useState(false)
  
  // Фильтры для моих заказов
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  // Фильтры для завершенных заказов
  const [completedStatusFilter, setCompletedStatusFilter] = useState<string>('all')
  const [completedSearchQuery, setCompletedSearchQuery] = useState('')
  const [completedSearchInput, setCompletedSearchInput] = useState('')

  // Загрузка новых заказов
  const loadNewOrders = async () => {
    setNewOrdersLoading(true)
    try {
      const result = await getNewOrders(1, 50)
      if (result.success) {
        setNewOrders(result.data.orders)
      }
    } catch (error) {
      console.error('Ошибка загрузки новых заказов:', error)
    } finally {
      setNewOrdersLoading(false)
    }
  }

  // Загрузка моих заказов
  const loadMyOrders = async () => {
    setMyOrdersLoading(true)
    try {
      const statusId = statusFilter && statusFilter !== 'all' ? parseInt(statusFilter) : undefined
      const result = await getMyOrders(1, 50, statusId, searchQuery)
      if (result.success) {
        setMyOrders(result.data.orders)
      }
    } catch (error) {
      console.error('Ошибка загрузки моих заказов:', error)
    } finally {
      setMyOrdersLoading(false)
    }
  }

  // Загрузка завершенных заказов
  const loadCompletedOrders = async () => {
    setCompletedOrdersLoading(true)
    try {
      const statusId = completedStatusFilter && completedStatusFilter !== 'all' ? parseInt(completedStatusFilter) : undefined
      const result = await getCompletedOrders(1, 50, statusId, completedSearchQuery)
      if (result.success) {
        setCompletedOrders(result.data.orders)
      }
    } catch (error) {
      console.error('Ошибка загрузки завершенных заказов:', error)
    } finally {
      setCompletedOrdersLoading(false)
    }
  }

  // Загрузка данных при смене вкладки
  useEffect(() => {
    if (activeTab === 'new') {
      loadNewOrders()
    } else if (activeTab === 'my') {
      loadMyOrders()
    } else if (activeTab === 'completed') {
      loadCompletedOrders()
    }
  }, [activeTab])

  // Перезагрузка моих заказов при изменении фильтров
  useEffect(() => {
    if (activeTab === 'my') {
      loadMyOrders()
    }
  }, [statusFilter, searchQuery])

  // Перезагрузка завершенных заказов при изменении фильтров
  useEffect(() => {
    if (activeTab === 'completed') {
      loadCompletedOrders()
    }
  }, [completedStatusFilter, completedSearchQuery])

  // Автоматический поиск при вводе
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 500) // Дебаунс 500мс

    return () => clearTimeout(timeoutId)
  }, [searchInput])

  // Автоматический поиск для завершенных заказов
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCompletedSearchQuery(completedSearchInput.trim())
    }, 500) // Дебаунс 500мс

    return () => clearTimeout(timeoutId)
  }, [completedSearchInput])

  // Очистка фильтров для текущих заказов
  const clearFilters = () => {
    setStatusFilter('all')
    setSearchQuery('')
    setSearchInput('')
  }

  // Очистка фильтров для завершенных заказов
  const clearCompletedFilters = () => {
    setCompletedStatusFilter('all')
    setCompletedSearchQuery('')
    setCompletedSearchInput('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Заказы</h1>
          <p className="text-muted-foreground">
            Управление заказами магазина
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new">Новые</TabsTrigger>
          <TabsTrigger value="my">Текущие</TabsTrigger>
          <TabsTrigger value="completed">Завершённые</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Новые заказы</CardTitle>
              <p className="text-sm text-muted-foreground">
                Заказы без назначенного менеджера
              </p>
            </CardHeader>
            <CardContent>
              {newOrdersLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <AdminOrdersTable 
                  initialOrders={newOrders}
                  managers={managers}
                  statuses={statuses}
                  showOnlyAcceptButton={true}
                  onOrderUpdate={loadNewOrders}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my">
          <Card>
            <CardHeader>
              <CardTitle>Текущие заказы</CardTitle>
              <p className="text-sm text-muted-foreground">
                Заказы в работе
              </p>
            </CardHeader>
            <CardContent>
              {/* Фильтры */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Поиск по клиенту (имя, email, телефон)..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Фильтр по статусу" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    {statuses.filter(status => !status.is_final).map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(statusFilter && statusFilter !== 'all' || searchQuery) && (
                  <Button onClick={clearFilters} variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Очистить
                  </Button>
                )}
              </div>

              {myOrdersLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <AdminOrdersTable 
                  initialOrders={myOrders}
                  managers={managers}
                  statuses={statuses}
                  showOnlyTransferButton={true}
                  hideManagerName={true}
                  onOrderUpdate={loadMyOrders}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Завершённые заказы</CardTitle>
              <p className="text-sm text-muted-foreground">
                Заказы с финальными статусами
              </p>
            </CardHeader>
            <CardContent>
              {/* Фильтры */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Поиск по клиенту (имя, email, телефон)..."
                      value={completedSearchInput}
                      onChange={(e) => setCompletedSearchInput(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={completedStatusFilter} onValueChange={setCompletedStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Фильтр по статусу" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    {statuses.filter(status => status.is_final).map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(completedStatusFilter && completedStatusFilter !== 'all' || completedSearchQuery) && (
                  <Button onClick={clearCompletedFilters} variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Очистить
                  </Button>
                )}
              </div>

              {completedOrdersLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <AdminOrdersTable 
                  initialOrders={completedOrders}
                  managers={managers}
                  statuses={statuses}
                  hideManagerButtons={true}
                  hideManagerName={true}
                  onOrderUpdate={loadCompletedOrders}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
