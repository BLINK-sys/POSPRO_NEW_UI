'use client'

import { useState, useEffect, useRef } from 'react'
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
import Link from 'next/link'
import Image from 'next/image'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  const [editingQuantity, setEditingQuantity] = useState<number | null>(null)
  const [tempQuantity, setTempQuantity] = useState<string>('')

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
    setCartData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                quantity: newQuantity, 
                total_price: item.product.price * newQuantity 
              }
            : item
        ),
        total_amount: prev.items.reduce((sum, item) => 
          sum + (item.id === itemId ? item.product.price * newQuantity : item.total_price), 0
        )
      }
    })
    
    setIsUpdating(itemId)
    try {
      const result = await updateCartItemQuantity(itemId, newQuantity)
      if (result.success) {
        // Обновляем счетчик в header без уведомления
        await updateCartCount()
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
    } finally {
      setIsUpdating(null)
    }
  }

  // Функция для начала редактирования количества
  const startEditingQuantity = (itemId: number, currentQuantity: number) => {
    setEditingQuantity(itemId)
    setTempQuantity(currentQuantity.toString())
  }

  // Функция для завершения редактирования количества
  const finishEditingQuantity = async (itemId: number) => {
    const newQuantity = parseInt(tempQuantity)
    
    if (isNaN(newQuantity) || newQuantity < 1) {
      // Если введено некорректное значение, возвращаем исходное
      const item = cartData?.items.find(item => item.id === itemId)
      if (item) {
        setTempQuantity(item.quantity.toString())
      }
      setEditingQuantity(null)
      return
    }

    setEditingQuantity(null)
    await handleQuantityChange(itemId, newQuantity)
  }

  // Функция для обработки нажатия Enter
  const handleQuantityKeyPress = (e: React.KeyboardEvent, itemId: number) => {
    if (e.key === 'Enter') {
      finishEditingQuantity(itemId)
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    // Оптимистичное обновление UI
    const removedItem = cartData?.items.find(item => item.id === itemId)
    setCartData(prev => {
      if (!prev) return prev
      const updatedItems = prev.items.filter(item => item.id !== itemId)
      return {
        ...prev,
        items: updatedItems,
        items_count: updatedItems.length,
        total_amount: updatedItems.reduce((sum, item) => sum + item.total_price, 0)
      }
    })
    
    try {
      const result = await removeFromCart(itemId)
      if (result.success) {
        // Обновляем счетчик в header без уведомления
        await updateCartCount()
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
    // Оптимистичное обновление UI
    setCartData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: [],
        items_count: 0,
        total_amount: 0
      }
    })
    
    try {
      const result = await clearCart()
      if (result.success) {
        // Обновляем счетчик в header без уведомления
        await updateCartCount()
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Корзина</h1>
          <Badge variant="secondary">{cartData.items_count} товаров</Badge>
        </div>
          <Button 
            onClick={handleClearCart}
            className="h-10 px-5 rounded-full font-medium bg-gray-200 text-black border border-transparent hover:bg-white hover:text-red-600 hover:border-red-600 hover:shadow-md"
          >
            Очистить корзину
          </Button>
      </div>
        <div className="border-b border-gray-200 mb-6" />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Список товаров */}
        <div className="lg:col-span-2 space-y-4">
          {cartData.items.map((item) => (
            <Card key={item.id} className="shadow-md">
              <CardContent className="p-6">
                {/* Основная зона карточки */}
                <div className="flex gap-4 bg-gray-100 rounded-xl p-4 min-h-[7rem] shadow-md">
                  {/* Изображение товара */}
                  <Link href={`/product/${item.product.slug}`} className="relative bg-white rounded-lg overflow-hidden flex-shrink-0 w-32 h-28 md:w-36 md:h-32 shadow hover:shadow-md transition-shadow cursor-pointer">
                    {item.product.image_url ? (
                      <Image
                        src={item.product.image_url.startsWith('/uploads/') ? `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://pospro-new-server.onrender.com'}${item.product.image_url}` : item.product.image_url}
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

                  {/* Информация и статус */}
                  <div className="flex-1 flex flex-col justify-start">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Наименование</div>
                    <div className="flex-1 flex items-center">
                      <Button asChild variant="outline" className="inline-flex w-fit h-auto px-3 py-1 bg-gray-200 text-black hover:bg-[#FDBD00] hover:text-black border-0 rounded-md shadow-sm">
                        <Link href={`/product/${item.product.slug}`}>
                          {item.product.name}
                        </Link>
                      </Button>
                    </div>
                    {/* Статус у названия скрыт по требованию дизайна */}
                  </div>

                  {/* Блок цены справа */}
                  <div className="flex flex-col items-end justify-start min-w-[220px]">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Цена</div>
                    <div className="text-2xl font-semibold tracking-wide">
                      {item.total_price.toLocaleString()} тг
                    </div>
                    {/* Счётчик под ценой */}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-gray-500 mr-1">Заказ (колич.)</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1 || isUpdating === item.id}
                        className="h-9 w-9 rounded-full bg-gray-200 text-black border-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      {editingQuantity === item.id ? (
                        <input
                          type="text"
                          value={tempQuantity}
                          onChange={(e) => setTempQuantity(e.target.value)}
                          onBlur={() => finishEditingQuantity(item.id)}
                          onKeyPress={(e) => handleQuantityKeyPress(e, item.id)}
                          className="w-10 text-center font-semibold text-black outline-none border-none bg-transparent rounded"
                          style={{ direction: 'ltr', textAlign: 'center' }}
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="w-8 text-center font-semibold text-black cursor-pointer hover:bg-gray-100 rounded"
                          onClick={() => startEditingQuantity(item.id, item.quantity)}
                        >
                          {item.quantity}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.quantity_available || isUpdating === item.id}
                        className="h-9 w-9 rounded-full bg-[#FDBD00] text-black border-0 hover:brightness-95"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Нижняя панель управления */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <Link href={`/product/${item.product.slug}`} aria-label="Открыть страницу товара">
                      <div className="h-8 w-8 rounded-md overflow-hidden flex items-center justify-center">
                        {/* Логотип-стрелка прижат слева и уменьшен */}
                        <Image src="/ui/Logo.png" alt="Open" width={28} height={28} />
                      </div>
                    </Link>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => handleRemoveItem(item.id)}
                      className="h-10 px-5 rounded-full font-medium bg-gray-200 text-black border border-transparent hover:bg-white hover:text-red-600 hover:border-red-600 hover:shadow-md"
                    >
                      Убрать из корзины
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Итоги заказа */}
        <div className="lg:col-span-1 lg:sticky lg:top-4 h-fit">
          <Card className="shadow-md">
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
          <Card className="mt-6 shadow-md">
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
                  className="focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 shadow-none"
                />
              </div>
              
              <div>
                <Label htmlFor="payment_method">Способ оплаты</Label>
                <Select
                  value={orderForm.payment_method}
                  onValueChange={(value) => setOrderForm(prev => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger className="focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 shadow-none">
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
                  <SelectTrigger className="focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 shadow-none">
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
                    className="focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 shadow-none"
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
                  className="focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 shadow-none"
                />
              </div>



              <Button 
                className="group w-full bg-[#FDBD00] text-black shadow-md hover:bg-[#FDBD00] hover:text-black hover:shadow-lg"
                size="lg"
                onClick={handleCreateOrder}
                disabled={isCreatingOrder || !orderForm.customer_phone.trim() || (orderForm.delivery_method === 'delivery' && !orderForm.delivery_address.trim())}
              >
                {isCreatingOrder ? 'Создание...' : 'Оформить заказ'}
                <ArrowRight className="h-4 w-4 ml-2 opacity-0 transition-opacity group-hover:opacity-100" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
