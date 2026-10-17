/**
 * PosPro Shop — Service Worker для Web Push уведомлений.
 *
 * Живёт независимо от вкладок. Ловит push от бэка (через FCM/Mozilla
 * Push Service) и показывает нативное уведомление, даже если браузер
 * закрыт.
 *
 * Payload от бэка (см. services/notifications.py::send_web_push):
 *   { title, body, url }
 *
 * Логика show/skip:
 *   • Если у пользователя УЖЕ есть открытая вкладка админки — гасим
 *     уведомление (в UI и так есть red-dot + звук).
 *   • Иначе — показываем.
 *
 * По клику — открываем нужную вкладку (payload.url); если такая уже
 * открыта — фокусируем её.
 */

self.addEventListener("install", () => {
  // Активируемся сразу, не дожидаясь закрытия старых вкладок.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = { title: "PosPro", body: "Новое уведомление", url: "/admin" }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // Тексто-only push (без JSON) — покажем как есть.
    try {
      const text = event.data?.text()
      if (text) data.body = text
    } catch {}
  }

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      const hasAdminOpen = clientsList.some((c) => {
        try {
          const u = new URL(c.url)
          return u.pathname.startsWith("/admin") && c.visibilityState === "visible"
        } catch {
          return false
        }
      })
      // Активная админ-вкладка есть → тихо, badge+звук уже показал сам UI.
      if (hasAdminOpen) return

      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/ui/favicon.ico",
        badge: "/ui/favicon.ico",
        tag: data.url || "pospro",
        renotify: false,
        data: { url: data.url || "/admin" },
      })
    })(),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/admin"
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      // Фокус существующей вкладке на нужный URL, если такая есть.
      for (const c of list) {
        try {
          const u = new URL(c.url)
          if (u.pathname === url || u.pathname.startsWith(url)) {
            await c.focus()
            return
          }
        } catch {}
      }
      // Иначе — открываем новую.
      await self.clients.openWindow(url)
    })(),
  )
})
