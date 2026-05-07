import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pospro-new-server.onrender.com"

// Декодирует exp claim JWT без проверки подписи — только для определения
// «протух / не протух» на фронте. Edge runtime: используем atob, не Buffer.
function isJwtExpired(token: string, skewSec = 10): boolean {
  try {
    const payloadPart = token.split(".")[1]
    if (!payloadPart) return true
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "===".slice((base64.length + 3) % 4)
    const payload = JSON.parse(atob(padded))
    if (typeof payload.exp !== "number") return true
    const nowSec = Math.floor(Date.now() / 1000)
    return payload.exp - skewSec <= nowSec
  } catch {
    return true
  }
}

const COOKIE_OPTS_HTTP = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

const COOKIE_OPTS_CLIENT = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

const ACCESS_MAX_AGE = 60 * 60 * 24 * 7   // 7 дней (cookie-уровень; JWT exp 30 мин)
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30 // 30 дней

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Только страницы, не API/статика — статика тоже триггерит middleware
  // если попадает в matcher; точечно фильтруем.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  // ── Авто-рефреш access-токена ────────────────────────────────────────
  // Когда RootLayout (Server Component) зовёт getProfile() (server action),
  // вызовы cookies().set() из action молча теряются — Next.js не флашит
  // их в response. Поэтому refresh переехал сюда: middleware гарантированно
  // умеет ставить cookies через response.cookies.set, и заодно пробрасывает
  // их вниз через request.cookies.set, чтобы getProfile увидел свежий токен
  // в этом же рендере.
  const accessToken = request.cookies.get('jwt-token')?.value
  const refreshToken = request.cookies.get('jwt-refresh-token')?.value

  if (refreshToken && (!accessToken || isJwtExpired(accessToken))) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.token) {
          // 1) В response — чтобы браузер сохранил Set-Cookie
          response.cookies.set('jwt-token', data.token, { ...COOKIE_OPTS_HTTP, maxAge: ACCESS_MAX_AGE })
          response.cookies.set('jwt-token-client', data.token, { ...COOKIE_OPTS_CLIENT, maxAge: ACCESS_MAX_AGE })
          if (data.refresh_token) {
            response.cookies.set('jwt-refresh-token', data.refresh_token, { ...COOKIE_OPTS_HTTP, maxAge: REFRESH_MAX_AGE })
          }
          // 2) В request — чтобы getProfile увидел новые токены прямо сейчас
          request.cookies.set('jwt-token', data.token)
          request.cookies.set('jwt-token-client', data.token)
          if (data.refresh_token) {
            request.cookies.set('jwt-refresh-token', data.refresh_token)
          }
        }
      } else {
        // Refresh мёртв — чистим всю auth-куку, чтобы SSR гарантированно
        // отрендерил гостя без моргания.
        response.cookies.delete('jwt-token')
        response.cookies.delete('jwt-token-client')
        response.cookies.delete('jwt-refresh-token')
        response.cookies.delete('user-data')
      }
    } catch {
      // Network error — оставляем cookies, попробуем при следующем запросе
    }
  }

  // ── Трекинг визитов (как было) ───────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const userAgent = request.headers.get('user-agent') || ''
  // Fire-and-forget — не блокируем рендер
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
