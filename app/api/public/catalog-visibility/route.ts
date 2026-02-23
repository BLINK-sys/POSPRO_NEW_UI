import { NextResponse } from 'next/server'
import { getApiUrl } from '@/lib/api-address'

export async function GET() {
  try {
    const response = await fetch(getApiUrl('/api/catalog-visibility'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error fetching catalog visibility:', error)
    // Fallback: all visible
    return NextResponse.json({ success: true, visibility: { sidebar: true, main: true, slide: true } })
  }
}
