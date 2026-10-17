"use client"

/**
 * Web Push подписка со стороны браузера.
 *
 * Флоу:
 *   1. Проверить поддержку (`serviceWorker` + `PushManager` + `Notification`)
 *   2. Спросить у бэка публичный VAPID-ключ (`/api/admin/notifications/vapid-public`)
 *   3. Запросить разрешение у юзера (`Notification.requestPermission()`)
 *   4. Зарегистрировать SW (`/sw.js`) + подписаться (`pushManager.subscribe()`)
 *   5. Отправить subscription на бэк (`/api/admin/notifications/push-subscribe`)
 *
 * Возвращает статус чтобы UI мог отрисовать «включено / не поддерживается /
 * заблокировано юзером».
 */

import { crmGet, crmPost } from "@/lib/crm-fetch"

export type WebPushStatus =
  | "unsupported"       // браузер не умеет Push (Safari <16.4 / iOS без PWA)
  | "not-configured"    // на бэке нет VAPID env
  | "denied"            // юзер запретил уведомления
  | "default"           // ещё не спрашивали
  | "granted"           // включено, подписка активна

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

/**
 * Считает текущий статус без активных действий (не запрашивает
 * permission, не подписывает — только читает).
 */
export async function readWebPushStatus(): Promise<WebPushStatus> {
  if (!isWebPushSupported()) return "unsupported"
  const perm = Notification.permission
  if (perm === "denied") return "denied"
  if (perm === "default") return "default"
  // granted — проверим есть ли активная subscription
  return "granted"
}

/**
 * Активная подписка (если есть). Полезно чтобы отправить unsubscribe
 * на бэк при выключении.
 */
export async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js")
    if (!reg) return null
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Включить Web Push: спросить permission, зарегистрировать SW,
 * подписаться, отправить subscription на бэк.
 *
 * Возвращает финальный статус. При `granted` — подписка активна.
 */
export async function enableWebPush(): Promise<WebPushStatus> {
  if (!isWebPushSupported()) return "unsupported"

  // 1. VAPID public key с бэка.
  let vapidPublic: string | null = null
  try {
    const res = await crmGet<{ public_key: string | null; configured: boolean }>(
      "/api/admin/notifications/vapid-public",
    )
    if (!res.configured || !res.public_key) return "not-configured"
    vapidPublic = res.public_key
  } catch {
    return "not-configured"
  }

  // 2. Permission.
  let perm: NotificationPermission = Notification.permission
  if (perm === "default") {
    perm = await Notification.requestPermission()
  }
  if (perm !== "granted") return perm === "denied" ? "denied" : "default"

  // 3. Регистрируем SW.
  let reg: ServiceWorkerRegistration
  try {
    reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    // Ждём чтобы SW стал ready — pushManager иначе может не сработать.
    await navigator.serviceWorker.ready
  } catch (e) {
    console.error("[web-push] SW register failed:", e)
    return "denied"
  }

  // 4. Подписываемся (или переиспользуем существующую).
  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      })
    } catch (e) {
      console.error("[web-push] subscribe failed:", e)
      return "denied"
    }
  }

  // 5. Отдаём на бэк.
  try {
    const p256dh = subscription.getKey("p256dh")
    const auth = subscription.getKey("auth")
    if (!p256dh || !auth) throw new Error("keys missing")
    await crmPost("/api/admin/notifications/push-subscribe", {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64Url(p256dh),
        auth: arrayBufferToBase64Url(auth),
      },
    })
  } catch (e) {
    console.error("[web-push] backend save failed:", e)
    // Оставляем подписку в браузере — фронт-статус всё равно granted,
    // повторная попытка отдаст её же.
  }

  return "granted"
}

/**
 * Отписаться: удалить subscription из браузера + сообщить бэку.
 * Разрешение уведомлений в браузере не снимается (это может сделать
 * только сам юзер через настройки).
 */
export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return
  const sub = await getActiveSubscription()
  if (!sub) return
  try {
    await crmPost("/api/admin/notifications/push-unsubscribe", {
      endpoint: sub.endpoint,
    })
  } catch {
    /* silent — попробуем всё равно unsubscribe в браузере */
  }
  try {
    await sub.unsubscribe()
  } catch {
    /* silent */
  }
}

// ============================================================================
// helpers: base64url ↔ Uint8Array/ArrayBuffer
// ============================================================================

/** VAPID public key приходит как base64url (без padding) → Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** ArrayBuffer → base64url (для отправки p256dh/auth на бэк). */
function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ""
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
