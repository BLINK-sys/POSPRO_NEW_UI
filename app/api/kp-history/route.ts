import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

const BACKEND_ENDPOINT = '/api/kp-history'

export async function GET(request: NextRequest) {
  const token = cookies().get('jwt-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    // Пробрасываем фильтры на бэк: ?filter=mine|shared|user&user_id=N
    const search = new URL(request.url).search
    const url = getApiUrl(BACKEND_ENDPOINT) + (search || '')

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
    console.error('Error proxying KP history GET:', error)
    return NextResponse.json({ error: 'Ошибка загрузки истории КП' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const token = cookies().get('jwt-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const response = await fetch(getApiUrl(BACKEND_ENDPOINT), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error proxying KP history POST:', error)
    return NextResponse.json({ error: 'Ошибка сохранения КП' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const token = cookies().get('jwt-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID не указан' }, { status: 400 })
    }

    const response = await fetch(getApiUrl(`${BACKEND_ENDPOINT}/${id}`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error proxying KP history DELETE:', error)
    return NextResponse.json({ error: 'Ошибка удаления КП' }, { status: 500 })
  }
}
