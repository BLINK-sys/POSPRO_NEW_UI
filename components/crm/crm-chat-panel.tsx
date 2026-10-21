"use client"

/**
 * Универсальная чат-панель для сделки и задачи. Общий компонент,
 * который берёт `chatRoomEndpoint` (готовый URL для получения room_id)
 * — вся дальнейшая логика (сообщения, polling, аттач-файлы, глаз с
 * прочитавшими) не зависит от типа сущности.
 *
 * Возможности сверх «просто написать текст»:
 *  • скрепка → выбор одного или нескольких файлов → POST на
 *    `/messages/upload` multipart. Файл автоматически попадает в
 *    «Документы» сделки/задачи (см. бэк — параллельно создаётся
 *    EntityAttachment).
 *  • полученные вложения рисуются под текстом bubble отдельными
 *    компактными карточками файла.
 *  • у каждого сообщения — индикатор «глаз» справа с цветом:
 *      • зелёный   — все члены чата кроме автора прочитали
 *      • жёлтый    — прочитали не все
 *      • красный   — никто кроме автора
 *    По клику открывается модалка со списком членов и их last_read_at
 *    относительно этого конкретного сообщения.
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react"
import {
  Loader2, Send, MessageSquareOff, Paperclip, Eye, X, Trash2,
  Download, FileText, Image as ImageIcon, Video as VideoIcon, File as FileIcon,
  SmilePlus, Reply, Pencil, Check, Search as SearchIcon,
  ChevronUp, ChevronDown, Pin, PinOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { useChatUnread } from "@/context/chat-unread-context"
import { cn } from "@/lib/utils"
import { crmGet, crmPost, crmPut, crmDelete, crmUpload } from "@/lib/crm-fetch"
import { getImageUrl } from "@/lib/image-utils"
import {
  REACTION_EMOJI,
  type ChatAttachment,
  type ChatMessage,
  type ChatReactionGroup,
} from "@/lib/chat-types"

interface ReadStatusMember {
  user_id: number
  last_read_at: string | null
}

interface Props {
  /**
   * Endpoint, откуда взять `room_id`. Используется на карточке
   * сделки/задачи, где id комнаты неизвестен наперёд. Игнорируется
   * если задан `directRoomId`.
   */
  chatRoomEndpoint?: string
  /**
   * Прямая передача id комнаты. Используется в /admin/chat, где мы
   * уже знаем id из списка комнат. Если задан — `chatRoomEndpoint`
   * пропускается.
   */
  directRoomId?: number
  currentUserId: number | null
  usersById: Map<number, string>
  title?: string
  subtitle?: string
  emptyText?: string
  /**
   * Родитель может передать колбэк — вызывается после успешной загрузки
   * файлов через `/messages/upload`. Мы используем это в deal/task
   * -detail: инкрементим `refreshKey` у DocumentsCard, чтобы файл
   * появился в разделе «Документы» сразу, без reload страницы.
   */
  onAttachmentUploaded?: () => void
  /**
   * Вызывается после успешной отправки сообщения (текстового или с
   * вложениями). На /admin/chat родитель по этому колбэку сразу
   * обновит список комнат, чтобы last_message/updated_at в сайдбаре
   * подхватились.
   */
  onMessageSent?: () => void
  /**
   * Read-only режим: чат архивирован (сделка/задача удалена, но
   * переписка сохранена). Скрываем input, реакции, edit/delete.
   */
  readOnly?: boolean
  /**
   * Без внешней Card-обёртки (rounded-xl + border). Используется в
   * плавающем виджете чата — там уже есть своя оболочка.
   */
  chromeless?: boolean
}

/**
 * Fallback-polling новых сообщений — тихая страховка. SSE-канал живёт
 * в ChatUnreadProvider (один на всё приложение), мы подписываемся
 * через pub/sub. Polling подстрахует если провайдер SSE не поднял.
 */
const POLL_FALLBACK_MS = 30_000

export default function CrmChatPanel({
  chatRoomEndpoint, directRoomId,
  currentUserId, usersById,
  title = "Чат", subtitle, emptyText,
  onAttachmentUploaded, onMessageSent,
  readOnly = false,
  chromeless = false,
}: Props) {
  const { toast } = useToast()
  const {
    markRoomRead, setActiveRoom,
    subscribeMessage, subscribeReaction, subscribeRead,
    onlineUserIds,
  } = useChatUnread()

  const [roomId, setRoomId] = useState<number | null>(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [text, setText] = useState("")
  // Ключ для black-list'а начальной загрузки черновика — чтобы загрузка
  // не сработала повторно при смене text (draft-save реагирует на text).
  const draftLoadedRef = useRef<number | null>(null)
  // Пагинация истории: подгрузка старых сообщений при скролле вверх.
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  /**
   * id первого непрочитанного сообщения при открытии комнаты. Полоска
   * «Новые сообщения» рисуется перед ним. Значение зафиксировано на
   * момент mount и не двигается — новые сообщения во время сессии
   * появляются НИЖЕ полоски, чтобы пользователь видел границу.
   */
  const [newSeparatorMsgId, setNewSeparatorMsgId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [readStatus, setReadStatus] = useState<ReadStatusMember[]>([])
  const [openReadFor, setOpenReadFor] = useState<ChatMessage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null)
  // Reply: активная цитата на which id (визуальная плашка над Textarea).
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  // Edit: id редактируемого сообщения + текущий текст-черновик.
  const [editingId, setEditingId] = useState<number | null>(null)
  // Поиск по истории — не фильтруем ленту, а скроллим к совпадениям.
  // Стрелки навигируют по matches сверху вниз.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchIdx, setSearchIdx] = useState(0)
  // @упоминания: autocomplete по членам комнаты. mentionQuery=null → dropdown закрыт.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState<number>(0)
  const [mentionIdx, setMentionIdx] = useState<number>(0)
  const [editText, setEditText] = useState("")

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastIdRef = useRef<number>(0)
  // Синхронный lock против двойного POST из handleSend. React setState
  // асинхронный, повторный Enter до завершения POST проскакивает проверку
  // `sending` и шлёт второе сообщение (Данияр у себя задвоил сообщение
  // именно поэтому).
  const sendingRef = useRef(false)

  useLayoutEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = "auto"
    const next = Math.min(ta.scrollHeight, 120)
    ta.style.height = `${Math.max(next, 36)}px`
  }, [text])

  // 1) room_id: либо прямо задан (режим /admin/chat), либо тянем через
  // endpoint (карточки сделки/задачи).
  useEffect(() => {
    if (directRoomId != null) {
      setRoomId(directRoomId)
      setRoomError(null)
      setRoomLoading(false)
      return
    }
    if (!chatRoomEndpoint) {
      setRoomId(null)
      setRoomError("Не задан chatRoomEndpoint или directRoomId")
      setRoomLoading(false)
      return
    }
    let ignore = false
    setRoomLoading(true)
    crmGet<{ room_id: number }>(chatRoomEndpoint)
      .then((res) => {
        if (!ignore) { setRoomId(res.room_id); setRoomError(null) }
      })
      .catch((e) => {
        if (!ignore) { setRoomId(null); setRoomError(e?.message || "Чат не найден") }
      })
      .finally(() => { if (!ignore) setRoomLoading(false) })
    return () => { ignore = true }
  }, [chatRoomEndpoint, directRoomId])

  // 2) первичная загрузка сообщений
  useEffect(() => {
    if (!roomId) return
    let ignore = false
    setInitialLoading(true)
    setHasMoreOlder(true)
    setLoadingOlder(false)
    crmGet<{ messages: ChatMessage[] }>(
      `/api/admin/chat/rooms/${roomId}/messages?limit=100`,
    )
      .then((res) => {
        if (ignore) return
        const asc = [...(res.messages || [])].sort((a, b) => a.id - b.id)
        setMessages(asc)
        lastIdRef.current = asc.length ? asc[asc.length - 1].id : 0
        // Если бэк вернул меньше limit'а, значит история кончилась.
        setHasMoreOlder(asc.length >= 100)
        // Полоска «Новые» — до POST /read, потому что read сотрёт
        // last_read_at. Ищем первое чужое сообщение созданное после
        // моего last_read_at.
        crmGet<{ members: ReadStatusMember[] }>(
          `/api/admin/chat/rooms/${roomId}/read-status`,
        ).then((rs) => {
          if (ignore) return
          const me = (rs.members || []).find((m) => m.user_id === currentUserId)
          const myReadTs = me?.last_read_at ? new Date(me.last_read_at).getTime() : 0
          const firstUnread = asc.find((m) => {
            if (m.author_id === currentUserId) return false
            const t = m.created_at ? new Date(m.created_at).getTime() : 0
            return t > myReadTs && t > 0
          })
          setNewSeparatorMsgId(firstUnread?.id ?? null)
        }).catch(() => setNewSeparatorMsgId(null))
        crmPost(`/api/admin/chat/rooms/${roomId}/read`, {}).catch(() => {})
        // Мгновенно занулим глобальный badge этой комнаты, чтобы не
        // ждать очередной 30-сек poll ChatUnreadProvider.
        markRoomRead(roomId)
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
  }, [roomId, toast, markRoomRead])

  // 3) polling новых сообщений
  // 3) SSE-стрим новых сообщений и реакций. Один стрим на всего юзера
  //    (глобально по всем комнатам), тут фильтруем по `roomId` — если
  //    событие в другой комнате, игнорируем.
  //
  //    Fallback: если SSE отвалился (мобильная сеть, туннель, запрет
  //    proxy) — раз в 15 сек тихо докатываем через polling `?after=`.
  // Один SSE-стрим на всё приложение живёт в ChatUnreadProvider.
  // Тут подписываемся через pub/sub — без создания своего EventSource,
  // так переключение между чатами не переоткрывает стрим (это была
  // причина 20-сек «повисаний» при клике по комнатам).
  //
  // Fallback polling (15 сек) — на случай если провайдер не поднял SSE
  // (гость, offline, разрыв связи).
  useEffect(() => {
    if (!roomId) return
    let stopped = false

    const pollFallback = async () => {
      if (stopped) return
      try {
        const res = await crmGet<{ messages: ChatMessage[] }>(
          `/api/admin/chat/rooms/${roomId}/messages?after=${lastIdRef.current}&limit=50`,
        )
        const fresh = (res.messages || []).sort((a, b) => a.id - b.id)
        if (fresh.length && !stopped) {
          setMessages((prev) => mergeMessages(prev, fresh))
          lastIdRef.current = fresh[fresh.length - 1].id
        }
      } catch { /* silent */ }
    }
    const pollTimer = setInterval(pollFallback, POLL_FALLBACK_MS)

    // ---- Подписки на события от провайдера ----
    const unsubMsg = subscribeMessage((msg) => {
      if (stopped) return
      if (msg.room_id !== roomId) return
      setMessages((prev) => mergeMessages(prev, [msg]))
      lastIdRef.current = Math.max(lastIdRef.current, msg.id)
      // Комната открыта — пришедшее сообщение сразу «прочитано».
      if (msg.author_id !== currentUserId) {
        crmPost(`/api/admin/chat/rooms/${roomId}/read`, {}).catch(() => {})
        markRoomRead(roomId)
      }
    })

    const unsubRead = subscribeRead((payload) => {
      if (stopped) return
      if (payload.room_id !== roomId) return
      setReadStatus((prev) => {
        const i = prev.findIndex((m) => m.user_id === payload.user_id)
        if (i < 0) return [...prev, { user_id: payload.user_id, last_read_at: payload.last_read_at }]
        const next = [...prev]
        next[i] = { user_id: payload.user_id, last_read_at: payload.last_read_at }
        return next
      })
    })

    const unsubReaction = subscribeReaction((payload) => {
      if (stopped) return
      if (payload.room_id != null && payload.room_id !== roomId) return
      setMessages((prev) => prev.map((m) => {
        if (m.id !== payload.message_id) return m
        const groups = m.reactions ? [...m.reactions] : []
        const gi = groups.findIndex((g) => g.emoji === payload.emoji)
        if (payload.action === "added") {
          if (gi < 0) groups.push({ emoji: payload.emoji, user_ids: [payload.user_id] })
          else if (!groups[gi].user_ids.includes(payload.user_id))
            groups[gi] = { ...groups[gi], user_ids: [...groups[gi].user_ids, payload.user_id] }
        } else {
          if (gi >= 0) {
            const uids = groups[gi].user_ids.filter((x) => x !== payload.user_id)
            if (uids.length === 0) groups.splice(gi, 1)
            else groups[gi] = { ...groups[gi], user_ids: uids }
          }
        }
        return { ...m, reactions: groups }
      }))
    })

    return () => {
      stopped = true
      unsubMsg()
      unsubRead()
      unsubReaction()
      clearInterval(pollTimer)
    }
  }, [roomId, currentUserId, markRoomRead, subscribeMessage, subscribeRead, subscribeReaction])

  // 4) Разовый snapshot read-status при открытии комнаты. Дальше
  //    обновления приходят через SSE event: read — polling не нужен.
  useEffect(() => {
    if (!roomId) return
    let stopped = false
    crmGet<{ members: ReadStatusMember[] }>(
      `/api/admin/chat/rooms/${roomId}/read-status`,
    )
      .then((res) => { if (!stopped) setReadStatus(res.members || []) })
      .catch(() => { /* silent */ })
    return () => { stopped = true }
  }, [roomId])

  /**
   * Подгрузка старых сообщений. Вызывается когда пользователь
   * прокрутил в самый верх ленты. Использует `before=<firstId>` —
   * бэк вернёт messages id < firstId, DESC by id.
   *
   * Сохраняем позицию scroll'а — сравниваем scrollHeight до и после
   * prepend, чтобы визуально пользователь оставался на том же
   * сообщении, а не отскакивал в верх.
   */
  const loadOlder = useCallback(async () => {
    if (!roomId || loadingOlder || !hasMoreOlder) return
    if (messages.length === 0) return
    const firstId = messages[0].id
    const el = listRef.current
    const oldScrollHeight = el?.scrollHeight ?? 0
    const oldScrollTop = el?.scrollTop ?? 0
    setLoadingOlder(true)
    try {
      const res = await crmGet<{ messages: ChatMessage[] }>(
        `/api/admin/chat/rooms/${roomId}/messages?before=${firstId}&limit=50`,
      )
      const older = (res.messages || []).sort((a, b) => a.id - b.id)
      if (older.length === 0) {
        setHasMoreOlder(false)
        return
      }
      if (older.length < 50) setHasMoreOlder(false)
      setMessages((prev) => [...older, ...prev])
      // requestAnimationFrame — bubble отрисовались, scrollHeight обновился.
      requestAnimationFrame(() => {
        if (!el) return
        const diff = el.scrollHeight - oldScrollHeight
        el.scrollTop = oldScrollTop + diff
      })
    } catch { /* silent */ }
    finally { setLoadingOlder(false) }
  }, [roomId, loadingOlder, hasMoreOlder, messages])

  // Intersection observer на «маячке» в самом верху ленты. Как только
  // маячок попадает в viewport (пользователь долистал до верха) —
  // подгружаем предыдущую страницу.
  const topSentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = topSentinelRef.current
    const root = listRef.current
    if (!el || !root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) loadOlder()
        }
      },
      { root, rootMargin: "0px", threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadOlder, roomId])

  // Регистрируем в глобальном контексте что этот roomId сейчас открыт —
  // провайдер не будет инкрементить unread для чужих сообщений в неё.
  useEffect(() => {
    if (!roomId) return
    setActiveRoom(roomId)
    return () => setActiveRoom(null)
  }, [roomId, setActiveRoom])

  // Черновик в localStorage. Загружаем один раз при открытии комнаты,
  // сохраняем при каждом изменении, чистим после успешного send.
  useEffect(() => {
    if (!roomId) return
    if (draftLoadedRef.current === roomId) return
    draftLoadedRef.current = roomId
    try {
      const saved = localStorage.getItem(`chat_draft_${roomId}`)
      if (saved) setText(saved)
    } catch { /* private mode / disabled */ }
  }, [roomId])
  useEffect(() => {
    if (!roomId) return
    if (draftLoadedRef.current !== roomId) return
    try {
      if (text) localStorage.setItem(`chat_draft_${roomId}`, text)
      else localStorage.removeItem(`chat_draft_${roomId}`)
    } catch { /* silent */ }
  }, [roomId, text])

  // Автоскролл:
  //  • при первой загрузке комнаты — скроллим в самый низ всегда
  //  • при новом сообщении (id вырос) — тоже в низ
  //  • при новой реакции у последнего сообщения — тоже (если юзер
  //    был около низа, чтобы реакция не пропала за границей окна)
  const scrolledForRoomRef = useRef<number | null>(null)
  const lastRenderedIdRef = useRef<number>(0)
  const reactionSumRef = useRef<number>(0)
  useEffect(() => {
    const el = listRef.current
    if (!el || messages.length === 0) return
    const lastId = messages[messages.length - 1].id
    const firstTimeForRoom = scrolledForRoomRef.current !== roomId
    const newMessageArrived = lastId > lastRenderedIdRef.current
    // Сумма всех user_ids по всем реакциям — детектор что реакции
    // изменились (добавили/убрали/новую поставили).
    const rxSum = messages.reduce(
      (s, m) => s + (m.reactions?.reduce((a, r) => a + r.user_ids.length, 0) || 0),
      0,
    )
    const reactionsChanged = rxSum !== reactionSumRef.current
    reactionSumRef.current = rxSum
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140
    if (firstTimeForRoom || newMessageArrived || (reactionsChanged && nearBottom)) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
      scrolledForRoomRef.current = roomId
      lastRenderedIdRef.current = lastId
    }
  }, [messages, roomId])

  // Map по id — для рендера цитаты reply и scroll к оригиналу.
  const messagesById = useMemo(() => {
    const map = new Map<number, ChatMessage>()
    for (const m of messages) map.set(m.id, m)
    return map
  }, [messages])

  /** Прокрутить к сообщению-оригиналу цитаты. Даём короткий highlight. */
  const scrollToMessage = useCallback((id: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-2", "ring-brand-yellow", "rounded-2xl")
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-brand-yellow", "rounded-2xl")
    }, 1200)
  }, [])

  const handleSend = useCallback(async () => {
    if (!roomId) return
    if (sendingRef.current) return
    const value = text.trim()
    if (!value) return
    sendingRef.current = true
    setSending(true)
    try {
      const body: { text: string; reply_to_id?: number } = { text: value }
      if (replyTo) body.reply_to_id = replyTo.id
      const res = await crmPost<{ message: ChatMessage }>(
        `/api/admin/chat/rooms/${roomId}/messages`,
        body,
      )
      setMessages((prev) => mergeMessages(prev, [res.message]))
      lastIdRef.current = Math.max(lastIdRef.current, res.message.id)
      setText("")
      try { localStorage.removeItem(`chat_draft_${roomId}`) } catch {}
      setReplyTo(null)
      onMessageSent?.()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не отправилось",
        description: e?.message,
      })
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [roomId, text, replyTo, toast, onMessageSent])

  /**
   * Toggle реакции: если текущий юзер уже поставил этот эмодзи —
   * удаляется (бэк сам разруливает по author=me + emoji). Оптимистично
   * обновляем локальный список групп реакций, чтобы UI не подпрыгивал.
   */
  const handleReactionToggle = useCallback(async (msg: ChatMessage, emoji: string) => {
    if (currentUserId == null) return
    // Оптимистичный апдейт
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msg.id) return m
      const groups: ChatReactionGroup[] = m.reactions ? [...m.reactions] : []
      const gi = groups.findIndex((g) => g.emoji === emoji)
      if (gi < 0) {
        groups.push({ emoji, user_ids: [currentUserId] })
      } else {
        const uids = groups[gi].user_ids
        if (uids.includes(currentUserId)) {
          const filtered = uids.filter((x) => x !== currentUserId)
          if (filtered.length === 0) groups.splice(gi, 1)
          else groups[gi] = { ...groups[gi], user_ids: filtered }
        } else {
          groups[gi] = { ...groups[gi], user_ids: [...uids, currentUserId] }
        }
      }
      return { ...m, reactions: groups }
    }))
    try {
      await crmPost(`/api/admin/chat/messages/${msg.id}/reactions`, { emoji })
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Реакция не поставилась",
        description: e?.message,
      })
      // Откат — SSE event: reaction всё равно приведёт состояние к
      // истине, но чтобы не ждать сеть — просто перезаберём сообщение
      // через after=id-1.
    }
  }, [currentUserId, toast])

  /** Toggle pin — вызывается из hover-меню bubble. */
  const handleTogglePin = useCallback(async (msg: ChatMessage) => {
    const isPinned = !!msg.pinned_at
    // Оптимистично обновляем локально; SSE через edited_at подтянет всех остальных.
    setMessages((prev) => prev.map((m) =>
      m.id === msg.id
        ? { ...m, pinned_at: isPinned ? null : new Date().toISOString(), pinned_by: isPinned ? null : currentUserId }
        : m,
    ))
    try {
      await crmPost(`/api/admin/chat/messages/${msg.id}/${isPinned ? "unpin" : "pin"}`, {})
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: isPinned ? "Не удалось открепить" : "Не удалось закрепить",
        description: e?.message,
      })
      // Откат.
      setMessages((prev) => prev.map((m) =>
        m.id === msg.id
          ? { ...m, pinned_at: msg.pinned_at, pinned_by: msg.pinned_by }
          : m,
      ))
    }
  }, [currentUserId, toast])

  /** Начать редактирование своего сообщения (кнопка pencil на hover). */
  const handleStartEdit = useCallback((msg: ChatMessage) => {
    setEditingId(msg.id)
    setEditText(msg.text || "")
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditText("")
  }, [])

  /**
   * Обработчик изменения текста + вычисление mention-query. Ищем `@` перед
   * курсором и после `@` — префикс имени без пробела. Пусто → dropdown
   * открыт со всеми. Есть пробел после `@` → dropdown закрыт.
   */
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)
    const cursor = e.target.selectionStart ?? value.length
    // Ищем @ идущий назад от cursor, не пересечь пробел/новую строку.
    let at = -1
    for (let i = cursor - 1; i >= 0; i--) {
      const ch = value[i]
      if (ch === "@") { at = i; break }
      if (ch === " " || ch === "\n" || ch === "\t") break
    }
    if (at < 0) {
      setMentionQuery(null)
      return
    }
    // Проверим что перед @ либо начало, либо пробел/перенос (иначе email a@b).
    const before = at === 0 ? " " : value[at - 1]
    if (before !== " " && before !== "\n" && before !== "\t" && at !== 0) {
      setMentionQuery(null)
      return
    }
    const q = value.slice(at + 1, cursor)
    setMentionAnchor(at)
    setMentionQuery(q)
    setMentionIdx(0)
  }, [])

  /** Кандидаты для mention — участники комнаты (readStatus) кроме меня, отфильтрованные по query. */
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return readStatus
      .filter((m) => m.user_id !== currentUserId)
      .map((m) => ({ user_id: m.user_id, name: usersById.get(m.user_id) ?? `#${m.user_id}` }))
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [mentionQuery, readStatus, currentUserId, usersById])

  const insertMention = useCallback((user: { user_id: number; name: string }) => {
    const before = text.slice(0, mentionAnchor)
    const afterCursorStart = mentionAnchor + 1 + (mentionQuery?.length || 0)
    const after = text.slice(afterCursorStart)
    // Первое слово имени (обычно фамилия) — вставим только его чтоб компактно.
    const mention = user.name.split(/\s+/)[0]
    const inserted = `@${mention} `
    const newText = before + inserted + after
    setText(newText)
    setMentionQuery(null)
    // Ставим курсор в конце вставленного mention.
    requestAnimationFrame(() => {
      const ta = inputRef.current
      if (!ta) return
      const pos = before.length + inserted.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }, [text, mentionAnchor, mentionQuery])

  /** Сохранить правки: PUT /messages/<id>. Бэк отвергнет если >5 мин. */
  const handleSaveEdit = useCallback(async () => {
    if (editingId == null) return
    const value = editText.trim()
    if (!value) {
      // Пустой текст = «удалить» скорее, чем «сохранить». Не делаем.
      toast({ variant: "destructive", title: "Текст пустой" })
      return
    }
    const id = editingId
    try {
      const res = await crmPut<{ message: ChatMessage }>(
        `/api/admin/chat/messages/${id}`,
        { text: value },
      )
      setMessages((prev) => prev.map((m) => (m.id === id ? res.message : m)))
      setEditingId(null)
      setEditText("")
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось сохранить",
        description: e?.message,
      })
    }
  }, [editingId, editText, toast])

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!roomId) return
    const arr = Array.from(files)
    if (!arr.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      for (const f of arr) fd.append("file", f)
      // Опционально прикрепляем ещё и текущий текст, если он есть —
      // одно сообщение с файлами и текстом.
      const t = text.trim()
      if (t) fd.append("text", t)
      if (replyTo) fd.append("reply_to_id", String(replyTo.id))
      const res = await crmUpload<{ message: ChatMessage }>(
        `/api/admin/chat/rooms/${roomId}/messages/upload`,
        fd,
      )
      setMessages((prev) => mergeMessages(prev, [res.message]))
      lastIdRef.current = Math.max(lastIdRef.current, res.message.id)
      if (t) setText("")
      setReplyTo(null)
      toast({ title: `Отправлено файлов: ${arr.length}` })
      onAttachmentUploaded?.()
      onMessageSent?.()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось загрузить",
        description: e?.message,
      })
    } finally {
      setUploading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    try {
      await crmDelete(`/api/admin/chat/messages/${id}`)
      // Soft-delete: заменяем локально, чтобы UI сразу показал
      // «сообщение удалено». Polling это не подхватит — новых id > lastId
      // не появится, а изменение существующего сообщения он не смотрит.
      setMessages((prev) => prev.map((m) =>
        m.id === id
          ? { ...m, deleted_at: new Date().toISOString(), text: null }
          : m,
      ))
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  const rootCls = cn(
    "flex flex-col overflow-hidden h-full",
    chromeless ? "bg-white" : "rounded-xl border-gray-200 border bg-white",
  )

  // Массив id сообщений с совпадением — для скролла по стрелкам.
  const searchTrimmed = searchQuery.trim().toLowerCase()
  const searchMatches = useMemo(() => {
    if (!searchOpen || !searchTrimmed) return [] as number[]
    return messages
      .filter((m) => (m.text || "").toLowerCase().includes(searchTrimmed))
      .map((m) => m.id)
  }, [messages, searchOpen, searchTrimmed])

  // При смене результатов возвращаемся к первому (index 0).
  useEffect(() => { setSearchIdx(0) }, [searchTrimmed])

  // Скроллим к текущему match'у при смене индекса или самих matches.
  useEffect(() => {
    if (searchMatches.length === 0) return
    const mid = searchMatches[Math.min(searchIdx, searchMatches.length - 1)]
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg-id="${mid}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-2", "ring-brand-yellow", "rounded-2xl")
    const tid = setTimeout(() => {
      el.classList.remove("ring-2", "ring-brand-yellow", "rounded-2xl")
    }, 1500)
    return () => clearTimeout(tid)
  }, [searchIdx, searchMatches])
  const content = (
    <>
      <div className="px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-start gap-2">
          {searchOpen ? (
            // Инпут поиска на месте заголовка. Крестик справа.
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setSearchOpen(false); setSearchQuery("") }
                    else if (e.key === "Enter") {
                      e.preventDefault()
                      if (searchMatches.length > 0) {
                        setSearchIdx((i) => e.shiftKey
                          ? (i - 1 + searchMatches.length) % searchMatches.length
                          : (i + 1) % searchMatches.length)
                      }
                    }
                  }}
                  placeholder="Поиск по сообщениям…"
                  className={cn(
                    "w-full h-8 pl-8 pr-2 rounded-md text-sm bg-white",
                    "border border-gray-200 focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow focus:outline-none",
                  )}
                />
              </div>
              {searchTrimmed && (
                <>
                  <span className="text-[11px] text-gray-500 tabular-nums shrink-0 min-w-[52px] text-center">
                    {searchMatches.length === 0
                      ? "0 из 0"
                      : `${Math.min(searchIdx, searchMatches.length - 1) + 1} из ${searchMatches.length}`}
                  </span>
                  <button
                    type="button"
                    disabled={searchMatches.length === 0}
                    onClick={() => setSearchIdx((i) =>
                      (i - 1 + searchMatches.length) % searchMatches.length,
                    )}
                    title="Предыдущее (Shift+Enter)"
                    className="h-7 w-7 rounded-md inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 focus:outline-none shrink-0"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={searchMatches.length === 0}
                    onClick={() => setSearchIdx((i) =>
                      (i + 1) % searchMatches.length,
                    )}
                    title="Следующее (Enter)"
                    className="h-7 w-7 rounded-md inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 focus:outline-none shrink-0"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold truncate">{title}</h2>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          )}
          {searchOpen && (
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery("") }}
              title="Закрыть поиск"
              className="h-7 w-7 rounded-full inline-flex items-center justify-center bg-gray-100 text-gray-900 hover:bg-gray-200 focus:outline-none shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {(readStatus.length > 0 || !searchOpen) && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 min-w-0">
              {readStatus.length > 0 && (
                <MembersRow
                  members={readStatus}
                  usersById={usersById}
                  currentUserId={currentUserId}
                  compact={chromeless}
                  onlineIds={onlineUserIds}
                />
              )}
            </div>
            {!searchOpen && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                title="Поиск по сообщениям"
                className="h-7 w-7 rounded-full inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none shrink-0 self-end"
              >
                <SearchIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <PinnedBar
          messages={messages}
          usersById={usersById}
          onScrollTo={scrollToMessage}
        />
      </div>

      {roomLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !roomId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <MessageSquareOff className="h-8 w-8 text-gray-400" />
          <div className="text-sm text-gray-500">
            {emptyText || "Чат не создан"}
          </div>
          <div className="text-xs text-gray-400">
            {roomError || "Обычно чат создаётся автоматически"}
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
              <>
              {/* Sentinel + индикатор подгрузки истории. */}
              {hasMoreOlder ? (
                <div ref={topSentinelRef} className="flex items-center justify-center py-2">
                  {loadingOlder && (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 text-center py-1">
                  Начало переписки
                </div>
              )}
              {messages.map((m, i) => {
                const prev = messages[i - 1]
                const showAuthor = !prev || prev.author_id !== m.author_id
                const isMine = m.author_id === currentUserId
                // Показываем pencil для всех своих не-удалённых. Окно
                // «редактировать можно ≤5 мин» проверит бэк — если поздно,
                // handleSaveEdit получит 400 и покажет toast. Так UX
                // предсказуемый и не зависит от TZ-парсинга ISO-строки.
                const canEdit = isMine && !m.deleted_at
                // Разделитель даты — когда день сменился относительно предыдущего.
                const dateSep = shouldShowDateSep(prev, m)
                const bubble = (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    isMine={isMine}
                    authorName={
                      m.author_id != null
                        ? usersById.get(m.author_id) ?? `#${m.author_id}`
                        : "система"
                    }
                    showAuthor={showAuthor}
                    readStatus={readStatus}
                    currentUserId={currentUserId}
                    usersById={usersById}
                    messagesById={messagesById}
                    isEditing={editingId === m.id}
                    editText={editText}
                    onEditTextChange={setEditText}
                    onStartEdit={canEdit ? () => handleStartEdit(m) : undefined}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    onOpenRead={() => setOpenReadFor(m)}
                    onReply={() => setReplyTo(m)}
                    onReact={(emoji) => handleReactionToggle(m, emoji)}
                    onScrollTo={scrollToMessage}
                    onTogglePin={!m.deleted_at ? () => handleTogglePin(m) : undefined}
                    onDelete={
                      isMine && !m.deleted_at
                        ? () => setDeleteTarget(m)
                        : undefined
                    }
                  />
                )
                const showNewSep = newSeparatorMsgId === m.id
                if (dateSep || showNewSep) {
                  return (
                    <div key={`sep-${m.id}`}>
                      {dateSep && (
                        <div className="flex items-center gap-2 my-2 px-2">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-[11px] text-gray-500 bg-white px-2 rounded-full border border-gray-100">
                            {formatDateSep(m.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      )}
                      {showNewSep && (
                        <div className="flex items-center gap-2 my-2 px-2">
                          <div className="flex-1 h-px bg-emerald-300" />
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Новые сообщения
                          </span>
                          <div className="flex-1 h-px bg-emerald-300" />
                        </div>
                      )}
                      {bubble}
                    </div>
                  )
                }
                return bubble
              })}
              </>
            )}
          </div>

          {readOnly ? (
            <div className="border-t border-gray-200 p-3 shrink-0 bg-gray-50 text-center">
              <div className="text-sm text-gray-700 font-medium">Чат в архиве</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Сделка или задача удалена. Переписка сохранена, но писать нельзя.
              </div>
            </div>
          ) : (
          <div className="border-t border-gray-200 p-2 shrink-0">
            {replyTo && (
              <ReplyPreview
                msg={replyTo}
                authorName={
                  replyTo.author_id != null
                    ? usersById.get(replyTo.author_id) ?? `#${replyTo.author_id}`
                    : "система"
                }
                onCancel={() => setReplyTo(null)}
                onScrollTo={() => scrollToMessage(replyTo.id)}
              />
            )}
            <div className="flex items-end gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleUploadFiles(e.target.files)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 focus:outline-none shrink-0"
                title="Прикрепить файл"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>
              <div className="relative flex-1">
                <Textarea
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={(e) => {
                    // Навигация по mention dropdown.
                    if (mentionQuery !== null && mentionCandidates.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setMentionIdx((i) => (i + 1) % mentionCandidates.length)
                        return
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault()
                        setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length)
                        return
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault()
                        insertMention(mentionCandidates[mentionIdx])
                        return
                      }
                      if (e.key === "Escape") {
                        e.preventDefault()
                        setMentionQuery(null)
                        return
                      }
                    }
                    handleKey(e)
                  }}
                  placeholder="Написать сообщение…"
                  className="resize-none text-sm py-1.5 min-h-9 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 leading-snug"
                />
                {mentionQuery !== null && mentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg z-10">
                    {mentionCandidates.map((u, idx) => (
                      <button
                        key={u.user_id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); insertMention(u) }}
                        onMouseEnter={() => setMentionIdx(idx)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2 border-b border-gray-50 last:border-b-0",
                          idx === mentionIdx ? "bg-brand-yellow/25" : "hover:bg-gray-50",
                        )}
                      >
                        <span className="h-6 w-6 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold inline-flex items-center justify-center shrink-0">
                          {initials(u.name)}
                        </span>
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          )}
        </>
      )}

      {/* Модалка «Кто прочитал» */}
      <ReadReceiptDialog
        message={openReadFor}
        readStatus={readStatus}
        usersById={usersById}
        onClose={() => setOpenReadFor(null)}
      />

      {/* Подтверждение удаления сообщения (soft-delete на бэке) */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сообщение?</AlertDialogTitle>
            <AlertDialogDescription>
              Останется отметка «сообщение удалено», текст и файлы
              станут недоступны участникам чата.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
  if (chromeless) {
    return <div className={rootCls}>{content}</div>
  }
  return <Card className={rootCls}>{content}</Card>
}

// ============================================================================

function MessageBubble({
  msg,
  isMine,
  authorName,
  showAuthor,
  readStatus,
  currentUserId,
  usersById,
  messagesById,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenRead,
  onReply,
  onReact,
  onScrollTo,
  onTogglePin,
  onDelete,
}: {
  msg: ChatMessage
  isMine: boolean
  authorName: string
  showAuthor: boolean
  readStatus: ReadStatusMember[]
  currentUserId: number | null
  usersById: Map<number, string>
  messagesById: Map<number, ChatMessage>
  isEditing: boolean
  editText: string
  onEditTextChange: (v: string) => void
  onStartEdit?: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onOpenRead: () => void
  onReply: () => void
  onReact: (emoji: string) => void
  onScrollTo: (id: number) => void
  /** Toggle pin для этого сообщения — pin/unpin по клику. */
  onTogglePin?: () => void
  /** Если задан — рисуется кнопка удаления на hover. Родитель ставит
   *  её только для своих не-удалённых сообщений. */
  onDelete?: () => void
}) {
  if (msg.deleted_at) {
    return (
      <div
        data-msg-id={msg.id}
        className={cn("text-xs italic text-gray-400", isMine ? "text-right" : "text-left")}
      >
        сообщение удалено
      </div>
    )
  }

  const eye = useMemo(
    () => computeReadState(msg, readStatus),
    [msg, readStatus],
  )
  const attachments = msg.attachments || []
  const reactions = msg.reactions || []
  const displayAuthor = isMine ? "Я" : authorName
  const quoted = msg.reply_to_id != null ? messagesById.get(msg.reply_to_id) : null

  // Hover-actions: смайлик (реакция), reply, pencil (свои в окне 5 мин),
  // trash (свои). Расположим горизонтально с одной стороны от bubble.
  const [reactionOpen, setReactionOpen] = useState(false)
  const hoverActions = (
    <div className={cn(
      "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0",
      isEditing && "hidden",
    )}>
      <Popover open={reactionOpen} onOpenChange={setReactionOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-900 p-1 focus:outline-none"
            title="Реакция"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align={isMine ? "end" : "start"} className="w-auto p-1">
          <div className="flex gap-0.5">
            {REACTION_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onReact(e); setReactionOpen(false) }}
                className="h-8 w-8 flex items-center justify-center text-lg rounded hover:bg-gray-100 focus:outline-none"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onReply}
        className="text-gray-400 hover:text-gray-900 p-1 focus:outline-none"
        title="Ответить"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      {onStartEdit && (
        <button
          type="button"
          onClick={onStartEdit}
          className="text-gray-400 hover:text-gray-900 p-1 focus:outline-none"
          title="Редактировать"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {onTogglePin && (
        <button
          type="button"
          onClick={onTogglePin}
          className={cn(
            "p-1 focus:outline-none",
            msg.pinned_at ? "text-brand-yellow" : "text-gray-400 hover:text-gray-900",
          )}
          title={msg.pinned_at ? "Открепить" : "Закрепить"}
        >
          {msg.pinned_at ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      )}
      {isMine && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 p-1 focus:outline-none"
          title="Удалить"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div className={cn("group flex flex-col", isMine ? "items-end" : "items-start")}>
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
        "flex items-center gap-1 max-w-[85%]",
        isMine ? "flex-row" : "flex-row-reverse",
      )}>
        {hoverActions}
        <div
          data-msg-id={msg.id}
          className={cn(
            "rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words transition-shadow min-w-0",
            isMine
              ? "bg-brand-yellow text-black rounded-br-sm"
              : "bg-gray-100 text-gray-800 rounded-bl-sm",
          )}
        >
          {/* Цитата reply — компактная полоска сверху bubble */}
          {msg.reply_to_id != null && (
            <button
              type="button"
              onClick={() => onScrollTo(msg.reply_to_id!)}
              className={cn(
                "block w-full text-left rounded-md mb-1 px-2 py-1 text-[11px] cursor-pointer",
                "border-l-2",
                isMine
                  ? "bg-black/10 border-black/40 hover:bg-black/15"
                  : "bg-white/70 border-gray-400 hover:bg-white",
              )}
            >
              <div className={cn(
                "font-medium truncate",
                isMine ? "text-black/70" : "text-gray-700",
              )}>
                {quoted
                  ? (quoted.author_id != null
                      ? usersById.get(quoted.author_id) ?? `#${quoted.author_id}`
                      : "система")
                  : "сообщение"}
              </div>
              <div className={cn(
                "truncate",
                isMine ? "text-black/60" : "text-gray-500",
              )}>
                {quoted
                  ? (quoted.deleted_at
                      ? "сообщение удалено"
                      : (quoted.text || (quoted.attachments?.length ? "📎 вложение" : "…")))
                  : "…"}
              </div>
            </button>
          )}
          {isEditing ? (
            <div className="flex flex-col gap-1.5 min-w-[240px]">
              <Textarea
                value={editText}
                onChange={(e) => onEditTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    onCancelEdit()
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    onSaveEdit()
                  }
                }}
                rows={2}
                autoFocus
                className={cn(
                  "resize-none text-sm py-1 min-h-[38px] bg-white/60",
                  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0",
                )}
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    isMine ? "hover:bg-black/10" : "hover:bg-gray-200",
                  )}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="px-2 py-0.5 rounded text-xs font-medium bg-black/80 text-white hover:bg-black inline-flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <>
              {msg.text && renderMarkdownLite(msg.text)}
              {attachments.length > 0 && (
                <div className={cn(msg.text && "mt-1.5", "space-y-1")}>
                  {attachments.map((a) => (
                    <AttachmentChip key={a.id} attachment={a} isMine={isMine} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Реакции — чипы под bubble */}
      {reactions.length > 0 && (
        <div className={cn(
          "mt-1 flex flex-wrap gap-1",
          isMine ? "justify-end mr-1" : "justify-start ml-1",
        )}>
          {reactions.map((g) => {
            const mine = currentUserId != null && g.user_ids.includes(currentUserId)
            const names = g.user_ids
              .map((id) => usersById.get(id) ?? `#${id}`)
              .join(", ")
            return (
              <button
                key={g.emoji}
                type="button"
                onClick={() => onReact(g.emoji)}
                title={names}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] transition-colors focus:outline-none",
                  mine
                    ? "bg-yellow-100 border border-brand-yellow text-black"
                    : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200",
                )}
              >
                <span className="text-sm leading-none">{g.emoji}</span>
                <span className="tabular-nums">{g.user_ids.length}</span>
              </button>
            )
          })}
        </div>
      )}
      {/* Read-indicator: показывается только у своих сообщений и только
          если есть с кем сравнивать (≥1 другой член в чате). */}
      {isMine && eye && (
        <button
          type="button"
          onClick={onOpenRead}
          className="mt-0.5 mr-2 inline-flex items-center gap-1 text-[10px] focus:outline-none"
          title={eye.title}
        >
          <Eye className={cn("h-3 w-3", eye.color)} />
          <span className="text-gray-400 tabular-nums">
            {eye.readCount}/{eye.totalCount}
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * Плашка цитаты reply над Textarea. Показывает автора и короткий
 * текст оригинала + крестик «отменить». Клик на плашку — scroll к
 * оригиналу.
 */
function ReplyPreview({
  msg,
  authorName,
  onCancel,
  onScrollTo,
}: {
  msg: ChatMessage
  authorName: string
  onCancel: () => void
  onScrollTo: () => void
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-md border-l-2 border-brand-yellow bg-yellow-50 px-2 py-1">
      <div
        onClick={onScrollTo}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className="text-[11px] font-medium text-gray-700 truncate">
          Ответ · {authorName}
        </div>
        <div className="text-xs text-gray-600 truncate">
          {msg.deleted_at
            ? "сообщение удалено"
            : (msg.text || (msg.attachments?.length ? "📎 вложение" : "…"))}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-900 p-1 focus:outline-none shrink-0"
        title="Отменить ответ"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function AttachmentChip({
  attachment,
  isMine,
}: {
  attachment: ChatAttachment
  isMine: boolean
}) {
  const Icon = iconFor(attachment.mime_type, attachment.file_name)
  const isImage = isImageAttachment(attachment.mime_type, attachment.file_name)

  // file_url лежит в БД как относительный путь `/uploads/...` —
  // абсолютизируем через API_BASE_URL, иначе браузер тянет с домена
  // фронта и получает 404.
  const fullUrl = getImageUrl(attachment.file_url)

  // Изображение показываем как превью: миниатюра в рамке, снизу
  // подпись с именем файла. Клик открывает оригинал в новой вкладке.
  if (isImage) {
    return (
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "block rounded-lg overflow-hidden max-w-[260px]",
          isMine
            ? "bg-black/10 hover:bg-black/15"
            : "bg-white hover:bg-gray-50 border border-gray-200",
        )}
      >
        <img
          src={fullUrl}
          alt={attachment.file_name || ""}
          loading="lazy"
          className="w-full max-h-[220px] object-cover"
        />
        <div className={cn(
          "px-2 py-1 text-[11px] truncate",
          isMine ? "text-black" : "text-gray-700",
        )}>
          {attachment.file_name || "Изображение"}
        </div>
      </a>
    )
  }

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
        isMine
          ? "bg-black/10 hover:bg-black/15 text-black"
          : "bg-white hover:bg-gray-50 text-gray-800 border border-gray-200",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">
          {attachment.file_name || "Файл"}
        </div>
        {attachment.file_size != null && (
          <div className="text-[10px] opacity-70">
            {formatSize(attachment.file_size)}
          </div>
        )}
      </div>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </a>
  )
}

/**
 * Аккуратный merge массива сообщений: новые вставляются, дубликаты
 * (тот же id, например прилетевший через SSE после локального POST)
 * пропускаются, обновлённые (edit/delete) — перезаписываются.
 */
function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return prev
  const byId = new Map(prev.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return Array.from(byId.values()).sort((a, b) => a.id - b.id)
}

function isImageAttachment(mime: string | null, name: string | null): boolean {
  const m = (mime || "").toLowerCase()
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  return m.startsWith("image/")
    || ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)
}

// ============================================================================

function ReadReceiptDialog({
  message,
  readStatus,
  usersById,
  onClose,
}: {
  message: ChatMessage | null
  readStatus: ReadStatusMember[]
  usersById: Map<number, string>
  onClose: () => void
}) {
  const open = Boolean(message)
  if (!message) {
    // Всё равно рендерим Dialog чтобы transition отработал.
    return <Dialog open={false} onOpenChange={() => {}} />
  }
  const createdAt = message.created_at ? new Date(message.created_at).getTime() : 0
  const rows = readStatus
    .filter((m) => m.user_id !== message.author_id)
    .map((m) => {
      const readAt = m.last_read_at ? new Date(m.last_read_at).getTime() : 0
      return {
        user_id: m.user_id,
        name: usersById.get(m.user_id) ?? `#${m.user_id}`,
        read: readAt >= createdAt && readAt > 0,
        last_read_at: m.last_read_at,
      }
    })
    .sort((a, b) => Number(b.read) - Number(a.read) || a.name.localeCompare(b.name))

  const readCount = rows.filter((r) => r.read).length
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Кто прочитал</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-gray-500 -mt-2">
          {readCount} из {rows.length} участников
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            В чате нет других участников
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
            {rows.map((r) => (
              <li key={r.user_id} className="flex items-center gap-2 py-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    r.read ? "bg-emerald-500" : "bg-gray-300",
                  )}
                />
                <span className="text-sm flex-1 min-w-0 truncate">{r.name}</span>
                <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
                  {r.read
                    ? formatStamp(r.last_read_at || null)
                    : "не читал"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================

/**
 * Считает состояние глаза для одного сообщения. Возвращает null если
 * сравнивать не с кем (в чате нет других членов).
 */
function computeReadState(msg: ChatMessage, readStatus: ReadStatusMember[]): {
  color: string
  title: string
  readCount: number
  totalCount: number
} | null {
  const createdAt = msg.created_at ? new Date(msg.created_at).getTime() : 0
  const others = readStatus.filter((m) => m.user_id !== msg.author_id)
  if (others.length === 0) return null
  const readCount = others.filter((m) => {
    const t = m.last_read_at ? new Date(m.last_read_at).getTime() : 0
    return t >= createdAt && t > 0
  }).length
  let color: string
  let title: string
  if (readCount === others.length) {
    color = "text-emerald-500"
    title = `Прочитали все (${readCount} из ${others.length})`
  } else if (readCount > 0) {
    color = "text-amber-500"
    title = `Прочитали ${readCount} из ${others.length}`
  } else {
    color = "text-red-500"
    title = "Никто ещё не прочитал"
  }
  return { color, title, readCount, totalCount: others.length }
}

/**
 * Полоска закреплённых сообщений в шапке чата. Скрывается если нет
 * pinned. При >1 pinned — циклический показ (клик по стрелке пропускает
 * между ними).
 */
function PinnedBar({
  messages,
  usersById,
  onScrollTo,
}: {
  messages: ChatMessage[]
  usersById: Map<number, string>
  onScrollTo: (id: number) => void
}) {
  const pinned = useMemo(
    () => messages.filter((m) => m.pinned_at && !m.deleted_at)
      .sort((a, b) => (b.pinned_at || "").localeCompare(a.pinned_at || "")),
    [messages],
  )
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (idx >= pinned.length && pinned.length > 0) setIdx(0)
  }, [pinned.length, idx])
  if (pinned.length === 0) return null
  const cur = pinned[Math.min(idx, pinned.length - 1)]
  const author = cur.author_id != null ? usersById.get(cur.author_id) ?? `#${cur.author_id}` : "система"
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-brand-yellow/50 bg-brand-yellow/10 px-2 py-1">
      <Pin className="h-3.5 w-3.5 text-brand-yellow shrink-0" />
      <button
        type="button"
        onClick={() => onScrollTo(cur.id)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-[10px] text-gray-500 leading-tight">
          Закреплено · {author}
        </div>
        <div className="text-xs text-gray-800 truncate">
          {cur.text || (cur.attachments?.length ? "📎 вложение" : "…")}
        </div>
      </button>
      {pinned.length > 1 && (
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-[10px] text-gray-500 tabular-nums">
            {idx + 1}/{pinned.length}
          </span>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % pinned.length)}
            title="Следующий закреп"
            className="h-5 w-5 rounded-md inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Компактный список участников чата: одна строка со сжимающимися
 * чипами. При переполнении — «+N ещё», клик разворачивает во все
 * строки.
 */
function MembersRow({
  members,
  usersById,
  currentUserId,
  compact = false,
  onlineIds,
}: {
  members: ReadStatusMember[]
  usersById: Map<number, string>
  currentUserId: number | null
  /**
   * true — узкая панель (плавающий виджет): чипы в одну строку,
   * «+N ещё» разворачивает. false — панель на всю ширину (админка,
   * страницы сделки/задачи): всегда полный список без сворачивания.
   */
  compact?: boolean
  /** Ids юзеров сейчас онлайн — для зелёной точки у аватарки. */
  onlineIds: Set<number>
}) {
  const [expanded, setExpanded] = useState(false)

  const sorted = useMemo(
    () => [...members].sort((a, b) => {
      // Я первый, остальные по имени.
      if (a.user_id === currentUserId) return -1
      if (b.user_id === currentUserId) return 1
      const an = usersById.get(a.user_id) ?? ""
      const bn = usersById.get(b.user_id) ?? ""
      return an.localeCompare(bn)
    }),
    [members, usersById, currentUserId],
  )

  const renderChip = (m: ReadStatusMember) => {
    const name = usersById.get(m.user_id) ?? `#${m.user_id}`
    const isMe = m.user_id === currentUserId
    const isOnline = onlineIds.has(m.user_id)
    return (
      <div
        key={m.user_id}
        title={`${name}${isOnline ? " · онлайн" : ""}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] shrink-0",
          isMe
            ? "bg-brand-yellow/25 border border-brand-yellow/50 text-black"
            : "bg-gray-100 border border-gray-200 text-gray-700",
        )}
      >
        <span className={cn(
          "relative h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0",
          isMe ? "bg-brand-yellow text-black" : "bg-gray-300 text-white",
        )}>
          {initials(name)}
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
          )}
        </span>
        <span className="truncate max-w-[110px]">
          {isMe ? "Я" : shortName(name)}
        </span>
      </div>
    )
  }

  // Не-компактный режим (админка, страницы деталей) — всегда полный
  // список, без кнопки «свернуть». Панель широкая, места хватает.
  if (!compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {sorted.map(renderChip)}
      </div>
    )
  }

  // Развёрнутый вид — как раньше, flex-wrap + кнопка «свернуть».
  if (expanded) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {sorted.map(renderChip)}
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[11px] text-gray-500 hover:text-gray-900 underline underline-offset-2 px-1 shrink-0"
        >
          Свернуть
        </button>
      </div>
    )
  }

  // Свёрнутый вид — одна строка с horizontal scroll'ом чтобы не резать
  // сами чипы, плюс справа «+N ещё» открывающая всё.
  //
  // Оверлей fade справа даёт понять что список продолжается за краем.
  const overflow = sorted.length > 4 ? sorted.length - 4 : 0
  const visible = overflow > 0 ? sorted.slice(0, 4) : sorted
  return (
    <div className="flex items-center gap-1">
      <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map(renderChip)}
      </div>
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] text-gray-500 hover:text-gray-900 shrink-0 px-1 whitespace-nowrap"
          title="Показать всех"
        >
          +{overflow} ещё
        </button>
      )}
    </div>
  )
}

/** Инициалы для аватарки: «Боцан Антон Олегович» → «БА». */
function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Компактное имя для чипа: «Боцан Антон Олегович» → «Боцан А.». */
function shortName(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
}

function iconFor(mime: string | null, name: string | null) {
  const m = (mime || "").toLowerCase()
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return ImageIcon
  if (m.startsWith("video/") || ["mp4", "mov", "webm", "avi", "mkv"].includes(ext))
    return VideoIcon
  if (m === "application/pdf" || ext === "pdf") return FileText
  return FileIcon
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} КБ`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} МБ`
  return `${(mb / 1024).toFixed(2)} ГБ`
}

/**
 * Легковесный markdown-подобный рендер:
 *   **жирный** → <strong>
 *   *курсив*  → <em>
 *   `код`     → <code>
 *   [текст](url) → <a href>
 *   голые URL http(s)://… → <a href>
 * HTML экранируется до подмены.
 */
function renderMarkdownLite(text: string): JSX.Element {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  let html = esc(text)
  // Порядок важен: сначала inline code, потом ссылки, потом bold/italic.
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 text-[0.9em] font-mono">$1</code>')
  // @упоминания — подсвечиваем жёлтым.
  html = html.replace(
    /(^|\s)@([\wа-яА-ЯёЁ\-]+)/g,
    '$1<span class="text-black font-semibold bg-brand-yellow/40 rounded px-1">@$2</span>',
  )
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80">$1</a>',
  )
  // Голые ссылки — только если не внутри уже собранного тега <a>.
  html = html.replace(
    /(^|[^"'>])(https?:\/\/[^\s<]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80">$2</a>',
  )
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

/** Показывать разделитель даты когда день сменился по сравнению с prev. */
function shouldShowDateSep(prev: ChatMessage | undefined, cur: ChatMessage): boolean {
  if (!cur.created_at) return false
  const cd = new Date(cur.created_at)
  if (Number.isNaN(cd.getTime())) return false
  if (!prev || !prev.created_at) return true
  const pd = new Date(prev.created_at)
  if (Number.isNaN(pd.getTime())) return true
  return (
    cd.getFullYear() !== pd.getFullYear() ||
    cd.getMonth() !== pd.getMonth() ||
    cd.getDate() !== pd.getDate()
  )
}

/** «Сегодня», «Вчера», «12 сентября», «12 сен 2025». */
function formatDateSep(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays === 0) return "Сегодня"
  if (diffDays === 1) return "Вчера"
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
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
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}
