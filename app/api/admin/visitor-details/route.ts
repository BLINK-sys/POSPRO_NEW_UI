import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export async function GET(request: NextRequest) {
  const token = cookies().get('jwt-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams.toString()
    const url = getApiUrl(`/api/visitor-details${searchParams ? `?${searchParams}` : ''}`)

    const response = await fetch(url, {
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
    console.error('Error proxying visitor details:', error)
    return NextResponse.json({ error: 'Ошибка загрузки данных' }, { status: 500 })
  }
}
