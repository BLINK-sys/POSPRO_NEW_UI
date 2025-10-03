'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, Calendar, CreditCard, Truck, RefreshCw, History, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getOrders } from "@/app/actions/orders"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import OrderCard from "@/components/order-card"

interface OrderItem {
  id: number
  product_name: string
  product_article: string
  quantity: number
  price_per_item: number
  total_price: number
  product: {
    id: number
    name: string
    slug: string
    image_url: string | null
    current_price: number
  } | null
}

interface Order {
  id: number
  order_number: string
  status_id: number
  status_info?: {
    id: number
    name: string
    background_color: string
    text_color: string
    is_final: boolean
  }
  payment_status: string
  payment_method: string
  total_amount: number
  subtotal: number
  customer_name: string
  customer_phone: string
  delivery_method: string
  delivery_address: string
  customer_comment: string
  created_at: string
  items: OrderItem[]
  items_count: number
  manager?: {
    id: number
    manager_id: number
    assigned_at: string
    assigned_by: number
    manager: {
      id: number
      full_name: string
      email: string
      phone: string
    }
    assigned_by_user: {
      id: number
      full_name: string
    }
  }
}

interface OrdersData {
  orders: Order[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export default function ProfileHistoryPage() {
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null)
  const [allOrders, setAllOrders] = useState<Order[]>([]) // Все заказы для фильтрации
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all') // all, delivered, cancelled
  
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()

  const fetchOrders = async (page: number = 1) => {
    setIsLoading(true)
    try {
      console.log('DEBUG: Загружаем завершенные заказы (completed)')
      const result = await getOrders(page, 100, 'completed') // Загружаем все завершенные заказы (большой лимит)
      if (result.success) {
        setOrdersData(result.data)
        setAllOrders(result.data.orders) // Сохраняем все заказы для фильтрации
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить историю покупок',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }
    if (user.role !== 'client') {
      router.push('/')
      return
    }
    fetchOrders(currentPage)
  }, [user, currentPage])

  // Функция фильтрации заказов
  const getFilteredOrders = () => {
    if (!allOrders.length) return []
    
    switch (statusFilter) {
      case 'delivered':
        return allOrders.filter(order => order.status_info?.name === 'Доставлен')
      case 'cancelled':
        return allOrders.filter(order => order.status_info?.name === 'Отменён')
      default:
        return allOrders
    }
  }

  // Обработчик изменения фильтра
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1) // Сбрасываем на первую страницу при изменении фильтра
  }

  // Получаем отфильтрованные заказы
  const filteredOrders = getFilteredOrders()

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-2 mb-6">
          <History className="h-6 w-6" />
          <h1 className="text-2xl font-bold">История покупок</h1>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!ordersData || allOrders.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-2 mb-6">
          <History className="h-6 w-6" />
          <h1 className="text-2xl font-bold">История покупок</h1>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">История покупок пуста</h2>
            <p className="text-gray-600 mb-4">У вас пока нет завершенных заказов</p>
            <Button asChild>
              <Link href="/profile/orders">
                Перейти к заказам
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6" />
          <h1 className="text-2xl font-bold">История покупок</h1>
          <Badge variant="secondary">{filteredOrders.length} заказов</Badge>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Фильтр по статусам */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-40 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                <SelectValue placeholder="Фильтр по статусу" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все заказы</SelectItem>
                <SelectItem value="delivered">Доставленные</SelectItem>
                <SelectItem value="cancelled">Отменённые</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => fetchOrders(currentPage)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <History className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">Заказы не найдены</h2>
              <p className="text-gray-600 mb-4">
                {statusFilter === 'delivered' && 'У вас нет доставленных заказов'}
                {statusFilter === 'cancelled' && 'У вас нет отменённых заказов'}
                {statusFilter === 'all' && 'У вас нет завершенных заказов'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              // Убираем возможность отмены для завершенных заказов
            />
          ))
        )}
      </div>

      {/* Пагинация - скрываем для отфильтрованных данных */}
      {statusFilter === 'all' && ordersData && ordersData.pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={!ordersData.pagination.has_prev}
          >
            Предыдущая
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: ordersData.pagination.pages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(ordersData.pagination.pages, prev + 1))}
            disabled={!ordersData.pagination.has_next}
          >
            Следующая
          </Button>
        </div>
      )}
    </div>
  )
}
