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
import { useCart } from '@/context/cart-context'
import { GuestCartItem } from '@/context/cart-context'
import { getImageUrl } from '@/lib/image-utils'
import { formatProductPrice } from '@/lib/utils'
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
  effective_price: number
  product: {
    id: number
    name: string
    slug: string
    price: number
    wholesale_price?: number | null
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
    delivery_method: 'pickup',
    payment_method: 'cash',
    customer_comment: ''
  })
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const { toast } = useToast()
  const { user } = useAuth()
  const { updateCartCount, guestCartItems, updateGuestCartQuantity, removeFromGuestCart, clearGuestCart, isGuest } = useCart()
  const isMobile = useIsMobile()

  useEffect(() => { setHydrated(true) }, [])

  const fetchCart = async () => {
    if (isGuest) {
      setIsLoading(false)
      return
    }
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

  useEffect(() => {
    fetchCart()

    // Заполняем форму данными пользователя
    if (user) {
      setOrderForm(prev => ({
        ...prev,
        customer_name: user.fullName || user.ipName || user.tooName || '',
        customer_phone: user.phone || '',
        customer_email: user.email || '',
      }))
    }
  }, [user])

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 0) return

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
              ? { ...item, quantity: newQuantity, total_price: item.effective_price * newQuantity }
              : item
          ),
          total_amount: prev.items.reduce((sum, item) =>
            sum + (item.id === itemId ? item.effective_price * newQuantity : item.total_price), 0
          )
        }
      })
    }

    // Отправляем на сервер в фоновом режиме
    try {
      const result = await updateCartItemQuantity(itemId, newQuantity)
      if (result.success) {
        await updateCartCount()
      } else {
        fetchCart()
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      fetchCart()
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить количество',
        variant: 'destructive'
      })
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    if (cartData) {
      const removedItem = cartData.items.find(item => item.id === itemId)
      if (removedItem) {
        setCartData(prev => {
          if (!prev) return prev
          const newItems = prev.items.filter(item => item.id !== itemId)
          return {
            ...prev,
            items: newItems,
            total_amount: newItems.reduce((sum, item) => sum + item.total_price, 0),
            items_count: newItems.length
          }
        })
        setLocalQuantities(prev => {
          const newQuantities = { ...prev }
          delete newQuantities[itemId]
          return newQuantities
        })
      }
    }

    try {
      const result = await removeFromCart(itemId)
      if (result.success) {
        await updateCartCount()
      } else {
        fetchCart()
        toast({ title: 'Ошибка', description: result.message, variant: 'destructive' })
      }
    } catch (error) {
      fetchCart()
      toast({ title: 'Ошибка', description: 'Не удалось удалить товар', variant: 'destructive' })
    }
  }

  const handleClearCart = async () => {
    if (isGuest) {
      clearGuestCart()
      return
    }

    setCartData(prev => {
      if (!prev) return prev
      return { ...prev, items: [], total_amount: 0, items_count: 0 }
    })
    setLocalQuantities({})

    try {
      const result = await clearCart()
      if (result.success) {
        await updateCartCount()
      } else {
        fetchCart()
        toast({ title: 'Ошибка', description: result.message, variant: 'destructive' })
      }
    } catch (error) {
      fetchCart()
      toast({ title: 'Ошибка', description: 'Не удалось очистить корзину', variant: 'destructive' })
    }
  }

  const handleCreateOrder = async () => {
    setIsCreatingOrder(true)
    try {
      const result = await createOrder({
        ...orderForm,
        delivery_address: '',
      })
      if (result.success) {
        toast({
          title: 'Успешно',
          description: `Заказ ${result.data.order_number} создан!`
        })
        fetchCart()
        await updateCartCount()
      } else {
        toast({ title: 'Ошибка', description: result.message, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось создать заказ', variant: 'destructive' })
    } finally {
      setIsCreatingOrder(false)
    }
  }

  // Ждём пока определится isMobile (чтобы гости не видели десктопную верстку на мобильном)
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-12">
        <ShoppingCart className="h-6 w-6 animate-pulse text-gray-300" />
      </div>
    )
  }

  if (isMobile) return <MobileCartPage />

  // === ГОСТЕВАЯ КОРЗИНА (идентична авторизованной) ===
  if (isGuest) {
    const guestTotal = guestCartItems.reduce((sum, item) => sum + item.product_price * item.quantity, 0)

    if (guestCartItems.length === 0) {
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
                <Link href="/">Перейти к покупкам</Link>
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
            <Badge variant="secondary">{guestCartItems.length} товаров</Badge>
          </div>
          <Button
            variant="outline"
            onClick={() => clearGuestCart()}
            className="bg-gray-200 hover:bg-white hover:text-red-600 hover:border-red-600 text-black shadow-sm rounded-full"
          >
            Очистить корзину
          </Button>
        </div>

        <div className="border-b border-gray-200 mb-6"></div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {guestCartItems.map((item) => (
              <Card key={item.product_id} className="shadow-md">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="bg-gray-100 p-4 rounded-lg shadow-md flex-1">
                      <div className="flex gap-4">
                        <Link href={`/product/${item.product_slug}`} className="relative w-24 h-24 bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow flex-shrink-0">
                          {item.product_image_url ? (
                            <Image
                              src={getImageUrl(item.product_image_url)}
                              alt={item.product_name}
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

                          <div className="flex items-center justify-between gap-3">
                            <Link href={`/product/${item.product_slug}`} className="min-w-0 flex-1">
                              <div className="inline-flex items-center h-10 px-4 py-2 rounded-md border border-input bg-gray-200 hover:bg-yellow-400 hover:text-black text-black text-sm font-medium shadow-sm transition-colors w-full overflow-hidden">
                                <span className="truncate">{item.product_name}</span>
                              </div>
                            </Link>

                            <div className="text-right shrink-0">
                              <div className="text-lg font-semibold whitespace-nowrap">
                                {item.quantity}x{formatProductPrice(item.product_price)}
                              </div>

                              <div className="flex items-center gap-2 mt-2 justify-end">
                                <span className="text-sm text-gray-600">Кол-во</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateGuestCartQuantity(item.product_id, item.quantity - 1)}
                                    disabled={item.quantity <= 0}
                                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-black"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateGuestCartQuantity(item.product_id, item.quantity + 1)}
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

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center">
                      <img src="/ui/Logo.png" alt="Logo" className="h-8 w-8" />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => removeFromGuestCart(item.product_id)}
                      className="bg-gray-200 hover:bg-white hover:text-red-600 hover:border-red-600 text-black shadow-sm rounded-full"
                    >
                      Удалить из корзины
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4 shadow-md">
              <CardHeader>
                <CardTitle>Итоги заказа</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Товары ({guestCartItems.length})</span>
                  <span>{guestTotal.toLocaleString()} тг</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Итого</span>
                    <span>{guestTotal.toLocaleString()} тг</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="sticky top-4 mt-6 shadow-md">
              <CardHeader>
                <CardTitle>Оформление заказа</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="guest_name">Имя</Label>
                  <Input
                    id="guest_name"
                    value={orderForm.customer_name}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Ваше имя"
                    className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                </div>

                <div>
                  <Label htmlFor="guest_phone">Телефон *</Label>
                  <Input
                    id="guest_phone"
                    value={orderForm.customer_phone}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="+7 (___) ___-__-__"
                    className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                </div>

                <div>
                  <Label htmlFor="guest_email">Email</Label>
                  <Input
                    id="guest_email"
                    value={orderForm.customer_email}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, customer_email: e.target.value }))}
                    placeholder="email@example.com"
                    className="focus:outline-none focus:shadow-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                </div>

                <div>
                  <Label htmlFor="guest_payment">Способ оплаты</Label>
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
                  <Label htmlFor="guest_delivery">Способ получения</Label>
                  <div className="flex items-center h-10 px-3 border rounded-md bg-gray-50 text-sm">
                    Самовывоз
                  </div>
                </div>

                <div>
                  <Label htmlFor="guest_comment">Комментарий к заказу</Label>
                  <Textarea
                    id="guest_comment"
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
                  disabled={!orderForm.customer_phone.trim()}
                  onClick={() => {
                    toast({ title: 'Заказ принят', description: 'Мы свяжемся с вами для подтверждения' })
                  }}
                >
                  Оформить заказ
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // === АВТОРИЗОВАННЫЙ ПОЛЬЗОВАТЕЛЬ ===
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
              <Link href="/">Перейти к покупкам</Link>
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

      <div className="border-b border-gray-200 mb-6"></div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Список товаров */}
        <div className="lg:col-span-2 space-y-4">
          {cartData.items.map((item) => (
            <Card key={item.id} className="shadow-md">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="bg-gray-100 p-4 rounded-lg shadow-md flex-1">
                    <div className="flex gap-4">
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

                        <div className="flex items-center justify-between gap-3">
                          <Link href={`/product/${item.product.slug}`} className="min-w-0 flex-1">
                            <div className="inline-flex items-center h-10 px-4 py-2 rounded-md border border-input bg-gray-200 hover:bg-yellow-400 hover:text-black text-black text-sm font-medium shadow-sm transition-colors w-full overflow-hidden">
                              <span className="truncate">{item.product.name}</span>
                            </div>
                          </Link>

                          <div className="text-right shrink-0">
                            <div className="text-lg font-semibold whitespace-nowrap">
                              {(localQuantities[item.id] ?? item.quantity)}x{item.effective_price.toLocaleString()} тг
                            </div>

                            <div className="flex items-center gap-2 mt-2 justify-end">
                              <span className="text-sm text-gray-600">Заказ (колич.)</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuantityChange(item.id, (localQuantities[item.id] ?? item.quantity) - 1)}
                                  disabled={(localQuantities[item.id] ?? item.quantity) <= 0}
                                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-black"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>

                                <input
                                  type="text"
                                  value={localQuantities[item.id] ?? item.quantity}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (/^\d*$/.test(value)) {
                                      setLocalQuantities(prev => ({ ...prev, [item.id]: parseInt(value) || 0 }))
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const newQuantity = parseInt(e.target.value) || 0
                                    if (newQuantity >= 0 && newQuantity !== item.quantity) {
                                      handleQuantityChange(item.id, newQuantity)
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const newQuantity = parseInt((e.target as HTMLInputElement).value) || 0
                                      if (newQuantity >= 0 && newQuantity !== item.quantity) {
                                        handleQuantityChange(item.id, newQuantity)
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

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center">
                    <img src="/ui/Logo.png" alt="Logo" className="h-8 w-8" />
                  </div>
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
                <div className="flex items-center h-10 px-3 border rounded-md bg-gray-50 text-sm">
                  Самовывоз
                </div>
              </div>

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
                disabled={isCreatingOrder || !orderForm.customer_phone.trim()}
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
