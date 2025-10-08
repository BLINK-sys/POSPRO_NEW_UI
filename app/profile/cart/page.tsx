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
    
    setIsUpdating(itemId)
    try {
      const result = await updateCartItemQuantity(itemId, newQuantity)
      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Количество товара обновлено'
        })
        fetchCart() // Перезагружаем корзину
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
        description: 'Не удалось обновить количество',
        variant: 'destructive'
      })
    } finally {
      setIsUpdating(null)
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    try {
      const result = await removeFromCart(itemId)
      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Товар удален из корзины'
        })
        fetchCart() // Перезагружаем корзину
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
        description: 'Не удалось удалить товар',
        variant: 'destructive'
      })
    }
  }

  const handleClearCart = async () => {
    try {
      const result = await clearCart()
      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Корзина очищена'
        })
        fetchCart() // Перезагружаем корзину
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Корзина</h1>
          <Badge variant="secondary">{cartData.items_count} товаров</Badge>
        </div>
        
        <Button 
          variant="outline" 
          onClick={handleClearCart}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Очистить корзину
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Список товаров */}
        <div className="lg:col-span-2 space-y-4">
          {cartData.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* Изображение товара */}
                  <div className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                    {item.product.image_url ? (
                      <Image
                        src={item.product.image_url}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ShoppingCart className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    {/* Информация о товаре */}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Link href={`/product/${item.product.slug}`}>
                          <h3 className="font-semibold hover:text-blue-600 transition-colors">
                            {item.product.name}
                          </h3>
                        </Link>
                        <p className="text-sm text-gray-600">Артикул: {item.product.article}</p>
                        {item.product.status && (
                          <Badge 
                            className="mt-1 text-xs"
                            style={{
                              backgroundColor: item.product.status.background_color,
                              color: item.product.status.text_color
                            }}
                          >
                            {item.product.status.name}
                          </Badge>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Количество и цена */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || isUpdating === item.id}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        
                        <span className="w-12 text-center font-medium">
                          {item.quantity}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.quantity_available || isUpdating === item.id}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        
                        <span className="text-sm text-gray-600 ml-2">
                          (доступно: {item.product.quantity_available})
                        </span>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          {item.total_price.toLocaleString()} тг
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.product.price.toLocaleString()} тг за шт.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Итоги заказа */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
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
          <Card className="sticky top-4 mt-6">
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
                />
              </div>
              
              <div>
                <Label htmlFor="payment_method">Способ оплаты</Label>
                <Select
                  value={orderForm.payment_method}
                  onValueChange={(value) => setOrderForm(prev => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                />
              </div>



              <Button 
                className="w-full"
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
