"use client"

/**
 * Колокольчик в шапке админки со списком последних уведомлений.
 *
 *   • Bell + красный badge с числом непрочитанных.
 *   • Клик → Popover со списком (последние 20).
 *   • Клик по уведомлению → mark_read + переход на связанную сущность
 *     (сделка / задача / комната чата).
 *   • Кнопка «Прочитать все» сверху панели.
 *
 * Настройка Web Push (замочек вкл/выкл) вынесена в отдельный компонент
 * `<WebPushLock/>` рядом с колокольчиком в шапке.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell, Loader2, Check,
  Briefcase, ListTodo, MessageSquare,
} from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { useChatUnread } from "@/context/chat-unread-context"
import { crmGet, crmPost } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"

interface NotificationRow {
  id: number
  kind: string
  section: string
  entity_type: string | null
  entity_id: number | null
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string | null
}

export default function WebPushBell({
  variant = "admin",
}: {
  /**
   * `admin` — круглая кнопка 36×36 с бордером (шапка админки).
   * `shop`  — вертикальная плитка h-11 min-w-[56px] с подписью,
   *           стилистика HeaderIconLink (шапка витрины).
   */
  variant?: "admin" | "shop"
} = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const { totalUnread, markEntityRead, markAllRead, refresh, markRoomRead, rooms } = useChatUnread()

  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Array<NotificationRow>>([])
  const [notifsLoading, setNotifsLoading] = useState(false)

  // Список уведомлений — тянем при открытии bell + при любом изменении
  // totalUnread (пришло новое → список должен обновиться если открыт).
  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true)
    try {
      const res = await crmGet<{ notifications: NotificationRow[] }>(
        "/api/admin/notifications?limit=20",
      )
      setNotifs(res.notifications || [])
    } catch {
      /* silent */
    } finally {
      setNotifsLoading(false)
    }
  }, [])
  useEffect(() => {
    if (open) loadNotifs()
  }, [open, loadNotifs, totalUnread])

  const handleNotifClick = useCallback(async (n: NotificationRow) => {
    // Помечаем прочитанным именно эту сущность и её всё скопление.
    if (n.entity_type && n.entity_id != null) {
      markEntityRead(n.entity_type, n.entity_id)
    }
    setOpen(false)
    const url = notifTargetUrl(n)
    if (url) router.push(url)
  }, [markEntityRead, router])

  const handleMarkOneRead = useCallback(async (n: NotificationRow, e: React.MouseEvent) => {
    e.stopPropagation()
    if (n.read_at) return
    setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    try {
      await crmPost("/api/admin/notifications/read", { ids: [n.id] })
      // Для chat_new_message бейдж считается через ChatRoom.unread —
      // помечаем комнату прочитанной, иначе бейдж не пропадёт до
      // фактического открытия чата.
      if (n.entity_type === "chat_room" && n.entity_id != null) {
        try {
          await crmPost(`/api/admin/chat/rooms/${n.entity_id}/read`, {})
        } catch { /* silent */ }
        markRoomRead(n.entity_id)
      }
      // Синхронизируем notifCounts в провайдере (бейджи в шапке).
      refresh()
    } catch { /* silent */ }
  }, [refresh, markRoomRead])

  const handleMarkAll = useCallback(async () => {
    await markAllRead()
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    // Помечаем все комнаты с unread на бэке — иначе chatUnread не
    // обнулится.
    const dirty = rooms.filter((r) => r.unread > 0)
    for (const r of dirty) {
      try { await crmPost(`/api/admin/chat/rooms/${r.id}/read`, {}) } catch {}
      markRoomRead(r.id)
    }
    refresh()
    toast({ title: "Все уведомления прочитаны" })
  }, [markAllRead, rooms, markRoomRead, refresh, toast])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "shop" ? (
          <button
            type="button"
            title="Уведомления"
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 h-11 px-2 rounded-lg transition-colors",
              "min-w-[56px] text-gray-700 hover:bg-yellow-50 hover:text-black focus:outline-none",
            )}
          >
            <span className="relative">
              <Bell className="h-4 w-4" />
              {totalUnread > 0 && (
                <span
                  className={cn(
                    "absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full",
                    "inline-flex items-center justify-center",
                    "bg-brand-yellow text-black text-[10px] leading-none font-medium shadow ring-1 ring-white",
                  )}
                >
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </span>
            <span className="hidden md:inline text-[10px] leading-tight">Уведомления</span>
          </button>
        ) : (
          <button
            type="button"
            title="Уведомления"
            className={cn(
              "relative shrink-0 h-9 w-9 rounded-full inline-flex items-center justify-center",
              "border border-gray-200 bg-white hover:bg-gray-50 transition-colors focus:outline-none",
            )}
          >
            <Bell className="h-4 w-4 text-gray-700" />
            {totalUnread > 0 && (
              <span
                className={cn(
                  "absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1",
                  "inline-flex items-center justify-center rounded-full",
                  "bg-red-500 text-white text-[9px] font-semibold",
                )}
              >
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        {/* --- Список уведомлений --- */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Уведомления</div>
            {notifs.some((n) => !n.read_at) && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[11px] text-brand-yellow hover:underline focus:outline-none"
              >
                Прочитать все
              </button>
            )}
          </div>

          {notifsLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">
              Уведомлений нет
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto divide-y divide-gray-100 -mx-3">
              {notifs.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleNotifClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors",
                      !n.read_at && "bg-yellow-50/50",
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {notifIcon(n.section)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-gray-900">
                        {notifTitle(n)}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {notifSubtitle(n)}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                      {formatStamp(n.created_at)}
                    </div>
                    {!n.read_at && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleMarkOneRead(n, e)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleMarkOneRead(n, e as any)
                          }
                        }}
                        title="Отметить прочитанным (без перехода)"
                        className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-red-50 text-red-600 hover:bg-emerald-50 hover:text-emerald-700 border border-red-200 hover:border-emerald-300 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
                      >
                        Пометить прочитанным
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================

function notifIcon(section: string) {
  if (section === "deals") return <Briefcase className="h-4 w-4 text-orange-600" />
  if (section === "tasks") return <ListTodo className="h-4 w-4 text-violet-600" />
  if (section === "chat") return <MessageSquare className="h-4 w-4 text-blue-600" />
  return <Bell className="h-4 w-4 text-gray-500" />
}

function notifTitle(n: NotificationRow): string {
  const p = n.payload as Record<string, any>
  switch (n.kind) {
    case "deal_assigned":       return `Новая сделка · ${p?.deal_name || "?"}`
    case "deal_stage_changed":  return `Стадия сделки изменена`
    case "deal_won":            return `Сделка выиграна`
    case "deal_lost":           return `Сделка проиграна`
    case "deal_member_added":   return `Вас добавили в сделку`
    case "task_assigned":       return `Новая задача · ${p?.task_title || "?"}`
    case "task_status_changed": return `Статус задачи изменён`
    case "task_due_soon":       return `Срок задачи скоро истечёт`
    case "task_overdue":        return `Задача просрочена`
    case "task_member_added":   return `Вас добавили в задачу`
    case "chat_mention":        return `📣 Вас упомянули в чате`
    case "chat_new_message":    return `Новое сообщение в чате`
    default:                    return n.kind
  }
}

function notifSubtitle(n: NotificationRow): string {
  const p = n.payload as Record<string, any>
  if (typeof p?.preview === "string") return p.preview
  if (typeof p?.deal_name === "string") return p.deal_name
  if (typeof p?.task_title === "string") return p.task_title
  return ""
}

function notifTargetUrl(n: NotificationRow): string | null {
  if (n.entity_type === "deal" && n.entity_id) return `/admin/deals/${n.entity_id}`
  if (n.entity_type === "task" && n.entity_id) return `/admin/tasks/${n.entity_id}`
  if (n.entity_type === "chat_room" && n.entity_id)
    return `/admin/chat?room=${n.entity_id}`
  return null
}

function formatStamp(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

