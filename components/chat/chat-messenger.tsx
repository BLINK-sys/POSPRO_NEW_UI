"use client"

/**
 * Оркестратор страницы /admin/chat: двухпанельный мессенджер —
 * слева список моих комнат (общий + личка + группы + чаты сделок/
 * задач), справа выбранная переписка (переиспользуем `CrmChatPanel`).
 *
 * Поток данных:
 *   1) GET /api/admin/chat/rooms — список моих комнат с last_message
 *      и unread. Poll каждые 15 сек (мягко), плюс инкрементальное
 *      обновление unread через `refresh key` при отправке.
 *   2) Клик по комнате → setSelectedRoomId, справа тот же
 *      CrmChatPanel но со «свободным» chatRoomEndpoint (см. ниже).
 *   3) Кнопка «+» → NewChatDialog: направо / группа.
 *
 * CrmChatPanel сейчас берёт room_id через `chatRoomEndpoint`,
 * который возвращает `{room_id}`. Тут у нас room_id уже известен,
 * поэтому передаём фейковый endpoint через новый режим `directRoomId`
 * (см. правку в crm-chat-panel).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  MessageSquare, Plus, Search, X, Users2, Briefcase, ListTodo,
  UserRound, Loader2, Layers, Archive,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { useChatUnread } from "@/context/chat-unread-context"
import { cn } from "@/lib/utils"
import { crmGet } from "@/lib/crm-fetch"
import type { ChatRoomSummary, ChatRoomKind } from "@/lib/chat-types"

import CrmChatPanel from "@/components/crm/crm-chat-panel"
import NewChatDialog from "./new-chat-dialog"

interface Sys {
  id: number
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
}

export default function ChatMessenger() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { rooms, markRoomRead, refresh: refreshRooms, markEntityRead } = useChatUnread()
  const currentUserId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [users, setUsers] = useState<Sys[]>([])
  const [q, setQ] = useState("")
  const [newOpen, setNewOpen] = useState(false)
  const [kindFilter, setKindFilter] = useState<"all" | ChatRoomKind | "archived">("all")

  /**
   * Открытие комнаты — мгновенно занулить unread через провайдер, чтобы
   * бейдж пропал сразу. Реальный POST /rooms/:id/read делает CrmChatPanel
   * при mount.
   */
  const selectRoom = useCallback((id: number) => {
    setSelectedRoomId(id)
    markRoomRead(id)
    // Notification'ы chat_new_message для этой комнаты пометить прочитанными.
    markEntityRead("chat_room", id)
  }, [markRoomRead, markEntityRead])

  // Deep-link `?room=N` — из bell-панели, из push-уведомлений, из
  // любых внешних ссылок. Открываем эту комнату как только она появится
  // в списке (rooms) — обычно она уже там после первичного fetch.
  // Дополнительно `?msg=Y` — скроллит к конкретному сообщению и
  // подсвечивает его.
  const search = useSearchParams()
  const roomFromQuery = search.get("room")
  const msgFromQuery = search.get("msg")
  useEffect(() => {
    if (!roomFromQuery) return
    const rid = Number(roomFromQuery)
    if (Number.isNaN(rid)) return
    if (selectedRoomId === rid) return
    const room = rooms.find((r) => r.id === rid)
    if (room) selectRoom(rid)
  }, [roomFromQuery, rooms, selectedRoomId, selectRoom])
  useEffect(() => {
    if (!msgFromQuery) return
    if (selectedRoomId == null) return
    const mid = Number(msgFromQuery)
    if (Number.isNaN(mid)) return
    // Подождём пока CrmChatPanel отрендерит сообщения — bubble имеет
    // data-msg-id=mid. Пытаемся несколько раз с шагом 300мс.
    let attempts = 10
    const tryScroll = () => {
      const el = document.querySelector(`[data-msg-id="${mid}"]`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        el.classList.add("ring-2", "ring-brand-yellow", "rounded-2xl")
        setTimeout(() => el.classList.remove("ring-2", "ring-brand-yellow", "rounded-2xl"), 2000)
        return
      }
      if (--attempts > 0) setTimeout(tryScroll, 300)
    }
    setTimeout(tryScroll, 300)
  }, [msgFromQuery, selectedRoomId])

  // Только справочник пользователей — комнаты уже загружает провайдер.
  useEffect(() => {
    let ignore = false
    crmGet<Sys[] | { users: Sys[] }>("/api/system-users")
      .catch(() => [])
      .then((u) => {
        if (ignore) return
        const us = Array.isArray(u) ? u : (u as any).users || []
        setUsers(us)
        setLoading(false)
      })
    return () => { ignore = true }
  }, [])

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, userName(u)])),
    [users],
  )

  // Счётчики по типам для показа рядом с фильтром-tab.
  const kindCounts = useMemo(() => {
    const counts = { all: 0, general: 0, direct: 0, group: 0, deal: 0, task: 0, archived: 0 }
    for (const r of rooms) {
      counts.all += 1
      if (r.is_archived) counts.archived += 1
      else counts[r.kind] = (counts[r.kind] || 0) + 1
    }
    return counts
  }, [rooms])

  const filteredRooms = useMemo(() => {
    const query = q.trim().toLowerCase()
    const withNames = rooms
      .filter((r) => {
        if (kindFilter === "all") return !r.is_archived
        if (kindFilter === "archived") return r.is_archived
        return !r.is_archived && r.kind === kindFilter
      })
      .map((r) => ({
        ...r,
        display: roomDisplayName(r, usersById, currentUserId),
      }))
    if (!query) return withNames
    return withNames.filter((r) =>
      r.display.toLowerCase().includes(query),
    )
  }, [rooms, q, kindFilter, usersById, currentUserId])

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  )
  const selectedDisplay = useMemo(
    () => (selectedRoom ? roomDisplayName(selectedRoom, usersById, currentUserId) : ""),
    [selectedRoom, usersById, currentUserId],
  )

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] space-y-3 overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Чат</h1>
          <p className="text-sm text-gray-500">
            Общий · личка · группы · чаты сделок и задач
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] gap-3 flex-1 min-h-0">
        {/* Sidebar — список комнат */}
        <Card className="rounded-xl border-gray-200 flex flex-col overflow-hidden min-h-0">
          <div className="p-2 border-b border-gray-100 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск"
                  className="h-8 pl-8 pr-7 text-sm"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Button
                size="icon"
                onClick={() => setNewOpen(true)}
                className="h-8 w-8 rounded-full bg-brand-yellow text-black hover:bg-yellow-500 shrink-0"
                title="Новый чат"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex">
            {/* Вертикальная колонка фильтров слева — иконка сверху,
                подпись снизу. Активный подсвечен жёлтым. */}
            <div className="w-[76px] shrink-0 border-r border-gray-100 flex flex-col items-stretch gap-1 p-1.5 bg-gray-50/40 overflow-y-auto">
              {(
                [
                  ["all", "Все", Layers],
                  ["general", "Общий", Users2],
                  ["direct", "Личные", UserRound],
                  ["group", "Группы", Users2],
                  ["deal", "Сделки", Briefcase],
                  ["task", "Задачи", ListTodo],
                  ["archived", "Архив", Archive],
                ] as const
              ).map(([k, label, Icon]) => {
                const c = kindCounts[k as keyof typeof kindCounts] || 0
                const active = kindFilter === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k as any)}
                    title={label}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all focus:outline-none border",
                      active
                        ? "bg-brand-yellow/25 border-brand-yellow text-black shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300",
                    )}
                  >
                    <div className="relative">
                      <Icon className="h-4 w-4" />
                      {c > 0 && (
                        <span
                          className={cn(
                            "absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full text-[9px] tabular-nums font-semibold leading-none ring-1 ring-white",
                            active ? "bg-brand-yellow text-black" : "bg-gray-800 text-white",
                          )}
                        >
                          {c > 99 ? "99+" : c}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] leading-tight font-medium">
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-10 px-3">
                {q ? "Ничего не найдено" : "Чатов пока нет"}
              </div>
            ) : (
              <ul>
                {filteredRooms.map((r) => (
                  <RoomRow
                    key={r.id}
                    room={r}
                    displayName={r.display}
                    active={r.id === selectedRoomId}
                    onClick={() => selectRoom(r.id)}
                    usersById={usersById}
                    currentUserId={currentUserId}
                  />
                ))}
              </ul>
            )}
          </div>
          </div>
        </Card>

        {/* Panel — активная переписка */}
        <div className="min-h-0">
          {selectedRoom ? (
            <CrmChatPanel
              key={selectedRoom.id}
              directRoomId={selectedRoom.id}
              readOnly={selectedRoom.is_archived}
              currentUserId={currentUserId}
              usersById={usersById}
              title={selectedDisplay}
              subtitle={roomSubtitle(selectedRoom, usersById)}
            />
          ) : (
            <Card className="rounded-xl border-gray-200 h-full flex items-center justify-center text-sm text-gray-400">
              Выберите чат слева или создайте новый
            </Card>
          )}
        </div>
      </div>

      <NewChatDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        users={users}
        currentUserId={currentUserId}
        onCreated={(room) => {
          // Комнату добавит SSE (при первом сообщении) или разово
          // refreshRooms — по прибытии response POST /rooms.
          refreshRooms()
          selectRoom(room.id)
          setNewOpen(false)
        }}
      />
    </div>
  )
}

// ============================================================================

function RoomRow({
  room,
  displayName,
  active,
  onClick,
  usersById,
  currentUserId,
}: {
  room: ChatRoomSummary
  displayName: string
  active: boolean
  onClick: () => void
  usersById: Map<number, string>
  currentUserId: number | null
}) {
  const Icon = kindIcon(room.kind)
  const authorText = room.last_message?.author_id
    ? (room.last_message.author_id === currentUserId
        ? "Вы: "
        : `${shortName(usersById.get(room.last_message.author_id) ?? "")}: `)
    : ""
  const preview = room.last_message?.deleted_at
    ? "сообщение удалено"
    : (room.last_message?.text
        || (room.last_message?.attachments?.length
              ? `📎 файл (${room.last_message.attachments.length})`
              : ""))

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left px-3 py-2 flex items-center gap-2.5 border-b border-gray-50 transition-colors",
          active ? "bg-brand-yellow/25" : "hover:bg-gray-50",
        )}
      >
        <div className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          kindTint(room.kind),
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-medium truncate flex-1">
              {displayName}
            </div>
            {room.last_message?.created_at && (
              <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                {formatShortTime(room.last_message.created_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-xs text-gray-500 truncate flex-1">
              {authorText + (preview || "нет сообщений")}
            </div>
            {room.unread > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-brand-yellow text-black text-[10px] font-medium tabular-nums shrink-0">
                {room.unread > 99 ? "99+" : room.unread}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

// ============================================================================

function kindIcon(kind: ChatRoomKind) {
  switch (kind) {
    case "general": return Users2
    case "direct":  return UserRound
    case "group":   return Users2
    case "deal":    return Briefcase
    case "task":    return ListTodo
  }
}
function kindTint(kind: ChatRoomKind): string {
  switch (kind) {
    case "general": return "bg-blue-50 text-blue-700"
    case "direct":  return "bg-gray-100 text-gray-700"
    case "group":   return "bg-emerald-50 text-emerald-700"
    case "deal":    return "bg-amber-50 text-amber-700"
    case "task":    return "bg-violet-50 text-violet-700"
  }
}

/**
 * Отображаемое имя комнаты:
 *  • general → «Общий чат»
 *  • group   → room.name
 *  • direct  → имя второго участника (если знаем)
 *  • deal    → «Сделка · related_deal_id» (без денормализации)
 *  • task    → «Задача · related_task_id»
 * Для direct без members info падаем на «Личка».
 */
function roomDisplayName(
  room: ChatRoomSummary,
  usersById: Map<number, string>,
  currentUserId: number | null,
): string {
  let base: string
  if (room.kind === "general") base = "Общий чат"
  else if (room.kind === "direct") {
    // Direct — показываем имя второго участника. Для чата с самим собой
    // или без info — fallback «Личка».
    const other = (room.member_ids || []).find((uid) => uid !== currentUserId)
    base = other != null ? (usersById.get(other) ?? `#${other}`) : "Личка"
  }
  else if (room.name) base = room.name
  else if (room.kind === "deal" && room.related_deal_id) base = `Сделка №${room.related_deal_id}`
  else if (room.kind === "task" && room.related_task_id) base = `Задача №${room.related_task_id}`
  else base = "Чат"
  return room.is_archived ? `${base} · архив` : base
}

function roomSubtitle(room: ChatRoomSummary, usersById: Map<number, string>): string {
  if (room.is_archived) return "Архив — переписка сохранена, писать нельзя"
  if (room.kind === "general") return "Все сотрудники видят сообщения"
  if (room.kind === "deal") return "Виден Ответственному, Постановщику, Соисполнителям и Наблюдателям сделки"
  if (room.kind === "task") return "Виден Постановщику, Исполнителю, Соисполнителям и Наблюдателям задачи"
  if (room.kind === "direct") return "Личная переписка"
  if (room.kind === "group") return "Групповой чат"
  return ""
}

function userName(u: Sys): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return full
  return parts[0]
}

function formatShortTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 7) return d.toLocaleDateString("ru-RU", { weekday: "short" })
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}
