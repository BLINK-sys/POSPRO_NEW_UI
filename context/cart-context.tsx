"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getCartCount } from '@/app/actions/cart'
import { useAuth } from '@/context/auth-context'

interface CartContextType {
  cartCount: number
  updateCartCount: () => Promise<void>
  incrementCartCount: () => void
  decrementCartCount: () => void
  setCartCount: (count: number) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0)
  const { user } = useAuth()

  const updateCartCount = async () => {
    // Только для авторизованных клиентов
    if (!user || user.role !== 'client') {
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
  }

  const incrementCartCount = () => {
    setCartCount(prev => prev + 1)
  }

  const decrementCartCount = () => {
    setCartCount(prev => Math.max(0, prev - 1))
  }

  // Загружаем количество товаров при изменении пользователя
  useEffect(() => {
    updateCartCount()
  }, [user])

  const value: CartContextType = {
    cartCount,
    updateCartCount,
    incrementCartCount,
    decrementCartCount,
    setCartCount
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
