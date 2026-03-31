import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

// GET /api/kp-logos — list user's logos
export async function GET() {
  const token = (await cookies()).get('jwt-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const response = await fetch(getApiUrl('/api/kp-logos'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error listing KP logos:', error)
    return NextResponse.json({ error: 'Ошибка загрузки логотипов' }, { status: 500 })
  }
}

// POST /api/kp-logos — upload a logo
export async function POST(request: NextRequest) {
  const token = (await cookies()).get('jwt-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const formData = await request.formData()

    const response = await fetch(getApiUrl('/api/kp-logos/upload'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error uploading KP logo:', error)
    return NextResponse.json({ error: 'Ошибка загрузки логотипа' }, { status: 500 })
  }
}
