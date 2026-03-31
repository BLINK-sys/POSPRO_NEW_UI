import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiUrl } from '@/lib/api-address'

// DELETE /api/kp-logos/[filename] — delete a logo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const token = (await cookies()).get('jwt-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { filename } = await params

  try {
    const response = await fetch(getApiUrl(`/api/kp-logos/${encodeURIComponent(filename)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error deleting KP logo:', error)
    return NextResponse.json({ error: 'Ошибка удаления логотипа' }, { status: 500 })
  }
}
