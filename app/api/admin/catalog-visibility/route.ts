import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export async function GET() {
  const token = cookies().get('jwt-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const response = await fetch(getApiUrl('/api/admin-catalog-visibility'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error fetching admin catalog visibility:', error)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const token = cookies().get('jwt-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const response = await fetch(getApiUrl('/api/admin-catalog-visibility'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error updating catalog visibility:', error)
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
  }
}
