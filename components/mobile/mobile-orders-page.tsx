"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Package, RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getOrders, cancelOrder } from "@/app/actions/orders"
import { formatProductPrice } from "@/lib/utils"
import { getImageUrl } from "@/lib/image-utils"
import { useAuth } from "@/context/auth-context"
import { toast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"

export default function MobileOrdersPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/auth")
      return
    }
    loadOrders()
  }, [user, authLoading, page])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const result = await getOrders(page, 10, "active")
      if (result.success && result.data) {
        setOrders(result.data.orders || [])
        setTotalPages(result.data.pagination?.pages || 1)
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error("Error loading orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (orderId: number) => {
    try {
      await cancelOrder(orderId)
      toast({ title: "Заказ отменён" })
      loadOrders()
    } catch (error) {
      toast({ title: "Ошибка отмены", variant: "destructive" })
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <h1 className="text-lg font-bold">Заказы</h1>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={loadOrders}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {orders.length > 0 ? (
        <div className="px-4 py-3 space-y-3">
          {orders.map((order: any) => (
            <OrderCard key={order.id} order={order} onCancel={handleCancel} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Package className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Нет активных заказов</h2>
          <p className="text-sm text-gray-500 text-center">Оформите заказ через корзину</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, onCancel }: { order: any; onCancel: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "новый": case "new": return "bg-blue-100 text-blue-800"
      case "в обработке": case "processing": return "bg-yellow-100 text-yellow-800"
      case "доставлен": case "delivered": return "bg-green-100 text-green-800"
      case "отменён": case "cancelled": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const statusName = order.status_info?.name || order.status?.name || order.status || "—"
  const statusColor = order.status_info
    ? undefined
    : getStatusColor(statusName)

  const paymentStatusMap: Record<string, { label: string; color: string }> = {
    unpaid: { label: "Не оплачен", color: "bg-red-100 text-red-800" },
    paid: { label: "Оплачен", color: "bg-green-100 text-green-800" },
    refunded: { label: "Возврат", color: "bg-gray-100 text-gray-800" },
  }
  const paymentInfo = paymentStatusMap[order.payment_status] || paymentStatusMap.unpaid

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardContent className="p-0">
        {/* Header - clickable to toggle */}
        <button className="w-full text-left p-3" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold">Заказ #{order.order_number || order.id}</span>
            <div className="flex items-center gap-2">
              {order.status_info ? (
                <Badge
                  className="text-[10px]"
                  style={{ backgroundColor: order.status_info.background_color, color: order.status_info.text_color }}
                >
                  {order.status_info.name}
                </Badge>
              ) : (
                <Badge className={`text-[10px] ${statusColor}`}>{statusName}</Badge>
              )}
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {order.created_at && (
              <span>{new Date(order.created_at).toLocaleDateString("ru-RU")}</span>
            )}
            <span className="font-bold text-gray-900">{formatProductPrice(order.total_amount)}</span>
            {order.items_count > 0 && (
              <span>{order.items_count} товар{order.items_count > 4 ? "ов" : order.items_count > 1 ? "а" : ""}</span>
            )}
          </div>
        </button>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 border-t border-gray-100">
                {/* Order info */}
                <div className="flex flex-wrap gap-2 py-2 text-xs text-gray-500">
                  <Badge className={`text-[10px] ${paymentInfo.color}`}>{paymentInfo.label}</Badge>
                  {order.delivery_method && (
                    <span>{order.delivery_method === "pickup" ? "Самовывоз" : "Доставка"}</span>
                  )}
                  {order.payment_method && <span>{order.payment_method}</span>}
                </div>

                {/* Products list */}
                {order.items && order.items.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-2 space-y-2 mt-1">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg p-2 shadow-sm">
                        <div className="relative w-14 h-14 bg-gray-50 rounded-md overflow-hidden shrink-0">
                          {item.product?.image_url ? (
                            <Image
                              src={getImageUrl(item.product.image_url)}
                              alt={item.product_name}
                              fill
                              className="object-contain p-0.5"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                              Нет фото
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {item.product?.slug ? (
                            <Link href={`/product/${item.product.slug}`} className="text-xs font-medium text-gray-900 line-clamp-2 hover:text-blue-600">
                              {item.product_name}
                            </Link>
                          ) : (
                            <p className="text-xs font-medium text-gray-900 line-clamp-2">{item.product_name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-500">{item.quantity} шт.</span>
                            <span className="text-[11px] font-semibold text-gray-900">{formatProductPrice(item.price_per_item)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manager */}
                {order.manager?.manager && (
                  <div className="text-xs text-gray-500 mt-2">
                    Менеджер: {order.manager.manager.full_name}
                    {order.manager.manager.phone && ` ${order.manager.manager.phone}`}
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Итого:</span>
                  <span className="text-sm font-bold text-gray-900">{formatProductPrice(order.total_amount)}</span>
                </div>

                {/* Cancel button */}
                {order.status_info && !order.status_info.is_final && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs text-red-500 border-red-200 h-7 w-full"
                    onClick={(e) => { e.stopPropagation(); onCancel(order.id) }}
                  >
                    Отменить заказ
                  </Button>
                )}
                {!order.status_info && (order.status?.name === "Новый" || order.status === "new" || order.status?.name === "новый") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs text-red-500 border-red-200 h-7 w-full"
                    onClick={(e) => { e.stopPropagation(); onCancel(order.id) }}
                  >
                    Отменить заказ
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
