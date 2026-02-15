'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { getCart, updateCartItemQuantity, removeFromCart, clearCart } from '@/app/actions/cart'
import { createOrder } from '@/app/actions/orders'
import { useAuth } from '@/context/auth-context'
import { getDeliveryAddress } from '@/app/actions/auth'
import { useCart } from '@/context/cart-context'
import { getImageUrl } from '@/lib/image-utils'
import Link from 'next/link'
import Image from 'next/image'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import MobileCartPage from '@/components/mobile/mobile-cart-page'

interface CartItem {
  id: number
  product_id: number
  quantity: number
  total_price: number
  product: {
    id: number
    name: string
    slug: string
    price: number
    article: string
    image_url: string | null
    status: any
    category: any
    quantity_available: number
  }
}

interface CartData {
  items: CartItem[]
  total_amount: number
  items_count: number
}

export default function ProfileCartPage() {
  const [cartData, setCartData] = useState<CartData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<number | null>(null)
  const [localQuantities, setLocalQuantities] = useState<Record<number, number>>({})

  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address: '',
    delivery_method: 'pickup',
    payment_method: 'cash',
    customer_comment: ''
  })
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  
  const { toast } = useToast()
  const { user } = useAuth()
  const { updateCartCount } = useCart()
  const isMobile = useIsMobile()

  // Функция для загрузки адреса доставки
  const loadDeliveryAddress = async () => {
    try {
      const result = await getDeliveryAddress()
      if (result.success && result.data.delivery_address) {
        setOrderForm(prev => ({
          ...prev,
          delivery_address: result.data.delivery_address
        }))
      }
    } catch (error) {
      console.error('Ошибка загрузки адреса доставки:', error)
    }
  }

  const fetchCart = async () => {
    setIsLoading(true)
    try {
      const result = await getCart()
      if (result.success) {
        setCartData(result.data)
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
        description: 'Не удалось загрузить корзину',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Обработчик изменения способа доставки
  const handleDeliveryMethodChange = (value: string) => {
    setOrderForm(prev => ({ ...prev, delivery_method: value }))
    
    // Если выбрана доставка, загружаем адрес из профиля
    if (value === 'delivery') {
      loadDeliveryAddress()
    } else {
      // Если выбран самовывоз, очищаем адрес
      setOrderForm(prev => ({ ...prev, delivery_address: '' }))
    }
  }

  useEffect(() => {
    fetchCart()
    
    // Заполняем форму данными пользователя
    if (user) {
      setOrderForm(prev => ({
        ...prev,
        customer_name: user.fullName || user.ipName || user.tooName || '',
        customer_phone: user.phone || '',
        customer_email: user.email || '',
        delivery_address: user.deliveryAddress || ''
      }))
    }
  }, [user])

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return
    
    // Оптимистичное обновление UI
    setLocalQuantities(prev => ({ ...prev, [itemId]: newQuantity }))
    
    // Обновляем локальное состояние корзины
    if (cartData) {
      setCartData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map(item => 
            item.id === itemId 
              ? { ...item, quantity: newQuantity, total_price: item.product.price * newQuantity }
              : item
          ),
          total_amount: prev.items.reduce((sum, item) => 
            sum + (item.id === itemId ? item.product.price * newQuantity : item.total_price), 0
          )
        }
      })
    }
    
    // Отправляем на сервер в фоновом режиме
    try {
      const result = await updateCartItemQuantity(itemId, newQuantity)
      if (result.success) {
        await updateCartCount() // Обновляем счетчик в header
      } else {
        // Откатываем изменения при ошибке
        fetchCart()
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      // Откатываем изменения при ошибке
      fetchCart()
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить количество',
        variant: 'destructive'
      })
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    // Оптимистичное обновление UI - сразу убираем товар из списка
    if (cartData) {
      const removedItem = cartData.items.find(item => item.id === itemId)
      if (removedItem) {
        setCartData(prev => {
          if (!prev) return prev
          const newItems = prev.items.filter(item => item.id !== itemId)
          const newTotalAmount = newItems.reduce((sum, item) => sum + item.total_price, 0)
          const newItemsCount = newItems.length
          
          return {
            ...prev,
            items: newItems,
            total_amount: newTotalAmount,
            items_count: newItemsCount
          }
        })
        
        // Убираем из локального состояния количества
        setLocalQuantities(prev => {
          const newQuantities = { ...prev }
          delete newQuantities[itemId]
          return newQuantities
        })
      }
    }
    
    // Отправляем на сервер в фоновом режиме
    try {
      const result = await removeFromCart(itemId)
      if (result.success) {
        await updateCartCount() // Обновляем счетчик в header
      } else {
        // Откатываем изменения при ошибке
        fetchCart()
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      // Откатываем изменения при ошибке
      fetchCart()
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить товар',
        variant: 'destructive'
      })
    }
  }

  const handleClearCart = async () => {
    // Оптимистичное обновление UI - сразу очищаем корзину
    setCartData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: [],
        total_amount: 0,
        items_count: 0
      }
    })
    
    // Очищаем локальное состояние количества
    setLocalQuantities({})
    
    // Отправляем на сервер в фоновом режиме
    try {
      const result = await clearCart()
      if (result.success) {
        await updateCartCount() // Обновляем счетчик в header
      } else {
        // Откатываем изменения при ошибке
        fetchCart()
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      // Откатываем изменения при ошибке
      fetchCart()
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить корзину',
        variant: 'destructive'
      })
    }
  }

  const handleCreateOrder = async () => {
    setIsCreatingOrder(true)
    try {
      const result = await createOrder(orderForm)
      if (result.success) {
        toast({
          title: 'Успешно',
          description: `Заказ ${result.data.order_number} создан!`
        })
        fetchCart() // Корзина должна очиститься
        await updateCartCount() // Обновляем счетчик в header
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
        description: 'Не удалось создать заказ',
        variant: 'destructive'
      })
    } finally {
      setIsCreatingOrder(false)
    }
  }

  if (isMobile) return <MobileCartPage />

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Корзина</h1>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="w-24 h-24 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!cartData || cartData.items.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Корзина</h1>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Корзина пуста</h2>
            <p className="text-gray-600 mb-4">Добавьте товары в корзину, чтобы оформить заказ</p>
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
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Корзина</h1>
          <Badge variant="secondary">{cartData.items_count} товаров</Badge>
        </div>
        
        <Button 
          variant="outline" 
          onClick={handleClearCart}
          className="bg-gray-200 hover:bg-white hover:text-red-600 hover:border-red-600 text-black shadow-sm rounded-full"
        >
          Очистить корзину
        </Button>
      </div>

      {/* Разделительная полоса */}
      <div className="border-b border-gray-200 mb-6"></div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Список товаров */}
        <div className="lg:col-span-2 space-y-4">
          {cartData.items.map((item) => (
            <Card key={item.id} className="shadow-md">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* Серая панель с информацией */}
                  <div className="bg-gray-100 p-4 rounded-lg shadow-md flex-1">
                    <div className="flex gap-4">
                      {/* Изображение товара - кликабельное */}
                      <Link href={`/product/${item.product.slug}`} className="relative w-24 h-24 bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow flex-shrink-0">
                        {item.product.image_url ? (
                          <Image
                            src={getImageUrl(item.product.image_url)}
                            alt={item.product.name}
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ShoppingCart className="h-8 w-8" />
                          </div>
                        )}
                      </Link>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Наименование</span>
                          <span className="text-sm font-medium text-gray-600">Цена</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          {/* Название товара как кнопка */}
                          <Link href={`/product/${item.product.slug}`}>
                            <Button
                              variant="outline"
                              className="w-fit bg-gray-200 hover:bg-yellow-400 hover:text-black text-black font-medium shadow-sm"
                            >
                              {item.product.name}
                            </Button>
                          </Link>
                          
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              {(localQuantities[item.id] ?? item.quantity)}x{item.product.price.toLocaleString()} тг
                            </div>
                            
                            {/* Счетчик количества под ценой */}
                            <div className="flex items-center gap-2 mt-2 justify-end">
                              <span className="text-sm text-gray-600">Заказ (колич.)</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuantityChange(item.id, (localQuantities[item.id] ?? item.quantity) - 1)}
                                  disabled={(localQuantities[item.id] ?? item.quantity) <= 1}
                                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-black"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                
                                <input
                                  type="text"
                                  value={localQuantities[item.id] ?? item.quantity}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    // Разрешаем только цифры
                                    if (/^\d*$/.test(value)) {
                                      setLocalQuantities(prev => ({ ...prev, [item.id]: parseInt(value) || 0 }))
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const newQuantity = parseInt(e.target.value) || 1
                                    if (newQuantity >= 1 && newQuantity <= item.product.quantity_available && newQuantity !== item.quantity) {
                                      handleQuantityChange(item.id, newQuantity)
                                    } else if (newQuantity < 1) {
                                      // Если ввели 0 или пустое значение, возвращаем к исходному
                                      setLocalQuantities(prev => ({ ...prev, [item.id]: item.quantity }))
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const newQuantity = parseInt((e.target as HTMLInputElement).value) || 1
                                      if (newQuantity >= 1 && newQuantity <= item.product.quantity_available && newQuantity !== item.quantity) {
                                        handleQuantityChange(item.id, newQuantity)
                                      } else if (newQuantity < 1) {
                                        setLocalQuantities(prev => ({ ...prev, [item.id]: item.quantity }))
                                      }
                                    }
                                  }}
                                  className="w-12 text-center font-medium border-0 bg-transparent focus:outline-none"
                                  style={{ direction: 'ltr' }}
                                />
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuantityChange(item.id, (localQuantities[item.id] ?? item.quantity) + 1)}
                                  disabled={(localQuantities[item.id] ?? item.quantity) >= item.product.quantity_available}
                                  className="w-8 h-8 rounded-full bg-yellow-400 hover:bg-yellow-500 text-black"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Нижняя часть родительской карточки */}
                <div className="flex items-center justify-between mt-4">
                  {/* Логотип слева */}
                  <div className="flex items-center">
                    <img 
                      src="/ui/Logo.png" 
                      alt="Logo" 
                      className="h-8 w-8"
                    />
                  </div>
                  
                  {/* Кнопка удаления справа */}
                  <Button
                    variant="outline"
                    onClick={() => handleRemoveItem(item.id)}
                    className="bg-gray-200 hover:bg-white hover:text-red-600 hover:border-red-600 text-black shadow-sm rounded-full"
                  >
                    Удалить из корзины
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Итоги заказа */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4 shadow-md">
            <CardHeader>
              <CardTitle>Итоги заказа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Товары ({cartData.items_count})</span>
                <span>{cartData.total_amount.toLocaleString()} тг</span>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Итого</span>
                  <span>{cartData.total_amount.toLocaleString()} тг</span>
                </div>
              </div>


            </CardContent>
          </Card>

          {/* Форма оформления заказа */}
          <Card className="sticky top-4 mt-6 shadow-md">
            <CardHeader>
              <CardTitle>Оформление заказа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="customer_phone">Телефон *</Label>
                <Input
                  id="customer_phone"
                  value={orderForm.customer_phone}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                  placeholder="+7 (___) ___-__-__"
                  className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300"
                  style={{ outline: 'none', boxShadow: 'none' }}
                />
              </div>
              
              <div>
                <Label htmlFor="payment_method">Способ оплаты</Label>
                <Select
                  value={orderForm.payment_method}
                  onValueChange={(value) => setOrderForm(prev => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300" style={{ outline: 'none', boxShadow: 'none' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Наличными</SelectItem>
                    <SelectItem value="card">Картой</SelectItem>
                    <SelectItem value="transfer">Банковский перевод</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="delivery_method">Способ получения</Label>
                <Select
                  value={orderForm.delivery_method}
                  onValueChange={handleDeliveryMethodChange}
                >
                  <SelectTrigger className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300" style={{ outline: 'none', boxShadow: 'none' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">Самовывоз</SelectItem>
                    <SelectItem value="delivery">Доставка</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {orderForm.delivery_method === 'delivery' && (
                <div>
                  <Label htmlFor="delivery_address">Адрес доставки *</Label>
                  <Textarea
                    id="delivery_address"
                    value={orderForm.delivery_address}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, delivery_address: e.target.value }))}
                    placeholder="Укажите адрес доставки"
                    rows={3}
                    className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="customer_comment">Комментарий к заказу</Label>
                <Textarea
                  id="customer_comment"
                  value={orderForm.customer_comment}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, customer_comment: e.target.value }))}
                  placeholder="Дополнительные пожелания..."
                  rows={3}
                  className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300"
                  style={{ outline: 'none', boxShadow: 'none' }}
                />
              </div>



              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black shadow-md"
                size="lg"
                onClick={handleCreateOrder}
                disabled={isCreatingOrder || !orderForm.customer_phone.trim() || (orderForm.delivery_method === 'delivery' && !orderForm.delivery_address.trim())}
              >
                {isCreatingOrder ? 'Создание...' : 'Оформить заказ'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
