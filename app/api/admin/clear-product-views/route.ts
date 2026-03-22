import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export async function DELETE(request: NextRequest) {
  const token = cookies().get('jwt-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams.toString()
    const url = getApiUrl(`/api/clear-product-views${searchParams ? `?${searchParams}` : ''}`)

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error clearing product views:', error)
    return NextResponse.json({ error: 'Ошибка очистки' }, { status: 500 })
  }
}
