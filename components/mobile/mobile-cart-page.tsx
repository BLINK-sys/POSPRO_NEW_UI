"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Trash2, Plus, Minus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCart, updateCartItemQuantity, removeFromCart, clearCart } from "@/app/actions/cart"
import { createOrder } from "@/app/actions/orders"
import { getImageUrl } from "@/lib/image-utils"
import { formatProductPrice } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { useCart } from "@/context/cart-context"
import { toast } from "@/hooks/use-toast"

export default function MobileCartPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { updateCartCount, guestCartItems, updateGuestCartQuantity, removeFromGuestCart, clearGuestCart, isGuest } = useCart()
  const router = useRouter()

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [phone, setPhone] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [comment, setComment] = useState("")

  useEffect(() => {
    if (authLoading) return
    if (isGuest) {
      setLoading(false)
      return
    }
    loadCart()
    if (user?.phone && !phone) setPhone(user.phone)
  }, [user, authLoading])

  const loadCart = async () => {
    setLoading(true)
    try {
      const data = await getCart()
      if (data && Array.isArray(data.items)) {
        setItems(data.items)
      } else if (data && data.data && Array.isArray(data.data.items)) {
        setItems(data.data.items)
      } else {
        setItems([])
      }
    } catch (error) {
      console.error("Error loading cart:", error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 0) return
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ))
    try {
      const result = await updateCartItemQuantity(itemId, newQuantity)
      if (result.success) {
        updateCartCount()
      } else {
        loadCart()
      }
    } catch (error) {
      console.error("Error updating quantity:", error)
      loadCart()
    }
  }

  const handleRemove = async (itemId: number) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
    try {
      const result = await removeFromCart(itemId)
      if (result.success) {
        updateCartCount()
      } else {
        loadCart()
      }
    } catch (error) {
      console.error("Error removing item:", error)
      loadCart()
    }
  }

  const handleClear = async () => {
    if (isGuest) {
      clearGuestCart()
      return
    }
    setItems([])
    try {
      const result = await clearCart()
      if (result.success) {
        updateCartCount()
      } else {
        loadCart()
      }
    } catch (error) {
      console.error("Error clearing cart:", error)
      loadCart()
    }
  }

  const handleOrder = async () => {
    setSubmitting(true)
    try {
      const result = await createOrder({
        customer_name: user?.full_name || user?.ip_name || user?.too_name || "",
        customer_phone: phone,
        customer_email: user?.email || "",
        payment_method: paymentMethod,
        delivery_method: "pickup",
        delivery_address: "",
        customer_comment: comment || undefined,
      })
      if (result.success) {
        toast({ title: "Заказ оформлен!", description: `Заказ ${result.data?.order_number || ""} создан` })
        setItems([])
        updateCartCount()
        router.push("/profile/orders")
      } else {
        toast({ title: "Ошибка", description: result.message || "Не удалось оформить заказ", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось оформить заказ", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  // === ГОСТЕВАЯ КОРЗИНА (идентична авторизованной) ===
  if (isGuest) {
    const guestTotal = guestCartItems.reduce((sum, item) => sum + item.product_price * item.quantity, 0)

    if (guestCartItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <ShoppingCart className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Корзина пуста</h2>
          <p className="text-sm text-gray-500 mb-4 text-center">Добавьте товары из каталога</p>
          <Button className="bg-brand-yellow text-black hover:bg-yellow-500" onClick={() => router.push("/")}>
            Перейти в каталог
          </Button>
        </div>
      )
    }

    return (
      <div className="pb-4">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <h1 className="text-lg font-bold">Корзина ({guestCartItems.length})</h1>
          <Button variant="ghost" size="sm" className="text-red-500 text-xs h-8" onClick={() => clearGuestCart()}>
            Очистить
          </Button>
        </div>

        <div className="divide-y divide-gray-100">
          {guestCartItems.map((item) => (
            <div key={item.product_id} className="flex gap-3 px-4 py-3">
              <Link href={`/product/${item.product_slug}`} className="shrink-0">
                <div className="w-16 h-16 relative bg-gray-50 rounded-lg overflow-hidden">
                  {item.product_image_url ? (
                    <Image src={getImageUrl(item.product_image_url)} alt={item.product_name} fill className="object-contain p-1" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-lg">📦</div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2 leading-tight">{item.product_name}</p>
                <p className="text-sm font-bold text-green-600 mt-1">{formatProductPrice(item.product_price)}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateGuestCartQuantity(item.product_id, item.quantity - 1)} disabled={item.quantity <= 0}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateGuestCartQuantity(item.product_id, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeFromGuestCart(item.product_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Форма заказа */}
        <div className="px-4 py-4 space-y-3 border-t border-gray-200 mt-2">
          <h2 className="text-base font-semibold">Оформление заказа</h2>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Имя</label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Ваше имя" className="h-10" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Телефон</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" className="h-10" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Email</label>
            <Input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="email@example.com" className="h-10" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Способ оплаты</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Наличные</SelectItem>
                <SelectItem value="card">Картой</SelectItem>
                <SelectItem value="transfer">Перевод</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Способ получения</label>
            <div className="flex items-center h-10 px-3 border rounded-md bg-gray-50 text-sm">
              Самовывоз
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Комментарий</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Дополнительные пожелания" rows={2} />
          </div>
        </div>

        {/* Итого + кнопка заказа (sticky) */}
        <div className="sticky bottom-16 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-200 px-4 py-3 z-40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Итого:</span>
            <span className="text-lg font-bold">{formatProductPrice(guestTotal)}</span>
          </div>
          <Button
            className="w-full bg-brand-yellow text-black hover:bg-yellow-500 font-bold py-2.5 rounded-xl shadow-lg"
            disabled={!phone}
            onClick={() => {
              toast({ title: "Заказ принят", description: "Мы свяжемся с вами для подтверждения" })
            }}
          >
            Оформить заказ
          </Button>
        </div>
      </div>
    )
  }

  // === АВТОРИЗОВАННЫЙ ПОЛЬЗОВАТЕЛЬ ===
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <ShoppingCart className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Корзина пуста</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">Добавьте товары из каталога</p>
        <Button className="bg-brand-yellow text-black hover:bg-yellow-500" onClick={() => router.push("/")}>
          Перейти в каталог
        </Button>
      </div>
    )
  }

  const totalAmount = items.reduce((sum, item) => {
    const price = item.effective_price || item.product?.price || 0
    return sum + price * (item.quantity || 1)
  }, 0)

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <h1 className="text-lg font-bold">Корзина ({items.length})</h1>
        <Button variant="ghost" size="sm" className="text-red-500 text-xs h-8" onClick={handleClear}>
          Очистить
        </Button>
      </div>

      <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 px-4 py-3">
            <Link href={`/product/${item.product?.slug}`} className="shrink-0">
              <div className="w-16 h-16 relative bg-gray-50 rounded-lg overflow-hidden">
                {item.product?.image_url ? (
                  <Image src={getImageUrl(item.product.image_url)} alt={item.product.name} fill className="object-contain p-1" />
                ) : (
                  <div className="flex items-center justify-center h-full text-lg">📦</div>
                )}
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2 leading-tight">{item.product?.name}</p>
              <p className="text-sm font-bold text-green-600 mt-1">{formatProductPrice(item.effective_price || item.product?.price)}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, (item.quantity || 1) - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity || 1}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, (item.quantity || 1) + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleRemove(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Форма заказа */}
      <div className="px-4 py-4 space-y-3 border-t border-gray-200 mt-2">
        <h2 className="text-base font-semibold">Оформление заказа</h2>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Телефон</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" className="h-10" />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Способ оплаты</label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Наличные</SelectItem>
              <SelectItem value="card">Картой</SelectItem>
              <SelectItem value="transfer">Перевод</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Способ получения</label>
          <div className="flex items-center h-10 px-3 border rounded-md bg-gray-50 text-sm">
            Самовывоз
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Комментарий</label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Дополнительные пожелания" rows={2} />
        </div>
      </div>

      {/* Итого + кнопка заказа (sticky) */}
      <div className="sticky bottom-16 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-200 px-4 py-3 z-40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Итого:</span>
          <span className="text-lg font-bold">{formatProductPrice(totalAmount)}</span>
        </div>
        <Button
          className="w-full bg-brand-yellow text-black hover:bg-yellow-500 font-bold py-2.5 rounded-xl shadow-lg"
          disabled={submitting || !phone}
          onClick={handleOrder}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Оформить заказ
        </Button>
      </div>
    </div>
  )
}
