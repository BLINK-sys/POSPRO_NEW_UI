'use server'

import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export async function reorderOrderStatuses(statusIds: number[]) {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')

  if (!token) {
    return { success: false, error: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/admin/order-statuses/reorder')}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status_ids: statusIds }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      return { success: true }
    } else {
      return { success: false, error: data.message || 'Ошибка при изменении порядка' }
    }
  } catch (error) {
    console.error('Error reordering statuses:', error)
    return { success: false, error: 'Ошибка сети' }
  }
}
