"use client"

/**
 * Плавающий чат-виджет: круглая кнопка в правом нижнем углу открывает
 * компактную панель со всей функциональностью /admin/chat.
 *
 * Работает везде, где есть `ChatUnreadAutoProvider` (root layout).
 * Виден только для admin/system. Использует тот же CrmChatPanel — все
 * фичи (реакции, ответы, edit, delete, файлы, read-receipts) работают
 * идентично полной странице.
 *
 * Внутри виджета — два вида:
 *   • rooms — список моих комнат (аналог левой колонки /admin/chat)
 *   • chat  — выбранная переписка (CrmChatPanel)
 * Кнопка «‹» в шапке чата возвращает к списку.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import {
  MessageSquare, X, Users2, UserRound, Briefcase, ListTodo,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

import { Card } from "@/components/ui/card"
import { useAuth } from "@/context/auth-context"
import { useChatUnread } from "@/context/chat-unread-context"
import { useChatButtonPosition } from "@/context/chat-button-position-context"
import { crmGet } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"
import CrmChatPanel from "@/components/crm/crm-chat-panel"
import type { ChatRoomSummary, ChatRoomKind } from "@/lib/chat-types"

interface Sys {
  id: number
  full_name?: string
  name?: string
  first_name?: string
  last_name?: string
  email?: string
}

export default function ChatWidget() {
  const { user } = useAuth()
  const {
    rooms, totalUnread, markRoomRead, markEntityRead,
  } = useChatUnread()
  const currentUserId = user?.id ?? null

  const [open, setOpen] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [users, setUsers] = useState<Sys[]>([])

  // Справочник юзеров для отображения имён в списке и сообщениях.
  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "system") return
    let ignore = false
    crmGet<Sys[] | { users: Sys[] }>("/api/system-users")
      .then((u) => {
        if (ignore) return
        const list = Array.isArray(u) ? u : (u as any).users || []
        setUsers(list)
      })
      .catch(() => {})
    return () => { ignore = true }
  }, [user?.role])

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, userName(u)])),
    [users],
  )

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  )

  const selectRoom = useCallback((id: number) => {
    setSelectedRoomId(id)
    markRoomRead(id)
    markEntityRead("chat_room", id)
  }, [markRoomRead, markEntityRead])

  const closeWidget = useCallback(() => setOpen(false), [])

  const pathname = usePathname()
  const isAdmin = user?.role === "admin" || user?.role === "system"
  // В админке виджет не нужен — там уже есть /admin/chat и вся навигация.
  const isAdminArea = pathname?.startsWith("/admin") ?? false
  // Куда кнопку парковать — вниз-право (default) или наверх-право (на
  // рабочих экранах типа редактора КП или корп.расчётника). Включается
  // декларативно страницей через <DockChatButtonToHeader />, которая её
  // ставит на mount и возвращает на unmount.
  const { dockToHeader } = useChatButtonPosition()
  if (!isAdmin || isAdminArea) return null

  return (
    <>
      {/* Полноэкранная по высоте панель — прижата к шапке сверху и
          к низу окна с минимальным зазором. Ширина как у
          мини-мессенджера — комнаты + чат одновременно. */}
      {open && (
        <div className="fixed top-40 bottom-2 right-2 z-50 flex pointer-events-none">
          <Card className="pointer-events-auto w-[820px] max-w-[calc(100vw-1rem)] h-full flex flex-col overflow-hidden shadow-2xl rounded-xl border-gray-200">
            <WidgetHeader
              rooms={rooms}
              selectedRoom={selectedRoom}
              onClose={closeWidget}
            />
            <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr]">
              <div className="border-r border-gray-100 overflow-y-auto min-h-0">
                <RoomsList
                  rooms={rooms}
                  usersById={usersById}
                  currentUserId={currentUserId}
                  selectedRoomId={selectedRoomId}
                  onSelect={selectRoom}
                />
              </div>
              <div className="min-h-0 flex flex-col">
                {selectedRoom ? (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <CrmChatPanel
                      key={selectedRoom.id}
                      directRoomId={selectedRoom.id}
                      currentUserId={currentUserId}
                      usersById={usersById}
                      title=""
                      readOnly={selectedRoom.is_archived}
                      chromeless
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-400 px-6 text-center">
                    Выбери чат слева
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Плавающая кнопка — скрыта пока виджет открыт.
          Якорь — всегда правый нижний угол (`bottom-4 right-4`), размер
          всегда одинаковый (56×56). Переезд наверх делаем через transform
          `translateY(-<~viewport>)`, чтобы кнопка плавно поднималась/
          опускалась (анимация transform дешёвая и работает идеально).
          Высота переезда — ~90dvh минус запас под шапку. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Открыть чат"
          className={cn(
            "fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-xl",
            "flex items-center justify-center text-black",
            "bg-brand-yellow hover:bg-yellow-500 hover:scale-105 active:scale-95",
            "focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2",
            // Анимируем именно transform — он работает на GPU, не ломает
            // layout. При изменении dockToHeader кнопка плавно уезжает
            // вверх/вниз (600ms ease-in-out).
            "transition-transform duration-500 ease-in-out",
          )}
          style={{
            // Якорь — bottom-4 (16px) + высота 56px → базовая верхняя точка
            // = viewport - 72. Чтобы приземлиться вровень с иконками шапки
            // (их центр ~56px от верха), сдвигаем на (100vh - 128): кнопка
            // окажется на top: ~56px.
            transform: dockToHeader
              ? "translateY(calc(-100dvh + 128px))"
              : "translateY(0)",
          }}
        >
          <MessageSquare className="h-6 w-6" />
          {totalUnread > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1.5",
                "inline-flex items-center justify-center rounded-full",
                "bg-red-500 text-white text-[11px] font-semibold",
                "ring-2 ring-white",
              )}
            >
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
      )}
    </>
  )
}

// ============================================================================

function WidgetHeader({
  rooms,
  selectedRoom,
  onClose,
}: {
  rooms: ChatRoomSummary[]
  selectedRoom: ChatRoomSummary | null
  onClose: () => void
}) {
  // Куда уводит «В админке»: если что-то выбрано — на связанную
  // сущность, иначе — на общий /admin/chat.
  const adminHref =
    selectedRoom && selectedRoom.kind === "deal" && selectedRoom.related_deal_id
      ? `/admin/deals/${selectedRoom.related_deal_id}`
      : selectedRoom && selectedRoom.kind === "task" && selectedRoom.related_task_id
      ? `/admin/tasks/${selectedRoom.related_task_id}`
      : selectedRoom
      ? `/admin/chat?room=${selectedRoom.id}`
      : "/admin/chat"

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full bg-brand-yellow/25 flex items-center justify-center shrink-0">
          <MessageSquare className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">Чат</div>
          <div className="text-[10px] text-gray-500 leading-tight">
            {rooms.length} {declOfNum(rooms.length, ["комната", "комнаты", "комнат"])}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={adminHref}
          title="Открыть в админке"
          className="h-7 w-7 rounded-full inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          title="Закрыть"
          className="h-7 w-7 rounded-full inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function RoomsList({
  rooms,
  usersById,
  currentUserId,
  selectedRoomId,
  onSelect,
}: {
  rooms: ChatRoomSummary[]
  usersById: Map<number, string>
  currentUserId: number | null
  selectedRoomId: number | null
  onSelect: (id: number) => void
}) {
  if (rooms.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-10 px-3">
        Чатов пока нет
      </div>
    )
  }
  return (
    <ul>
      {rooms.map((r) => (
        <RoomRow
          key={r.id}
          room={r}
          active={selectedRoomId === r.id}
          displayName={roomDisplayName(r, usersById, currentUserId)}
          onClick={() => onSelect(r.id)}
          usersById={usersById}
          currentUserId={currentUserId}
        />
      ))}
    </ul>
  )
}


// ============================================================================
// helpers
// ============================================================================

function RoomRow({
  room,
  active,
  displayName,
  onClick,
  usersById,
  currentUserId,
}: {
  room: ChatRoomSummary
  active: boolean
  displayName: string
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

function kindIcon(kind: ChatRoomKind) {
  if (kind === "deal") return Briefcase
  if (kind === "task") return ListTodo
  if (kind === "group") return Users2
  if (kind === "direct") return UserRound
  return Users2
}

function kindTint(kind: ChatRoomKind): string {
  if (kind === "deal") return "bg-orange-100 text-orange-700"
  if (kind === "task") return "bg-violet-100 text-violet-700"
  if (kind === "group") return "bg-emerald-100 text-emerald-700"
  if (kind === "direct") return "bg-gray-100 text-gray-700"
  return "bg-blue-100 text-blue-700"
}

function roomDisplayName(
  room: ChatRoomSummary,
  usersById: Map<number, string>,
  currentUserId: number | null,
): string {
  let base: string
  if (room.kind === "general") base = "Общий чат"
  else if (room.name) base = room.name
  else if (room.kind === "deal" && room.related_deal_id) base = `Сделка №${room.related_deal_id}`
  else if (room.kind === "task" && room.related_task_id) base = `Задача №${room.related_task_id}`
  else base = room.kind === "direct" ? "Личка" : "Чат"
  return room.is_archived ? `${base} · архив` : base
}

function userName(u: Sys): string {
  return (
    u.full_name ||
    u.name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}

function shortName(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
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
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

function declOfNum(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const n1 = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (n1 > 1 && n1 < 5) return forms[1]
  if (n1 === 1) return forms[0]
  return forms[2]
}
