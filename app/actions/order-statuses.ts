'use server'

import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export interface OrderStatus {
  id: number
  name: string
  description?: string
  background_color: string
  text_color: string
  order: number
  is_active: boolean
  is_final: boolean
}

export interface CreateOrderStatusData {
  name: string
  description?: string
  background_color: string
  text_color: string
  order?: number
  is_active?: boolean
  is_final?: boolean
}

export async function getOrderStatuses() {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/admin/order-statuses')}`, {
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
    console.error('Ошибка получения статусов заказов:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении статусов заказов' 
    }
  }
}

export async function createOrderStatus(statusData: CreateOrderStatusData) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/admin/order-statuses')}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusData),
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка создания статуса заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при создании статуса заказа' 
    }
  }
}

export async function updateOrderStatus(statusId: number, statusData: Partial<CreateOrderStatusData>) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/order-statuses/${statusId}`)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusData),
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка обновления статуса заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при обновлении статуса заказа' 
    }
  }
}

export async function deleteOrderStatus(statusId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/order-statuses/${statusId}`)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка удаления статуса заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при удалении статуса заказа' 
    }
  }
}

export async function getPublicOrderStatuses() {
  try {
    const response = await fetch(`${getApiUrl('/api/admin/order-statuses/public')}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка получения публичных статусов заказов:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении статусов заказов' 
    }
  }
}
