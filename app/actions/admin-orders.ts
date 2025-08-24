'use server'

import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export interface AdminOrder {
  id: number
  order_number: string
  user_id: number
  status_id: number
  status_info: {
    id: number
    name: string
    background_color: string
    text_color: string
    is_final: boolean
  }
  payment_status: string
  payment_method: string
  subtotal: number
  total_amount: number
  customer_name: string
  customer_phone: string
  customer_email: string
  delivery_address?: string
  delivery_method: string
  customer_comment?: string
  admin_comment?: string
  created_at: string
  updated_at: string
  items_count: number
  user: {
    id: number
    email: string
    phone: string
    name: string
  }
  manager?: {
    id: number
    manager_id: number
    assigned_at: string
    manager: {
      id: number
      full_name: string
      email: string
      phone: string
    }
  }
}

export interface Manager {
  id: number
  full_name: string
  email: string
  phone: string
}

export interface OrderStatus {
  id: number
  name: string
  background_color: string
  text_color: string
  is_final: boolean
}

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  product_name: string
  product_article: string
  quantity: number
  price_per_item: number
  total_price: number
  product_price_at_order: number
  current_product?: {
    id: number
    name: string
    slug: string
    current_price: number
    image_url?: string
    is_visible: boolean
  }
}

// Получить все заказы для админки
export async function getAdminOrders(page: number = 1, perPage: number = 20) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders?page=${page}&per_page=${perPage}`)}`, {
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

// Получить список менеджеров
export async function getManagers() {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/admin/managers')}`, {
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
    console.error('Ошибка получения списка менеджеров:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении списка менеджеров' 
    }
  }
}

// Назначить менеджера на заказ
export async function assignManager(orderId: number, managerId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/${orderId}/assign-manager`)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manager_id: managerId }),
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка назначения менеджера:', error)
    return { 
      success: false, 
      message: 'Ошибка при назначении менеджера' 
    }
  }
}

// Обновить статус заказа
export async function updateOrderStatus(orderId: number, statusId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/${orderId}/status`)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status_id: statusId }),
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

// Обновить статус оплаты
export async function updatePaymentStatus(orderId: number, paymentStatus: string) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/${orderId}/payment-status`)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment_status: paymentStatus }),
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка обновления статуса оплаты:', error)
    return { 
      success: false, 
      message: 'Ошибка при обновлении статуса оплаты' 
    }
  }
}

// Получить детали заказа для админки
export async function getOrderDetails(orderId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/${orderId}`)}`, {
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
    console.error('Ошибка получения деталей заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении деталей заказа' 
    }
  }
}

// Принять заказ текущим менеджером
export async function acceptOrder(orderId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/${orderId}/accept`)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка принятия заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при принятии заказа' 
    }
  }
}

// Передать заказ другому менеджеру
export async function transferOrder(orderId: number, managerId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/${orderId}/transfer`)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manager_id: managerId }),
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка передачи заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при передаче заказа' 
    }
  }
}

// Получить товары заказа из order_items
export async function getOrderItems(orderId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/${orderId}/items`)}`, {
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
    console.error('Ошибка получения товаров заказа:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении товаров заказа' 
    }
  }
}

// Получить новые заказы (без назначенного менеджера)
export async function getNewOrders(page: number = 1, perPage: number = 20) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/orders/new?page=${page}&per_page=${perPage}`)}`, {
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
    console.error('Ошибка получения новых заказов:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении новых заказов' 
    }
  }
}

// Получить заказы текущего менеджера с фильтрацией
export async function getMyOrders(
  page: number = 1, 
  perPage: number = 20,
  statusId?: number,
  search?: string
) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    })
    
    if (statusId) {
      params.append('status_id', statusId.toString())
    }
    
    if (search) {
      params.append('search', search)
    }

    const response = await fetch(`${getApiUrl(`/api/admin/orders/my?${params.toString()}`)}`, {
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
    console.error('Ошибка получения моих заказов:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении моих заказов' 
    }
  }
}

// Получить завершенные заказы текущего менеджера с фильтрацией
export async function getCompletedOrders(
  page: number = 1, 
  perPage: number = 20,
  statusId?: number,
  search?: string
) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    })
    
    if (statusId) {
      params.append('status_id', statusId.toString())
    }
    
    if (search) {
      params.append('search', search)
    }

    const response = await fetch(`${getApiUrl(`/api/admin/orders/completed?${params.toString()}`)}`, {
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
    console.error('Ошибка получения завершенных заказов:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении завершенных заказов' 
    }
  }
}
