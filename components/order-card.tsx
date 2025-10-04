"use client"

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Minus, Plus, X } from "lucide-react"
import { API_BASE_URL } from "@/lib/api-address"

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

interface OrderCardProps {
  order: Order
  onCancelOrder?: (orderId: number) => void
  isCancelling?: boolean
}

const paymentStatusColors = {
  unpaid: { bg: 'bg-red-100', text: 'text-red-800', name: 'Не оплачен' },
  paid: { bg: 'bg-green-100', text: 'text-green-800', name: 'Оплачен' },
  refunded: { bg: 'bg-gray-100', text: 'text-gray-800', name: 'Возврат' }
}

export default function OrderCard({ order, onCancelOrder, isCancelling }: OrderCardProps) {
  const paymentInfo = paymentStatusColors[order.payment_status as keyof typeof paymentStatusColors] || paymentStatusColors.unpaid
  
  // Функция для получения правильного URL изображения
  const getImageUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") {
      return "/placeholder.svg"
    }
    
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-lg">
      {/* Заголовок заказа */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-black">
            Заказ #{order.order_number}
          </h3>
          {order.status_info ? (
            <Badge 
              className="bg-yellow-100 text-yellow-800 border-yellow-200"
              style={{
                backgroundColor: order.status_info.background_color,
                color: order.status_info.text_color
              }}
            >
              {order.status_info.name}
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
              В ожидании
            </Badge>
          )}
        </div>
      </div>

      {/* Информация о заказе */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-gray-600">
          Дата: {new Date(order.created_at).toLocaleDateString('ru-RU')}
        </span>
        <Badge className={`${paymentInfo.bg} ${paymentInfo.text} border-0`}>
          {paymentInfo.name}
        </Badge>
        <span className="text-gray-600">
          {order.delivery_method === 'pickup' ? 'Самовывоз' : 'Доставка'}
        </span>
      </div>

      {/* Товары в заказе */}
      <div className="bg-gray-100 rounded-lg p-4 shadow-md">
        {/* Заголовки колонок */}
        <div className="grid grid-cols-4 gap-4 mb-3 pb-2 border-b border-gray-300">
          <div className="text-sm font-semibold text-gray-700">Изображение</div>
          <div className="text-sm font-semibold text-gray-700">Наименование</div>
          <div className="text-sm font-semibold text-gray-700">Кол-во</div>
          <div className="text-sm font-semibold text-gray-700">Цена за шт.</div>
        </div>

        {/* Товары */}
        {order.items.map((item) => (
          <div key={item.id} className="grid grid-cols-4 gap-4 py-3 border-b border-gray-200 last:border-b-0">
            {/* Изображение */}
            <div className="relative w-24 h-24 bg-white rounded overflow-hidden flex-shrink-0 shadow-md">
              {item.product?.slug ? (
                <Link href={`/product/${item.product.slug}`} className="block w-full h-full">
                  {item.product?.image_url ? (
                    <Image
                      src={getImageUrl(item.product.image_url)}
                      alt={item.product_name}
                      fill
                      className="object-contain hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">
                      <span className="text-xs">Нет фото</span>
                    </div>
                  )}
                </Link>
              ) : (
                <>
                  {item.product?.image_url ? (
                    <Image
                      src={getImageUrl(item.product.image_url)}
                      alt={item.product_name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                      <span className="text-xs">Нет фото</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Наименование */}
            <div className="flex items-center">
              {item.product?.slug ? (
                <Link href={`/product/${item.product.slug}`}>
                  <button className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 shadow-md hover:bg-yellow-400 hover:shadow-lg transition-all duration-200 text-left w-full">
                    <h4 className="font-medium text-gray-900 text-sm hover:text-black transition-colors">
                      {item.product_name}
                    </h4>
                  </button>
                </Link>
              ) : (
                <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 shadow-md w-full">
                  <h4 className="font-medium text-gray-900 text-sm">
                    {item.product_name}
                  </h4>
                </div>
              )}
            </div>

            {/* Количество */}
            <div className="flex items-center">
              <span className="text-sm font-semibold text-gray-900">
                {item.quantity}
              </span>
            </div>

            {/* Цена за штуку */}
            <div className="flex items-center">
              <span className="text-sm font-semibold text-gray-900">
                {item.price_per_item.toLocaleString()} ₸
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Общая сумма заказа */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left">
            <span className="text-sm text-gray-600">
              <span className="font-semibold">Менеджер:</span> {order.manager?.manager?.full_name || 'Не назначен'} 
              {order.manager?.manager?.phone && ` ${order.manager.manager.phone}`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-lg font-semibold text-gray-900">Общая сумма заказа: </span>
            <span className="text-xl font-bold text-gray-900">
              {order.total_amount.toLocaleString()} ₸
            </span>
          </div>
        </div>
      </div>

      {/* Действия */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Image
            src="/ui/Logo.png"
            alt="PosPro"
            width={24}
            height={24}
            className="h-6 w-auto"
          />
        </div>
        
        {order.status_info && !order.status_info.is_final && onCancelOrder && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancelOrder(order.id)}
            disabled={isCancelling}
            className="text-gray-600 hover:text-red-600 border-gray-300 hover:border-red-300"
          >
            {isCancelling ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Отменяем...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Отменить заказ
              </>
            )}
          </Button>
        )}
        
        {/* Показываем статус для завершенных заказов */}
        {order.status_info && order.status_info.is_final && (
          <div className="text-right">
            <Badge 
              className="bg-green-100 text-green-800 border-green-200"
              style={{
                backgroundColor: order.status_info.background_color,
                color: order.status_info.text_color
              }}
            >
              {order.status_info.name}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
