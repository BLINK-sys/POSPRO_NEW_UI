"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { getCartCount } from '@/app/actions/cart'
import { useAuth } from '@/context/auth-context'

const GUEST_CART_KEY = 'guest-cart'

export interface GuestCartItem {
  product_id: number
  product_name: string
  product_slug: string
  product_price: number
  product_image_url: string | null
  product_article: string
  quantity: number
}

interface CartContextType {
  cartCount: number
  updateCartCount: () => Promise<void>
  incrementCartCount: () => void
  decrementCartCount: () => void
  setCartCount: (count: number) => void
  // Guest cart methods
  guestCartItems: GuestCartItem[]
  addToGuestCart: (item: Omit<GuestCartItem, 'quantity'>, quantity?: number) => void
  updateGuestCartQuantity: (productId: number, quantity: number) => void
  removeFromGuestCart: (productId: number) => void
  clearGuestCart: () => void
  isGuest: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function getGuestCartFromStorage(): GuestCartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(GUEST_CART_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveGuestCartToStorage(items: GuestCartItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  } catch {
    // localStorage may be full or disabled
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0)
  const [guestCartItems, setGuestCartItems] = useState<GuestCartItem[]>([])
  const { user } = useAuth()

  const isGuest = !user

  // Load guest cart from localStorage on mount
  useEffect(() => {
    setGuestCartItems(getGuestCartFromStorage())
  }, [])

  // Sync guest cart count
  useEffect(() => {
    if (isGuest) {
      setCartCount(guestCartItems.reduce((sum, item) => sum + item.quantity, 0))
    }
  }, [guestCartItems, isGuest])

  const updateCartCount = useCallback(async () => {
    if (!user || user.role !== 'client') {
      if (isGuest) {
        // Guest cart count is handled by the effect above
        return
      }
      setCartCount(0)
      return
    }

    try {
      const result = await getCartCount()
      if (result.success) {
        setCartCount(result.data.count)
      } else {
        setCartCount(0)
      }
    } catch (error) {
      console.error('Error loading cart count:', error)
      setCartCount(0)
    }
  }, [user, isGuest])

  const incrementCartCount = () => {
    setCartCount(prev => prev + 1)
  }

  const decrementCartCount = () => {
    setCartCount(prev => Math.max(0, prev - 1))
  }

  // Guest cart methods
  const addToGuestCart = useCallback((item: Omit<GuestCartItem, 'quantity'>, quantity: number = 1) => {
    setGuestCartItems(prev => {
      const existing = prev.find(i => i.product_id === item.product_id)
      let updated: GuestCartItem[]
      if (existing) {
        updated = prev.map(i =>
          i.product_id === item.product_id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      } else {
        updated = [...prev, { ...item, quantity }]
      }
      saveGuestCartToStorage(updated)
      return updated
    })
  }, [])

  const updateGuestCartQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity < 0) return
    setGuestCartItems(prev => {
      const updated = prev.map(i =>
        i.product_id === productId ? { ...i, quantity } : i
      )
      saveGuestCartToStorage(updated)
      return updated
    })
  }, [])

  const removeFromGuestCart = useCallback((productId: number) => {
    setGuestCartItems(prev => {
      const updated = prev.filter(i => i.product_id !== productId)
      saveGuestCartToStorage(updated)
      return updated
    })
  }, [])

  const clearGuestCart = useCallback(() => {
    setGuestCartItems([])
    saveGuestCartToStorage([])
  }, [])

  // Load server cart count when user changes
  useEffect(() => {
    if (user && user.role === 'client') {
      updateCartCount()
    } else if (isGuest) {
      // Guest count comes from localStorage
      setGuestCartItems(getGuestCartFromStorage())
    } else {
      setCartCount(0)
    }
  }, [user])

  const value: CartContextType = {
    cartCount,
    updateCartCount,
    incrementCartCount,
    decrementCartCount,
    setCartCount,
    guestCartItems,
    addToGuestCart,
    updateGuestCartQuantity,
    removeFromGuestCart,
    clearGuestCart,
    isGuest
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
