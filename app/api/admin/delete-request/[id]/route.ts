import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('jwt-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const response = await fetch(getApiUrl(`/api/delete-request/${params.id}`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error deleting request:', error)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
