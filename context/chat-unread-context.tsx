"use client"

/**
 * Глобальный чат-контекст всего приложения (не только /admin).
 * Поставлен в root layout, чтобы бейджи «Админ» на публичном сайте и
 * бейджи внутри /admin работали от одного и того же источника.
 *
 * Источники данных:
 *  1. Стартовый `GET /api/admin/chat/rooms` при mount + fallback poll
 *     раз в 5 мин на случай десинка (SSE может пропустить событие после
 *     долгого разрыва сети).
 *  2. Один SSE `/api/admin/chat/stream` — при каждом новом сообщении:
 *       • если это чужое сообщение — инкрементим unread комнаты
 *       • last_message комнаты обновляется
 *       • комната поднимается наверх списка
 *  3. Звук: если tab неактивен (`document.hidden`) и сообщение чужое —
 *     короткий «динь» через WebAudio.
 *
 * Активируется только для юзеров с ролью admin/system — для клиентов
 * ничего не запускает и все счётчики = 0.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { crmGet, crmPost } from "@/lib/crm-fetch"
import { useAuth } from "@/context/auth-context"
import type { ChatRoomSummary, ChatMessage } from "@/lib/chat-types"

/** Fallback-опрос списка комнат на случай десинка после долгого разрыва SSE. */
const FALLBACK_POLL_MS = 5 * 60_000

interface State {
  /** Полный список моих комнат — используется в /admin/chat сайдбаром. */
  rooms: ChatRoomSummary[]
  /** Total по обычным chat-комнатам (general/direct/group). */
  chatUnread: number
  /** Deal ids у которых есть unread. */
  dealUnreadIds: Set<number>
  /** Task ids у которых есть unread. */
  taskUnreadIds: Set<number>
  /** Per-room unread — для точечного badge на строке комнаты. */
  byRoom: Map<number, number>
  /**
   * Счётчики непрочитанных Notification'ов по секциям (bell-панель).
   * Заполняются из `/admin/notifications/counts` + инкрементятся при
   * SSE event: notification. Влияют на бейджи в шапке/сайдбаре.
   */
  notifCounts: { deals: number; tasks: number; chat: number }
  /** id юзеров которые сейчас онлайн (heartbeat < 60 сек). */
  onlineUserIds: Set<number>
}

interface ChatUnreadCtx extends State {
  /** Занулить unread конкретной комнаты (когда открыли её). */
  markRoomRead: (roomId: number) => void
  /** Пересчитать сейчас (перезабрать rooms с бэка). */
  refresh: () => void
  /** Тотал по всем комнатам — для бэйджа «Админ» на публичной части. */
  totalUnread: number
  /**
   * Заявить провайдеру, что этот roomId сейчас открыт у пользователя.
   * При приходе SSE-event: message в эту комнату провайдер НЕ будет
   * инкрементить unread — юзер видит сообщение и оно сразу «прочитано».
   * `null` — вышли из чата, снова считаем как обычно.
   */
  setActiveRoom: (roomId: number | null) => void
  /**
   * Pub/sub на SSE-события. CrmChatPanel не открывает свой EventSource —
   * он подписывается тут. Возвращает unsubscribe.
   *
   * Так один SSE-стрим на всю /admin — при переключении между чатами
   * не переоткрывается новое соединение (дорогая операция).
   */
  subscribeMessage: (h: (msg: ChatMessage) => void) => () => void
  subscribeReaction: (h: (r: ChatReactionEvent) => void) => () => void
  subscribeRead: (h: (r: ChatReadEvent) => void) => () => void
  /**
   * Пометить прочитанными все Notification'ы для сущности
   * (deal / task / chat_room). Вызывается со страницы деталей и из
   * /admin/chat при выборе комнаты. Бейдж соответствующего раздела
   * сразу уменьшается.
   */
  markEntityRead: (entityType: string, entityId: number) => Promise<void>
  /** Прочитать все notifications в секции — для bell-панели. */
  markSectionRead: (section: "deals" | "tasks" | "chat") => Promise<void>
  /** Прочитать все notifications у юзера — для bell-панели. */
  markAllRead: () => Promise<void>
}

export interface ChatReactionEvent {
  message_id: number
  emoji: string
  user_id: number
  action: "added" | "removed"
  room_id?: number
}

export interface ChatReadEvent {
  room_id: number
  user_id: number
  last_read_at: string | null
}

export interface NotificationEvent {
  id: number
  kind: string       // chat_new_message | deal_assigned | task_assigned | ...
  section: string    // chat | deals | tasks
  entity_type: string | null
  entity_id: number | null
  payload: Record<string, unknown>
  created_at: string | null
}

const emptyState: State = {
  rooms: [],
  chatUnread: 0,
  dealUnreadIds: new Set(),
  taskUnreadIds: new Set(),
  byRoom: new Map(),
  notifCounts: { deals: 0, tasks: 0, chat: 0 },
  onlineUserIds: new Set(),
}

const Ctx = createContext<ChatUnreadCtx>({
  ...emptyState,
  totalUnread: 0,
  markRoomRead: () => {},
  refresh: () => {},
  setActiveRoom: () => {},
  subscribeMessage: () => () => {},
  subscribeReaction: () => () => {},
  subscribeRead: () => () => {},
  markEntityRead: async () => {},
  markSectionRead: async () => {},
  markAllRead: async () => {},
})

export function useChatUnread() {
  return useContext(Ctx)
}

/**
 * Собирает State из массива rooms. Одна функция и на первичный fetch,
 * и на recompute после SSE-инкремента.
 */
function computeState(
  rooms: ChatRoomSummary[],
  notifCounts: State["notifCounts"] = { deals: 0, tasks: 0, chat: 0 },
  onlineUserIds: Set<number> = new Set(),
): State {
  let chatUnread = 0
  const dealUnreadIds = new Set<number>()
  const taskUnreadIds = new Set<number>()
  const byRoom = new Map<number, number>()
  for (const r of rooms) {
    const u = r.unread || 0
    byRoom.set(r.id, u)
    if (u <= 0) continue
    if (r.kind === "deal" && r.related_deal_id != null) {
      dealUnreadIds.add(r.related_deal_id)
    } else if (r.kind === "task" && r.related_task_id != null) {
      taskUnreadIds.add(r.related_task_id)
    } else {
      chatUnread += u
    }
  }
  // Сортируем по last_message.created_at desc — как на бэке. Держим
  // список отсортированным чтобы chat-messenger сайдбар не пересортировывал.
  const sorted = [...rooms].sort((a, b) => {
    const ta = a.last_message?.created_at || a.created_at || ""
    const tb = b.last_message?.created_at || b.created_at || ""
    return tb.localeCompare(ta)
  })
  return {
    rooms: sorted, chatUnread, dealUnreadIds, taskUnreadIds, byRoom,
    notifCounts, onlineUserIds,
  }
}

export function ChatUnreadProvider({
  userId,
  userRole,
  children,
}: {
  userId: number | null
  userRole: string | null
  children: ReactNode
}) {
  // Активен только для админа/системного. Для гостей и обычных клиентов
  // всё поле state = 0, никаких fetch/SSE.
  const active = !!userId && (userRole === "admin" || userRole === "system")

  const [state, setState] = useState<State>(emptyState)
  /** Актуальный список комнат для локальных инкрементов от SSE. */
  const roomsRef = useRef<ChatRoomSummary[]>([])
  /** id последнего обработанного сообщения — для since= при переподкл SSE. */
  const lastMsgIdRef = useRef<number>(0)
  /** Открытая сейчас комната — не инкрементим unread для сообщений в неё. */
  const activeRoomIdRef = useRef<number | null>(null)

  // Подписчики SSE-событий. CrmChatPanel через useEffect добавляет и
  // удаляет свой handler отсюда — без создания своего EventSource.
  const msgSubsRef = useRef<Set<(msg: ChatMessage) => void>>(new Set())
  const reactionSubsRef = useRef<Set<(r: ChatReactionEvent) => void>>(new Set())
  const readSubsRef = useRef<Set<(r: ChatReadEvent) => void>>(new Set())

  const subscribeMessage = useCallback((h: (msg: ChatMessage) => void) => {
    msgSubsRef.current.add(h)
    return () => { msgSubsRef.current.delete(h) }
  }, [])
  const subscribeReaction = useCallback((h: (r: ChatReactionEvent) => void) => {
    reactionSubsRef.current.add(h)
    return () => { reactionSubsRef.current.delete(h) }
  }, [])
  const subscribeRead = useCallback((h: (r: ChatReadEvent) => void) => {
    readSubsRef.current.add(h)
    return () => { readSubsRef.current.delete(h) }
  }, [])

  // Заголовок вкладки — префикс «(N) …» когда есть непрочитанное и
  // вкладка неактивна. Возвращаем оригинальный title как только вкладка
  // снова активна или счётчик обнулился.
  useEffect(() => {
    if (typeof document === "undefined") return
    // Извлекаем «чистый» title без нашего префикса.
    const cleanTitle = document.title.replace(/^\(\d+\)\s+/, "")
    const applyTitle = () => {
      const totalNow = state.chatUnread +
        state.dealUnreadIds.size + state.taskUnreadIds.size +
        (state.notifCounts?.deals || 0) + (state.notifCounts?.tasks || 0)
      const hidden = typeof document !== "undefined" && document.hidden
      if (totalNow > 0 && hidden) {
        document.title = `(${totalNow > 99 ? "99+" : totalNow}) ${cleanTitle}`
      } else {
        document.title = cleanTitle
      }
    }
    applyTitle()
    document.addEventListener("visibilitychange", applyTitle)
    return () => {
      document.removeEventListener("visibilitychange", applyTitle)
      // При unmount убираем префикс.
      document.title = cleanTitle
    }
  }, [state.chatUnread, state.dealUnreadIds, state.taskUnreadIds, state.notifCounts])

  // Разбудить AudioContext на первый user-gesture. Браузеры блокируют
  // WebAudio до тех пор пока пользователь не кликнет / не нажмёт кнопку
  // на странице. Без этого первый playChime тихо возвращается — ctx.state
  // остаётся "suspended". Однократно ловим любое взаимодействие и делаем
  // ensureCtx() + resume().
  useEffect(() => {
    if (!active) return
    const wake = () => {
      const ctx = ensureCtx()
      // Крохотный тихий тон чтобы ctx точно активировался в некоторых
      // мобильных браузерах (Safari требует реального play, не только
      // resume).
      if (ctx) {
        try {
          const t = ctx.currentTime
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          gain.gain.value = 0.0001
          osc.connect(gain); gain.connect(ctx.destination)
          osc.start(t); osc.stop(t + 0.02)
        } catch {}
      }
    }
    window.addEventListener("click", wake, { once: true, passive: true })
    window.addEventListener("keydown", wake, { once: true, passive: true })
    window.addEventListener("touchstart", wake, { once: true, passive: true })
    return () => {
      window.removeEventListener("click", wake)
      window.removeEventListener("keydown", wake)
      window.removeEventListener("touchstart", wake)
    }
  }, [active])

  const setActiveRoom = useCallback((roomId: number | null) => {
    activeRoomIdRef.current = roomId
    // Если только что открыли комнату — сразу зануляем её unread чтобы
    // не ждать SSE. Иначе успевшее «повиснуть» +1 останется.
    if (roomId != null) {
      const rooms = roomsRef.current.map((r) =>
        r.id === roomId ? { ...r, unread: 0 } : r,
      )
      if (rooms.some((r) => r.id === roomId)) {
        setState(computeState(rooms))
        roomsRef.current = computeState(rooms).rooms
      }
    }
  }, [])

  // notifCounts / online храним отдельно чтобы applyRooms не сбрасывал их.
  const notifCountsRef = useRef<State["notifCounts"]>({ deals: 0, tasks: 0, chat: 0 })
  const onlineRef = useRef<Set<number>>(new Set())

  const applyRooms = useCallback((rooms: ChatRoomSummary[]) => {
    const st = computeState(rooms, notifCountsRef.current, onlineRef.current)
    roomsRef.current = st.rooms
    for (const r of st.rooms) {
      if (r.last_message && r.last_message.id > lastMsgIdRef.current) {
        lastMsgIdRef.current = r.last_message.id
      }
    }
    setState(st)
  }, [])

  const applyNotifCounts = useCallback((counts: State["notifCounts"]) => {
    notifCountsRef.current = counts
    setState(computeState(roomsRef.current, counts, onlineRef.current))
  }, [])

  const applyOnline = useCallback((ids: Set<number>) => {
    onlineRef.current = ids
    setState(computeState(roomsRef.current, notifCountsRef.current, ids))
  }, [])

  const refresh = useCallback(async () => {
    if (!active) return
    try {
      const [roomsRes, countsRes] = await Promise.all([
        crmGet<{ rooms: ChatRoomSummary[] }>("/api/admin/chat/rooms"),
        crmGet<{ total_unread: number; by_section: Record<string, number> }>(
          "/api/admin/notifications/counts",
        ).catch(() => null),
      ])
      if (countsRes?.by_section) {
        notifCountsRef.current = {
          deals: countsRes.by_section.deals || 0,
          tasks: countsRes.by_section.tasks || 0,
          chat: countsRes.by_section.chat || 0,
        }
      }
      applyRooms(roomsRes.rooms || [])
    } catch {
      /* silent */
    }
  }, [active, applyRooms])

  // Первичный fetch + редкий fallback poll (страховка от десинка).
  useEffect(() => {
    if (!active) {
      setState(emptyState)
      roomsRef.current = []
      lastMsgIdRef.current = 0
      return
    }
    refresh()
    const t = setInterval(refresh, FALLBACK_POLL_MS)
    return () => clearInterval(t)
  }, [active, refresh])

  // Heartbeat + online-poll. Раз в 30 сек шлём heartbeat (обновляем
  // свой last_heartbeat_at на бэке), + тянем карту онлайн-юзеров.
  useEffect(() => {
    if (!active) return
    let stopped = false
    const heartbeat = async () => {
      if (stopped) return
      try {
        await crmPost("/api/admin/notifications/heartbeat", {})
      } catch { /* silent */ }
    }
    const loadOnline = async () => {
      if (stopped) return
      try {
        const res = await crmGet<{ presence: Record<string, { online: boolean }> }>(
          "/api/admin/notifications/online",
        )
        const ids = new Set<number>()
        for (const [k, v] of Object.entries(res.presence || {})) {
          if (v?.online) ids.add(Number(k))
        }
        applyOnline(ids)
      } catch { /* silent */ }
    }
    heartbeat()
    loadOnline()
    const tHb = setInterval(heartbeat, 30_000)
    const tOn = setInterval(loadOnline, 30_000)
    return () => {
      stopped = true
      clearInterval(tHb)
      clearInterval(tOn)
    }
  }, [active, applyOnline])

  const markRoomRead = useCallback((roomId: number) => {
    const rooms = roomsRef.current.map((r) =>
      r.id === roomId ? { ...r, unread: 0 } : r,
    )
    applyRooms(rooms)
  }, [applyRooms])

  /**
   * Помечает прочитанными все notification'ы для entity_type+entity_id
   * текущего юзера. Пока используем существующий эндпоинт `/notifications`
   * (list) + batch `/notifications/read` (ids). Позже можно заменить
   * одним запросом когда добавим `/notifications/read-entity` на бэке.
   */
  const markEntityRead = useCallback(async (entityType: string, entityId: number) => {
    if (!active) return
    try {
      const res = await crmGet<{ notifications: NotificationEvent[] }>(
        `/api/admin/notifications?unread=1&limit=200`,
      )
      const ids = (res.notifications || [])
        .filter((n) => n.entity_type === entityType && n.entity_id === entityId)
        .map((n) => n.id)
      if (ids.length === 0) return
      // Оптимистично: уменьшаем локальный counter соответствующей секции.
      const sectionOf = (t: string): "deals" | "tasks" | "chat" | null =>
        t === "deal" ? "deals" :
        t === "task" ? "tasks" :
        t === "chat_room" ? "chat" :
        null
      const s = sectionOf(entityType)
      if (s) {
        const next = { ...notifCountsRef.current }
        next[s] = Math.max(0, (next[s] || 0) - ids.length)
        applyNotifCounts(next)
      }
      await crmPost("/api/admin/notifications/read", { ids })
    } catch {
      /* silent */
    }
  }, [active, applyNotifCounts])

  const markSectionRead = useCallback(async (section: "deals" | "tasks" | "chat") => {
    if (!active) return
    try {
      const res = await crmGet<{ notifications: NotificationEvent[] }>(
        `/api/admin/notifications?unread=1&section=${section}&limit=500`,
      )
      const ids = (res.notifications || []).map((n) => n.id)
      if (ids.length === 0) return
      const next = { ...notifCountsRef.current, [section]: 0 } as State["notifCounts"]
      applyNotifCounts(next)
      await crmPost("/api/admin/notifications/read", { ids })
    } catch { /* silent */ }
  }, [active, applyNotifCounts])

  const markAllRead = useCallback(async () => {
    if (!active) return
    try {
      await crmPost("/api/admin/notifications/read-all", {})
      applyNotifCounts({ deals: 0, tasks: 0, chat: 0 })
    } catch { /* silent */ }
  }, [active, applyNotifCounts])

  // Единый SSE-стрим для всего /admin. Ловит events, обновляет rooms,
  // раздаёт подписчикам (CrmChatPanel через subscribeMessage/Reaction/Read).
  useEffect(() => {
    if (!active) return
    let stopped = false

    // Trailing slash обязателен: Next с `trailingSlash: true` делает 308
    // redirect с `.../stream` → `.../stream/`, EventSource НЕ следует
    // redirects.
    const url = `/api/admin/chat/stream/?since=${lastMsgIdRef.current}`
    const es = new EventSource(url)

    const handleMessage = (ev: MessageEvent) => {
      if (stopped) return
      try {
        const msg = JSON.parse(ev.data) as ChatMessage
        if (msg.id <= lastMsgIdRef.current) return
        lastMsgIdRef.current = msg.id

        // Обновляем комнату: last_message, unread, поднимаем наверх.
        let hasRoom = false
        const isMine = msg.author_id === userId
        // Не инкрементим unread если юзер сидит в этой комнате прямо
        // сейчас — сообщение приходит на его же глазах.
        const isActive = activeRoomIdRef.current === msg.room_id
        const rooms = roomsRef.current.map((r) => {
          if (r.id !== msg.room_id) return r
          hasRoom = true
          return {
            ...r,
            last_message: msg,
            updated_at: msg.created_at,
            unread: (isMine || isActive) ? (r.unread || 0) : (r.unread || 0) + 1,
          }
        })

        if (!hasRoom) {
          // Комната не в списке — новая или мы только что вступили.
          // Точечно перезапросим список, без polling.
          refresh()
        } else {
          applyRooms(rooms)
        }

        // Раздаём подписчикам (CrmChatPanel фильтрует по своей roomId).
        for (const h of msgSubsRef.current) {
          try { h(msg) } catch { /* handler bug */ }
        }
        // Звук для chat-сообщений отдельно не играем — он придёт через
        // event: notification (chat_new_message) с учётом активной
        // комнаты.
      } catch {
        /* malformed frame */
      }
    }

    const handleReaction = (ev: MessageEvent) => {
      if (stopped) return
      try {
        const payload = JSON.parse(ev.data) as ChatReactionEvent
        for (const h of reactionSubsRef.current) {
          try { h(payload) } catch {}
        }
      } catch { /* malformed frame */ }
    }

    const handleRead = (ev: MessageEvent) => {
      if (stopped) return
      try {
        const payload = JSON.parse(ev.data) as ChatReadEvent
        for (const h of readSubsRef.current) {
          try { h(payload) } catch {}
        }
      } catch { /* malformed frame */ }
    }

    const handleNotification = (ev: MessageEvent) => {
      if (stopped) return
      try {
        const payload = JSON.parse(ev.data) as NotificationEvent
        // Инкрементим счётчик соответствующей секции — бейдж на
        // «Сделки»/«Задачи»/«Чат» в шапке появится сразу.
        const section = payload.section
        if (section === "deals" || section === "tasks" || section === "chat") {
          const next = { ...notifCountsRef.current }
          next[section] = (next[section] || 0) + 1
          applyNotifCounts(next)
        }
        // Разные звуки по типу события. chat_new_message играет только
        // если юзер НЕ смотрит эту комнату (activeRoomIdRef) — иначе
        // «пикает» на каждое своё чтение.
        if (payload.kind === "chat_mention") {
          // @упоминание — отдельный звук всегда, даже если чат открыт.
          playChime("mention")
        } else if (payload.kind === "chat_new_message") {
          const rid =
            (payload.payload as any)?.room_id ??
            (payload.entity_type === "chat_room" ? payload.entity_id : null)
          if (rid !== activeRoomIdRef.current) {
            playChime("message")
          }
        } else if (payload.kind === "deal_assigned" || payload.kind.startsWith("deal_")) {
          playChime("deal")
        } else if (payload.kind === "task_assigned" || payload.kind.startsWith("task_")) {
          playChime("task")
        } else {
          playChime("message")
        }
      } catch { /* malformed frame */ }
    }

    es.addEventListener("message", handleMessage)
    es.addEventListener("reaction", handleReaction)
    es.addEventListener("read", handleRead)
    es.addEventListener("notification", handleNotification)
    es.onerror = () => {
      // EventSource переподключится сам с exp backoff. При долгом
      // разрыве нас подстрахует FALLBACK_POLL_MS выше.
    }

    return () => {
      stopped = true
      es.close()
    }
  }, [active, userId, applyRooms, refresh])

  // notifCounts.chat не считаем в total — он дублирует chatUnread
  // (тот же chat_new_message создаёт и unread у ChatRoom, и Notification).
  const totalUnread = useMemo(
    () =>
      state.chatUnread +
      state.dealUnreadIds.size +
      state.taskUnreadIds.size +
      (state.notifCounts?.deals || 0) +
      (state.notifCounts?.tasks || 0),
    [state.chatUnread, state.dealUnreadIds, state.taskUnreadIds, state.notifCounts],
  )

  const value = useMemo<ChatUnreadCtx>(
    () => ({
      ...state, totalUnread, markRoomRead, refresh, setActiveRoom,
      subscribeMessage, subscribeReaction, subscribeRead,
      markEntityRead, markSectionRead, markAllRead,
    }),
    [
      state, totalUnread, markRoomRead, refresh, setActiveRoom,
      subscribeMessage, subscribeReaction, subscribeRead,
      markEntityRead, markSectionRead, markAllRead,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// ============================================================================

/**
 * Короткий «динь» через WebAudio, без файла. Разные типы — разные
 * последовательности частот:
 *   • message — короткий двухтональный «пик-пок» (880 → 660)
 *   • deal    — восходящий двухтональный «дилинг» (600 → 900, дольше)
 *   • task    — двойное короткое «динь-динь» (низкое)
 */
export type ChimeKind = "message" | "deal" | "task" | "mention"

let audioCtx: AudioContext | null = null

function ensureCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AnyWindow = window as unknown as {
        AudioContext?: typeof AudioContext
        webkitAudioContext?: typeof AudioContext
      }
      const AC = AnyWindow.AudioContext ?? AnyWindow.webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {})
    return audioCtx
  } catch {
    return null
  }
}

function tone(ctx: AudioContext, start: number, freqFrom: number, freqTo: number, duration: number, peak = 0.22) {
  const osc = ctx.createOscillator()
  osc.type = "sine"
  osc.frequency.setValueAtTime(freqFrom, start)
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), start + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function playChime(kind: ChimeKind = "message") {
  const ctx = ensureCtx()
  if (!ctx) return
  const t = ctx.currentTime
  try {
    if (kind === "message") {
      tone(ctx, t, 880, 660, 0.16)
    } else if (kind === "mention") {
      // Тройной высокий писк — «Вас упомянули!».
      tone(ctx, t, 1000, 1000, 0.08, 0.28)
      tone(ctx, t + 0.11, 1200, 1200, 0.08, 0.28)
      tone(ctx, t + 0.22, 1400, 1200, 0.14, 0.28)
    } else if (kind === "deal") {
      // Восходящее «важное» — деловое.
      tone(ctx, t, 600, 900, 0.18, 0.25)
      tone(ctx, t + 0.18, 900, 900, 0.14, 0.20)
    } else if (kind === "task") {
      // Двойное низкое короткое.
      tone(ctx, t, 520, 520, 0.10, 0.22)
      tone(ctx, t + 0.14, 520, 400, 0.14, 0.22)
    }
  } catch {
    /* autoplay policy / private mode */
  }
}

// ============================================================================

/**
 * Обёртка над провайдером, которая сама читает useAuth() и подкидывает
 * userId + userRole. Именно её ставим в root layout — просто и без
 * пропсов сверху.
 */
export function ChatUnreadAutoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return (
    <ChatUnreadProvider userId={user?.id ?? null} userRole={user?.role ?? null}>
      {children}
    </ChatUnreadProvider>
  )
}
