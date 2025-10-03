'use server'

import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export interface ProductAvailabilityStatus {
  id: number
  status_name: string
  condition_operator: string
  condition_value: number
  background_color: string
  text_color: string
  order: number
  active: boolean
}

export interface CreateProductAvailabilityStatusData {
  status_name: string
  condition_operator: string
  condition_value: number
  background_color: string
  text_color: string
  order?: number
  active?: boolean
}

export async function getProductAvailabilityStatuses() {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/admin/product-availability-statuses')}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { 
        success: false, 
        message: errorData.message || `HTTP error! status: ${response.status}` 
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Ошибка получения статусов наличия:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении статусов наличия' 
    }
  }
}

export async function createProductAvailabilityStatus(statusData: CreateProductAvailabilityStatusData) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    console.log('Отправляемые данные:', JSON.stringify(statusData, null, 2))
    
    const response = await fetch(`${getApiUrl('/api/admin/product-availability-statuses')}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusData),
      cache: 'no-store'
    })

    console.log('Статус ответа:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.log('Ошибка от сервера:', errorData)
      return { 
        success: false, 
        message: errorData.error || errorData.message || `HTTP error! status: ${response.status}` 
      }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка создания статуса наличия:', error)
    return { 
      success: false, 
      message: 'Ошибка при создании статуса наличия' 
    }
  }
}

export async function updateProductAvailabilityStatus(statusId: number, statusData: Partial<CreateProductAvailabilityStatusData>) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/product-availability-statuses/${statusId}`)}`, {
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
    console.error('Ошибка обновления статуса наличия:', error)
    return { 
      success: false, 
      message: 'Ошибка при обновлении статуса наличия' 
    }
  }
}

export async function deleteProductAvailabilityStatus(statusId: number) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl(`/api/admin/product-availability-statuses/${statusId}`)}`, {
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
    console.error('Ошибка удаления статуса наличия:', error)
    return { 
      success: false, 
      message: 'Ошибка при удалении статуса наличия' 
    }
  }
}

export async function reorderProductAvailabilityStatuses(statuses: { id: number; order: number }[]) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/admin/product-availability-statuses/reorder')}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ statuses }),
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка изменения порядка статусов наличия:', error)
    return { 
      success: false, 
      message: 'Ошибка при изменении порядка статусов наличия' 
    }
  }
}

export async function getStatusForQuantity(quantity: number) {
  try {
    const response = await fetch(`${getApiUrl(`/api/admin/product-availability-statuses/check/${quantity}`)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Ошибка получения статуса для количества:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении статуса для количества' 
    }
  }
}
