'use server'

import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export interface CreateOrderData {
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  delivery_address?: string
  delivery_method?: string
  payment_method?: string
  customer_comment?: string
}

export async function createOrder(orderData: CreateOrderData) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/orders')}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка создания заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при создании заказа' 
    }
  }
}

export async function getOrders(page: number = 1, perPage: number = 10, orderType: 'active' | 'completed' | 'all' = 'active') {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    console.log(`DEBUG: Запрос заказов - page: ${page}, perPage: ${perPage}, orderType: ${orderType}`)
    const response = await fetch(`${getApiUrl(`/api/orders?page=${page}&per_page=${perPage}&type=${orderType}`)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка получения заказов:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении заказов' 
    }
  }
}

export async function getOrder(orderId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/orders/${orderId}`)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка получения заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении заказа' 
    }
  }
}

export async function cancelOrder(orderId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/orders/${orderId}/cancel`)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка отмены заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при отмене заказа' 
    }
  }
}
