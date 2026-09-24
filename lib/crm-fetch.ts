/**
 * Тонкая обёртка над `fetch` для запросов к CRM-endpoint'ам админки.
 *
 * Ходит на **относительные** пути — то есть через Next-прокси
 * `app/api/admin/[...path]/route.ts`, который сам подхватывает JWT из
 * cookie и проксирует на Flask. Так работают все админ-страницы; direct
 * apiClient (который берёт JWT из localStorage) для CRM не подходит,
 * потому что у нас токен в cookie.
 */

export interface CrmFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: any
  signal?: AbortSignal
}

export async function crmFetch<T = any>(
  path: string,
  options: CrmFetchOptions = {},
): Promise<T> {
  const method = options.method ?? "GET"
  const url = path.startsWith("/") ? path : `/${path}`

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    cache: "no-store",
  }
  if (options.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = typeof options.body === "string"
      ? options.body
      : JSON.stringify(options.body)
  }

  const res = await fetch(url, init)
  const text = await res.text()

  let parsed: any = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === "object" && (parsed.error || parsed.message)) ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }
  return parsed as T
}

// Sugar-функции — читабельнее в компонентах.
export const crmGet = <T = any>(path: string, signal?: AbortSignal) =>
  crmFetch<T>(path, { method: "GET", signal })

export const crmPost = <T = any>(path: string, body?: any, signal?: AbortSignal) =>
  crmFetch<T>(path, { method: "POST", body, signal })

export const crmPut = <T = any>(path: string, body?: any, signal?: AbortSignal) =>
  crmFetch<T>(path, { method: "PUT", body, signal })

export const crmDelete = <T = any>(path: string, signal?: AbortSignal) =>
  crmFetch<T>(path, { method: "DELETE", signal })

/**
 * Multipart upload с FormData — для файлов сделок/задач. Не выставляет
 * Content-Type — браузер добавит `multipart/form-data; boundary=...`
 * автоматически. Прокси catch-all ловит `multipart/*` и корректно
 * пересылает на Flask.
 */
export async function crmUpload<T = any>(
  path: string,
  formData: FormData,
  signal?: AbortSignal,
): Promise<T> {
  const url = path.startsWith("/") ? path : `/${path}`
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    signal,
    cache: "no-store",
    // Content-Type НЕ выставляем — иначе boundary потеряется.
  })
  const text = await res.text()
  let parsed: any = null
  if (text) {
    try { parsed = JSON.parse(text) } catch { parsed = text }
  }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === "object" && (parsed.error || parsed.message)) ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }
  return parsed as T
}
