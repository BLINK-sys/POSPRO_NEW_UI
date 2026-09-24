"use client"

/**
 * Правая колонка карточки сделки — встроенный чат сделки.
 *
 * Логика:
 *  1. Получить room_id: GET /admin/deals/<id>/chat-room. Комната создаётся
 *     автоматически при POST /deals, старые сделки могут вернуть 404 —
 *     тогда показываем плейсхолдер.
 *  2. Загрузить последнюю страницу сообщений: GET /admin/chat/rooms/<rid>/messages
 *  3. Мягкий polling каждые 3 секунды на новые сообщения — по `since=`.
 *  4. Отправка: POST /admin/chat/rooms/<rid>/messages
 *  5. При unmount — очистить таймер.
 *
 * SSE (глобальный /admin/chat/stream) подключим на этапе 5, когда будет
 * общий чат-роут; тут polling проще и достаточно для одной комнаты.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Loader2, Send, MessageSquareOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { crmGet, crmPost } from "@/lib/crm-fetch"

interface ChatMessage {
  id: number
  room_id: number
  author_id: number | null
  text: string | null
  reply_to_id: number | null
  created_at: string | null
  edited_at: string | null
  deleted_at: string | null
}

interface Props {
  dealId: number
  currentUserId: number | null
  usersById: Map<number, string>
}

const POLL_MS = 3000

export default function DealChatPanel({ dealId, currentUserId, usersById }: Props) {
  const { toast } = useToast()

  const [roomId, setRoomId] = useState<number | null>(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastIdRef = useRef<number>(0)

  // Автоподгонка высоты textarea под контент — от одной строки (как
  // кнопка отправки) до max-h ~4 строк. Считаем каждый раз при изменении
  // text; useLayoutEffect — чтобы не мигало между кадрами.
  useLayoutEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = "auto"
    const next = Math.min(ta.scrollHeight, 120)
    ta.style.height = `${Math.max(next, 36)}px`
  }, [text])

  // 1) Получить room_id.
  useEffect(() => {
    let ignore = false
    setRoomLoading(true)
    crmGet<{ room_id: number }>(`/api/admin/deals/${dealId}/chat-room`)
      .then((res) => {
        if (!ignore) {
          setRoomId(res.room_id)
          setRoomError(null)
        }
      })
      .catch((e) => {
        if (!ignore) {
          setRoomId(null)
          setRoomError(e?.message || "Чат сделки не найден")
        }
      })
      .finally(() => { if (!ignore) setRoomLoading(false) })
    return () => { ignore = true }
  }, [dealId])

  // 2) Загрузить сообщения когда есть roomId.
  useEffect(() => {
    if (!roomId) return
    let ignore = false
    setInitialLoading(true)
    crmGet<{ messages: ChatMessage[] }>(
      `/api/admin/chat/rooms/${roomId}/messages?limit=100`,
    )
      .then((res) => {
        if (ignore) return
        const list = res.messages || []
        // Бэк отдаёт последние 100 в desc. Разворачиваем в asc.
        const asc = [...list].sort((a, b) => a.id - b.id)
        setMessages(asc)
        lastIdRef.current = asc.length ? asc[asc.length - 1].id : 0
        // Пометить прочитанным.
        crmPost(`/api/admin/chat/rooms/${roomId}/read`, {}).catch(() => {})
      })
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить чат",
          description: e?.message,
        })
      })
      .finally(() => { if (!ignore) setInitialLoading(false) })
    return () => { ignore = true }
  }, [roomId, toast])

  // 3) Polling новых сообщений.
  useEffect(() => {
    if (!roomId) return
    let stopped = false

    const poll = async () => {
      if (stopped) return
      try {
        const res = await crmGet<{ messages: ChatMessage[] }>(
          `/api/admin/chat/rooms/${roomId}/messages?after=${lastIdRef.current}&limit=50`,
        )
        const fresh = (res.messages || []).sort((a, b) => a.id - b.id)
        if (fresh.length && !stopped) {
          setMessages((prev) => [...prev, ...fresh])
          lastIdRef.current = fresh[fresh.length - 1].id
        }
      } catch {
        // Тихо — сеть/бэк может блымнуть; след. тик попробует ещё.
      }
    }

    const t = setInterval(poll, POLL_MS)
    return () => { stopped = true; clearInterval(t) }
  }, [roomId])

  // Автоскролл вниз при новом сообщении.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    // Скроллим если юзер был внизу (порог 80px), либо это его собственное сообщение.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    const last = messages[messages.length - 1]
    if (nearBottom || (last && last.author_id === currentUserId)) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, currentUserId])

  const handleSend = useCallback(async () => {
    if (!roomId) return
    const value = text.trim()
    if (!value) return
    setSending(true)
    try {
      const res = await crmPost<{ message: ChatMessage }>(
        `/api/admin/chat/rooms/${roomId}/messages`,
        { text: value },
      )
      // Добавим сразу — polling потом просто пропустит по id.
      setMessages((prev) => [...prev, res.message])
      lastIdRef.current = Math.max(lastIdRef.current, res.message.id)
      setText("")
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не отправилось",
        description: e?.message,
      })
    } finally {
      setSending(false)
    }
  }, [roomId, text, toast])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ---- render ----

  return (
    <Card className="rounded-xl border-gray-200 flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-gray-200 shrink-0">
        <h2 className="text-base font-semibold">Чат сделки</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Виден Ответственному, Постановщику, Соисполнителям и Наблюдателям
        </p>
      </div>

      {/* Body */}
      {roomLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !roomId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <MessageSquareOff className="h-8 w-8 text-gray-400" />
          <div className="text-sm text-gray-500">
            Чат для этой сделки не создан
          </div>
          <div className="text-xs text-gray-400">
            {roomError || "Обычно чат создаётся автоматически при создании сделки"}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0"
          >
            {initialLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">
                Сообщений пока нет. Напишите первое.
              </div>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1]
                const showAuthor = !prev || prev.author_id !== m.author_id
                return (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    isMine={m.author_id === currentUserId}
                    authorName={
                      m.author_id != null
                        ? usersById.get(m.author_id) ?? `#${m.author_id}`
                        : "система"
                    }
                    showAuthor={showAuthor}
                  />
                )
              })
            )}
          </div>

          <div className="border-t border-gray-200 p-2 shrink-0">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Написать сообщение…"
                className="resize-none text-sm py-1.5 min-h-9 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 leading-snug"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="bg-brand-yellow text-black hover:bg-yellow-500 h-9 w-9 rounded-full shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

// ============================================================================

function MessageBubble({
  msg,
  isMine,
  authorName,
  showAuthor,
}: {
  msg: ChatMessage
  isMine: boolean
  authorName: string
  showAuthor: boolean
}) {
  if (msg.deleted_at) {
    return (
      <div className={cn("text-xs italic text-gray-400", isMine ? "text-right" : "text-left")}>
        сообщение удалено
      </div>
    )
  }
  const displayAuthor = isMine ? "Я" : authorName
  return (
    <div className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
      {showAuthor && (
        <div className="text-[11px] text-gray-500 mb-0.5 px-2 flex items-center gap-1.5">
          <span className={cn("font-medium", isMine && "text-gray-600")}>
            {displayAuthor}
          </span>
          <span className="text-gray-400 tabular-nums">
            {formatStamp(msg.created_at)}
          </span>
          {msg.edited_at && <span className="text-gray-400">· изм.</span>}
        </div>
      )}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words",
        isMine
          ? "bg-brand-yellow text-black rounded-br-sm"
          : "bg-gray-100 text-gray-800 rounded-bl-sm",
      )}>
        {msg.text}
      </div>
    </div>
  )
}

function formatStamp(iso: string | null): string {
  // Дата — только если сообщение не сегодня, иначе просто время.
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
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}
