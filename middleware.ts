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

  // ── Авто-рефреш access-токена ────────────────────────────────────────
  // Когда RootLayout (Server Component) зовёт getProfile() (server action),
  // вызовы cookies().set() из action молча теряются — Next.js не флашит
  // их в response. Поэтому refresh переехал сюда: middleware гарантированно
  // умеет ставить cookies через response.cookies.set, и заодно пробрасывает
  // их вниз через request.cookies.set, чтобы getProfile увидел свежий токен
  // в этом же рендере.
  //
  // КЛЮЧЕВОЙ нюанс: чтобы downstream cookies() в Server Components увидел
  // мутации request.cookies в этом же рендере, нужно создать NextResponse
  // через `next({ request: { headers } })` — иначе изменения проявятся
  // только на СЛЕДУЮЩИЙ запрос (юзер видит «надо два раза перезагрузить»).
  const accessToken = request.cookies.get('jwt-token')?.value
  const refreshToken = request.cookies.get('jwt-refresh-token')?.value

  let refreshResult: 'ok' | 'dead' | null = null
  let newAccess: string | null = null
  let newRefresh: string | null = null

  if (refreshToken && (!accessToken || isJwtExpired(accessToken))) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.token) {
          newAccess = data.token as string
          newRefresh = (data.refresh_token as string) || null
          refreshResult = 'ok'
          // Прокидываем токены на request, чтобы getProfile прочитал их
          // через cookies() в этом же рендере
          request.cookies.set('jwt-token', newAccess)
          request.cookies.set('jwt-token-client', newAccess)
          if (newRefresh) request.cookies.set('jwt-refresh-token', newRefresh)
        }
      } else {
        refreshResult = 'dead'
        // На request убираем мёртвые токены, чтобы getProfile сразу
        // вернул null и шапка отрендерилась как гостевая
        request.cookies.delete('jwt-token')
        request.cookies.delete('jwt-token-client')
        request.cookies.delete('jwt-refresh-token')
        request.cookies.delete('user-data')
      }
    } catch {
      // Network error — оставляем как было, попробуем на следующем запросе
    }
  }

  // Создаём response с пробросом модифицированных request.headers —
  // без этого мутации request.cookies НЕ дойдут до Server Components.
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // А теперь Set-Cookie на response, чтобы браузер сохранил новую пару
  if (refreshResult === 'ok' && newAccess) {
    response.cookies.set('jwt-token', newAccess, { ...COOKIE_OPTS_HTTP, maxAge: ACCESS_MAX_AGE })
    response.cookies.set('jwt-token-client', newAccess, { ...COOKIE_OPTS_CLIENT, maxAge: ACCESS_MAX_AGE })
    if (newRefresh) {
      response.cookies.set('jwt-refresh-token', newRefresh, { ...COOKIE_OPTS_HTTP, maxAge: REFRESH_MAX_AGE })
    }
  } else if (refreshResult === 'dead') {
    response.cookies.delete('jwt-token')
    response.cookies.delete('jwt-token-client')
    response.cookies.delete('jwt-refresh-token')
    response.cookies.delete('user-data')
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
