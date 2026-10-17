"use client"

/**
 * Круглая кнопка-замочек в шапке админки:
 *  • открытый зелёный — Web Push разрешён и подписка активна
 *  • закрытый красный — не разрешён / не подписан / не поддерживается
 *  • жёлтый пока идёт запрос
 *
 * Клик:
 *  • если сейчас granted+подписан → отписываемся (disableWebPush)
 *  • иначе → просим разрешение и подписываемся (enableWebPush)
 *
 * Автоподписка при mount: если пользователь уже когда-то разрешал
 * (Notification.permission === "granted"), но подписки в браузере нет
 * (переустановил, очистил storage) — тихо переподписываем.
 */

import { useCallback, useEffect, useState } from "react"
import { Lock, LockOpen, Loader2 } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  disableWebPush,
  enableWebPush,
  getActiveSubscription,
  isWebPushSupported,
  readWebPushStatus,
  type WebPushStatus,
} from "@/lib/web-push"

export default function WebPushLock() {
  const { toast } = useToast()

  const [status, setStatus] = useState<WebPushStatus>("default")
  const [hasSubscription, setHasSubscription] = useState(false)
  const [busy, setBusy] = useState(false)

  const refreshStatus = useCallback(async () => {
    const s = await readWebPushStatus()
    setStatus(s)
    const sub = await getActiveSubscription()
    setHasSubscription(!!sub)
    return { status: s, hasSub: !!sub }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { status, hasSub } = await refreshStatus()
      if (cancelled) return
      if (status === "granted" && !hasSub) {
        const s = await enableWebPush()
        if (!cancelled) {
          setStatus(s)
          const sub = await getActiveSubscription()
          setHasSubscription(!!sub)
        }
      }
    })()
    return () => { cancelled = true }
  }, [refreshStatus])

  const supported = isWebPushSupported()
  const isActive = supported && status === "granted" && hasSubscription

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (isActive) {
        await disableWebPush()
        await refreshStatus()
        toast({ title: "Уведомления в браузере выключены" })
        return
      }
      const s = await enableWebPush()
      setStatus(s)
      const sub = await getActiveSubscription()
      setHasSubscription(!!sub)
      if (s === "granted") {
        toast({ title: "Уведомления в браузере включены" })
      } else if (s === "denied") {
        toast({
          variant: "destructive",
          title: "Уведомления заблокированы",
          description: "Разреши push в настройках браузера и попробуй снова.",
        })
      } else if (s === "not-configured") {
        toast({
          variant: "destructive",
          title: "Push не настроен",
          description: "VAPID ключи не заданы на сервере.",
        })
      } else if (s === "unsupported") {
        toast({
          variant: "destructive",
          title: "Браузер не поддерживает Push",
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const title = !supported
    ? "Push в браузере не поддерживается"
    : isActive
    ? "Уведомления разрешены — клик, чтобы выключить"
    : status === "denied"
    ? "Уведомления заблокированы в браузере"
    : "Уведомления выключены — клик, чтобы включить"

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || !supported}
      title={title}
      className={cn(
        "shrink-0 h-9 w-9 rounded-full inline-flex items-center justify-center",
        "border transition-colors focus:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isActive
          ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
          : "border-red-200 bg-red-50 hover:bg-red-100 text-red-600",
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isActive ? (
        <LockOpen className="h-4 w-4" />
      ) : (
        <Lock className="h-4 w-4" />
      )}
    </button>
  )
}
