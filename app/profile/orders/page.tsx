'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Package, Calendar, CreditCard, Truck, RefreshCw, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getOrders, cancelOrder } from "@/app/actions/orders"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
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

// Fallback цвета для статусов (если status_info отсутствует)
const fallbackStatusColors = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', name: 'В ожидании' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', name: 'Подтверждён' },
  processing: { bg: 'bg-orange-100', text: 'text-orange-800', name: 'В обработке' },
  shipped: { bg: 'bg-purple-100', text: 'text-purple-800', name: 'Отправлен' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', name: 'Доставлен' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', name: 'Отменён' }
}

const paymentStatusColors = {
  unpaid: { bg: 'bg-red-100', text: 'text-red-800', name: 'Не оплачено' },
  paid: { bg: 'bg-green-100', text: 'text-green-800', name: 'Оплачено' },
  refunded: { bg: 'bg-gray-100', text: 'text-gray-800', name: 'Возврат' }
}

export default function ProfileOrdersPage() {
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null)
  
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()

  const fetchOrders = async (page: number = 1) => {
    setIsLoading(true)
    try {
      const result = await getOrders(page, 10, 'active') // Загружаем только активные заказы
      if (result.success) {
        setOrdersData(result.data)
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
        description: 'Не удалось загрузить заказы',
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

  const handleCancelOrder = async (orderId: number) => {
    setCancellingOrderId(orderId)
    try {
      const result = await cancelOrder(orderId)
      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Заказ отменён'
        })
        fetchOrders(currentPage) // Перезагружаем заказы
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
        description: 'Не удалось отменить заказ',
        variant: 'destructive'
      })
    } finally {
      setCancellingOrderId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-2 mb-6">
          <Package className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Мои заказы</h1>
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

  if (!ordersData || ordersData.orders.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-2 mb-6">
          <Package className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Мои заказы</h1>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">У вас пока нет заказов</h2>
            <p className="text-gray-600 mb-4">Начните покупки, чтобы увидеть здесь свои заказы</p>
            <Button asChild>
              <Link href="/">
                Перейти к покупкам
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
          <Package className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Мои заказы</h1>
          <Badge variant="secondary">{ordersData.pagination.total} заказов</Badge>
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

      <div className="space-y-6">
        {ordersData.orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onCancelOrder={handleCancelOrder}
            isCancelling={cancellingOrderId === order.id}
          />
        ))}
      </div>

      {/* Пагинация */}
      {ordersData.pagination.pages > 1 && (
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