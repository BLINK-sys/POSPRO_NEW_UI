import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pospro-new-server.onrender.com"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Только страницы, не API/статика
  const pathname = request.nextUrl.pathname
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return response
  }

  // IP из заголовков (Render/Vercel прокси)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const userAgent = request.headers.get('user-agent') || ''

  // Fire-and-forget — не блокируем загрузку страницы
  fetch(`${API_BASE_URL}/api/track-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, user_agent: userAgent }),
  }).catch(() => {})

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
