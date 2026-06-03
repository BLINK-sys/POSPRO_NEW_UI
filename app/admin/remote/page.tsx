"use client"

/**
 * /admin/remote — «Удалённое управление».
 *
 * Уровень 1: ручной 9-значный код, без привязки к аккаунту магазина.
 * React-порт веб-контроллера PosProDesk
 * (исходники: c:/tools/Cursor_home/PosProDesk/server/public/{controller,signaling}.js).
 *
 * Поток:
 *   1. Юзер вводит код → WebSocket к NEXT_PUBLIC_POSPRODESK_SIGNAL.
 *   2. Шлём {t:'join', code}. Сервер отвечает 'joined' / 'error'.
 *   3. На 'joined' создаём RTCPeerConnection как answerer; ждём 'accepted' от хоста.
 *   4. Хост шлёт offer через sig — отвечаем answer; обмен ICE.
 *   5. Хост создаёт два DataChannel: 'input' (мышь/клава/блокировка) и 'files'.
 *      Когда 'input' открыт — статус connected, цепляем события мыши/клавы на video.
 *   6. ontrack → видео клиента; курсор браузера видим (своя позиция),
 *      клиентский курсор тоже виден из потока — следует за нашим через инжект.
 *   7. Файлы: drag&drop, или через кнопку «Файл» (С компьютера / Из системы).
 *      Тосты внизу по центру (3 сек). Прогресс-карточки внизу нет.
 *
 * UI:
 *   - Вверху по центру сворачиваемый toolbar: [Файл▼] [Блок] [Fullscreen] [Отключиться]
 *     плюс шеврон-кнопка для сворачивания. Когда свёрнут — виден только шеврон.
 *   - «Из системы» открывает выезжающую справа панель со списком драйверов
 *     из админки, чекбоксы → отправить.
 *   - Fullscreen состояние сохраняется при открытии файл-пикера.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  MonitorSmartphone,
  Plug,
  Link2Off,
  KeyRound,
  Paperclip,
  CheckCircle2,
  XCircle,
  Loader2,
  Upload,
  Maximize2,
  Minimize2,
  Lock,
  LockOpen,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Computer,
  Server,
  X,
  Send,
  Download,
  ArrowUp,
  GripHorizontal,
  Search,
  Check,
  FileBox,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_BASE_URL } from "@/lib/api-address"

const SIGNAL_URL = process.env.NEXT_PUBLIC_POSPRODESK_SIGNAL || "wss://posprodesk.onrender.com"

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

const CHUNK = 64 * 1024
// HIGH_WATER 16MB слишком близко к жёсткому лимиту Chrome's SCTP буфера —
// при превышении канал может молча закрыться. Опускаем до 1MB чтобы
// уверенно держаться внутри безопасной зоны и стабильно передавать
// большие файлы (тестировалось до 500 MB).
const HIGH_WATER = 1 * 1024 * 1024
const LOW_WATER = 256 * 1024
const RESET_DELAY_MS = 2500
const TOAST_DURATION_MS = 3000
const TRANSFER_DONE_TIMEOUT_MS = 5000

type Status =
  | "idle"
  | "connecting"
  | "accepted"
  | "connected"
  | "denied"
  | "peer-left"
  | "error"

interface Toast {
  id: number
  kind: "success" | "error" | "info"
  text: string
}

interface Transfer {
  id: string
  name: string
  size: number
  sent: number
  state: "downloading" | "sending" | "done" | "error" | "cancelled"
}

interface SystemDriver {
  id: number
  name: string
  url: string
  filename: string
  mime_type: string
  file_size: number
  image_url?: string | null
}

const ERROR_REASONS: Record<string, string> = {
  "not-found": "Код не найден. Проверьте, что приложение PosPro Desk запущено у клиента.",
  busy: "К этому компьютеру уже подключён другой оператор.",
}

const formatSize = (bytes: number) => {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RemotePage() {
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorText, setErrorText] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [blockActive, setBlockActive] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [toolbarExpanded, setToolbarExpanded] = useState(true)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [driverPanelOpen, setDriverPanelOpen] = useState(false)
  const [drivers, setDrivers] = useState<SystemDriver[]>([])
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<number>>(new Set())
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [driverSearch, setDriverSearch] = useState("")
  const [transfers, setTransfers] = useState<Transfer[]>([])
  // Показываем подсказку «кликни чтобы вернуть полный экран» когда file picker
  // выбил нас из fullscreen'а, но restore ещё не сработал. mousemove не даёт
  // user activation, без клика requestFullscreen реджектится — поэтому нужно
  // явно подсказать пользователю.
  const [needFullscreenRestore, setNeedFullscreenRestore] = useState(false)
  // Лёгкий debug-индикатор последней отправленной клавиши — если не
  // мигает при печати, значит handler вообще не фаерит (фокус сидит
  // на input/textarea или браузер ест ивент).
  const [lastKeySent, setLastKeySent] = useState<string | null>(null)
  // Док-стейт панели toolbar: к какой стороне приклеена + смещение вдоль неё (0..1).
  // Long-press на шевроне 1+ сек → drag-режим, можно перетаскивать; на release
  // — snap к ближайшей стороне.
  const [panelSide, setPanelSide] = useState<"top" | "bottom" | "left" | "right">("top")
  const [panelOffset, setPanelOffset] = useState(0.5)
  const [isPanelDragging, setIsPanelDragging] = useState(false)

  // ── refs ───────────────────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const inputChanRef = useRef<RTCDataChannel | null>(null)
  const filesChanRef = useRef<RTCDataChannel | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const screenRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileMenuRef = useRef<HTMLDivElement | null>(null)
  const fileSeqRef = useRef(0)
  const toastSeqRef = useRef(0)
  const incomingMetaRef = useRef<{ id: string; name: string; size: number } | null>(null)
  const incomingChunksRef = useRef<ArrayBuffer[]>([])
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasFullscreenRef = useRef(false)
  const abortedTransfersRef = useRef<Set<string>>(new Set())
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  // panelSide читаем в pointermove handler через ref чтобы избежать
  // пересоздания listener'а на каждое обновление стороны (это и было
  // главной причиной дёрганья — listener постоянно отписывался/подписывался).
  const panelSideRef = useRef(panelSide)
  useEffect(() => { panelSideRef.current = panelSide }, [panelSide])

  // Маска ввода: только цифры, 9 знаков.
  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D+/g, "").slice(0, 9)
    setCode(digits)
  }

  // ── toasts ────────────────────────────────────────────────────────────
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeqRef.current
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  // ── teardown ───────────────────────────────────────────────────────────
  const teardown = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    if (pcRef.current) {
      try { pcRef.current.close() } catch {}
      pcRef.current = null
    }
    if (wsRef.current) {
      try { wsRef.current.close() } catch {}
      wsRef.current = null
    }
    inputChanRef.current = null
    filesChanRef.current = null
    incomingMetaRef.current = null
    incomingChunksRef.current = []
    if (videoRef.current) videoRef.current.srcObject = null
    setBlockActive(false)
    setDriverPanelOpen(false)
    setFileMenuOpen(false)
  }, [])

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      setStatus("idle")
      setErrorText(null)
    }, RESET_DELAY_MS)
  }, [])

  // ── signaling/peer setup ──────────────────────────────────────────────
  const setupPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc

    pc.ontrack = (ev) => {
      const v = videoRef.current
      if (v && ev.streams[0]) {
        v.srcObject = ev.streams[0]
      }
    }

    pc.ondatachannel = (ev) => {
      const ch = ev.channel
      if (ch.label === "input") {
        inputChanRef.current = ch
        ch.onopen = () => { setStatus("connected") }
        ch.onclose = () => { inputChanRef.current = null }
      } else if (ch.label === "files") {
        ch.binaryType = "arraybuffer"
        filesChanRef.current = ch
        ch.onmessage = handleIncomingFile
        ch.onclose = () => { filesChanRef.current = null }
      }
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ t: "sig", data: { candidate: ev.candidate } }))
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        setErrorText("P2P-соединение не удалось. Возможно нужен TURN-сервер.")
        setStatus("error")
        teardown()
        scheduleReset()
      }
    }
  }, [scheduleReset, teardown])

  const handleSignal = useCallback(async (data: any) => {
    const pc = pcRef.current
    if (!pc) return
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ t: "sig", data: { sdp: pc.localDescription } }))
      }
    } else if (data.candidate) {
      try { await pc.addIceCandidate(data.candidate) } catch {}
    }
  }, [])

  const handleConnect = useCallback(() => {
    if (code.length !== 9 || status === "connecting" || status === "connected") return
    setErrorText(null)
    setStatus("connecting")

    const ws = new WebSocket(SIGNAL_URL)
    wsRef.current = ws

    ws.onopen = () => { ws.send(JSON.stringify({ t: "join", code })) }

    ws.onmessage = (ev) => {
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      switch (msg.t) {
        case "joined": setupPeer(); break
        case "accepted": setStatus("accepted"); break
        case "denied": setStatus("denied"); teardown(); scheduleReset(); break
        case "peer-left": setStatus("peer-left"); teardown(); scheduleReset(); break
        case "sig": handleSignal(msg.data); break
        case "error":
          setErrorText(ERROR_REASONS[msg.reason] || `Ошибка: ${msg.reason}`)
          setStatus("error"); teardown(); scheduleReset()
          break
      }
    }

    ws.onerror = () => {
      setErrorText("Сервер сигналинга недоступен")
      setStatus("error"); teardown(); scheduleReset()
    }

    ws.onclose = () => {
      setStatus((cur) => {
        if (cur === "connecting" || cur === "accepted") {
          setErrorText("Соединение с сервером закрыто")
          scheduleReset()
          return "error"
        }
        return cur
      })
    }
  }, [code, status, setupPeer, handleSignal, teardown, scheduleReset])

  const handleDisconnect = useCallback(() => {
    teardown()
    setStatus("idle")
  }, [teardown])

  useEffect(() => {
    return () => { teardown() }
  }, [teardown])

  // ── приём файлов (хост→контроллер) ───────────────────────────────────
  function handleIncomingFile(ev: MessageEvent) {
    if (typeof ev.data === "string") {
      let m: any
      try { m = JSON.parse(ev.data) } catch { return }

      // Прямое скачивание (host тянет файл с Render сам, мы только смотрим).
      if (m.kind === "remote-download-progress") {
        setTransfers((prev) => prev.map((t) =>
          t.id === m.id ? { ...t, sent: m.sent, size: m.total || t.size } : t
        ))
        return
      }
      if (m.kind === "remote-download-done") {
        setTransfers((prev) => prev.map((t) => t.id === m.id ? { ...t, state: "done" } : t))
        setTimeout(() => setTransfers((p) => p.filter((t) => t.id !== m.id)), TRANSFER_DONE_TIMEOUT_MS)
        return
      }
      if (m.kind === "remote-download-cancelled") {
        setTransfers((prev) => prev.map((t) => t.id === m.id ? { ...t, state: "cancelled" } : t))
        setTimeout(() => setTransfers((p) => p.filter((t) => t.id !== m.id)), TRANSFER_DONE_TIMEOUT_MS)
        return
      }
      if (m.kind === "remote-download-error") {
        setTransfers((prev) => prev.map((t) => t.id === m.id ? { ...t, state: "error" } : t))
        setTimeout(() => setTransfers((p) => p.filter((t) => t.id !== m.id)), TRANSFER_DONE_TIMEOUT_MS)
        return
      }

      // Входящие файлы от клиента: file-begin / chunk / file-end.
      if (m.kind === "file-begin") {
        incomingMetaRef.current = { id: m.id, name: m.name, size: m.size }
        incomingChunksRef.current = []
      } else if (m.kind === "file-end" && incomingMetaRef.current) {
        const meta = incomingMetaRef.current
        try {
          const blob = new Blob(incomingChunksRef.current)
          const a = document.createElement("a")
          const url = URL.createObjectURL(blob)
          a.href = url
          a.download = meta.name
          a.click()
          URL.revokeObjectURL(url)
          pushToast("success", `Получен файл: ${meta.name}`)
        } catch {
          pushToast("error", `Ошибка при сохранении: ${meta.name}`)
        }
        incomingMetaRef.current = null
        incomingChunksRef.current = []
      }
    } else if (incomingMetaRef.current) {
      incomingChunksRef.current.push(ev.data)
    }
  }

  // ── отправка файла (контроллер→хост) ─────────────────────────────────
  // Стратегия: HIGH_WATER = 1MB (см. константу). Если bufferedAmount подрос
  // выше — ждём bufferedamountlow (фаерится когда упал ниже LOW_WATER).
  // Отдельный безопасник: если send() кидает (буфер забит на уровне SCTP),
  // ждём с тайм-аутом и пробуем заново. Abort через abortedTransfersRef.
  const updateTransfer = useCallback((id: string, patch: Partial<Transfer>) => {
    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const sendFile = useCallback(async (file: File, existingId?: string) => {
    const ch = filesChanRef.current
    if (!ch || ch.readyState !== "open") return
    const id = existingId ?? `f${++fileSeqRef.current}-${file.size}`
    ch.bufferedAmountLowThreshold = LOW_WATER

    if (existingId) {
      // Переходим с downloading на sending — сбрасываем счётчик отправленного.
      updateTransfer(id, { sent: 0, size: file.size, state: "sending" })
    } else {
      setTransfers((prev) => [...prev, { id, name: file.name, size: file.size, sent: 0, state: "sending" }])
    }

    const waitForDrain = () =>
      new Promise<void>((resolve) => {
        const onLow = () => { ch.removeEventListener("bufferedamountlow", onLow); resolve() }
        ch.addEventListener("bufferedamountlow", onLow)
        // Safety: периодически проверяем сами на случай если событие не выстрелит.
        const timer = setInterval(() => {
          if (ch.readyState !== "open" || ch.bufferedAmount < LOW_WATER) {
            clearInterval(timer)
            ch.removeEventListener("bufferedamountlow", onLow)
            resolve()
          }
        }, 100)
      })

    try {
      ch.send(JSON.stringify({ kind: "file-begin", id, name: file.name, size: file.size }))

      let offset = 0
      while (offset < file.size) {
        if (abortedTransfersRef.current.has(id)) {
          // Извещаем хост чтобы он закрыл стрим и удалил частичный файл (если поддержит).
          try { ch.send(JSON.stringify({ kind: "file-cancel", id })) } catch {}
          updateTransfer(id, { state: "cancelled" })
          setTimeout(() => setTransfers((prev) => prev.filter((t) => t.id !== id)), TRANSFER_DONE_TIMEOUT_MS)
          return
        }

        // Backpressure: пока буфер выше HIGH_WATER — ждём.
        while (ch.bufferedAmount > HIGH_WATER && ch.readyState === "open") {
          await waitForDrain()
          if (abortedTransfersRef.current.has(id)) break
        }
        if (ch.readyState !== "open") throw new Error("channel closed")

        const buf = await file.slice(offset, offset + CHUNK).arrayBuffer()

        // Защитная обёртка send() — если SCTP буфер всё-таки забился, ждём и пробуем ещё.
        let sent = false
        for (let attempt = 0; attempt < 3 && !sent; attempt++) {
          try {
            ch.send(buf)
            sent = true
          } catch (e) {
            if (ch.readyState !== "open") throw e
            await waitForDrain()
          }
        }
        if (!sent) throw new Error("send failed after retries")

        offset += buf.byteLength
        updateTransfer(id, { sent: offset })
      }

      ch.send(JSON.stringify({ kind: "file-end", id }))
      updateTransfer(id, { state: "done", sent: file.size })
      setTimeout(() => setTransfers((prev) => prev.filter((t) => t.id !== id)), TRANSFER_DONE_TIMEOUT_MS)
    } catch {
      updateTransfer(id, { state: "error" })
      setTimeout(() => setTransfers((prev) => prev.filter((t) => t.id !== id)), TRANSFER_DONE_TIMEOUT_MS)
    } finally {
      abortedTransfersRef.current.delete(id)
    }
  }, [updateTransfer])

  const cancelTransfer = useCallback((id: string) => {
    abortedTransfersRef.current.add(id)
    // Direct download (id с префиксом 'rd') — шлём команду хосту чтобы он
    // оборвал fetch на своей стороне. Локальный sendFile сам поймает abort
    // через abortedTransfersRef.
    if (id.startsWith("rd")) {
      const ch = inputChanRef.current
      if (ch && ch.readyState === "open") {
        ch.send(JSON.stringify({ type: "remote-download-cancel", id }))
      }
    }
  }, [])

  // ── блокировка ввода клиента ─────────────────────────────────────────
  const toggleBlock = useCallback(() => {
    const ch = inputChanRef.current
    if (!ch || ch.readyState !== "open") return
    const next = !blockActive
    ch.send(JSON.stringify({ type: "block", enabled: next }))
    setBlockActive(next)
    pushToast("info", next ? "Ввод клиента заблокирован" : "Ввод клиента разблокирован")
  }, [blockActive, pushToast])

  // ── fullscreen ───────────────────────────────────────────────────────
  // Keyboard Lock API: пока страница «капчерит» Esc, браузер не показывает
  // плашку «press Esc to exit». Esc мы ловим сами в keydown-обработчике
  // ниже и сами выходим из fullscreen. Работает в Chrome/Edge на secure
  // context (https и localhost). Если браузер API не поддерживает — просто
  // fallback на стандартное поведение: будет видна та плашка.
  const toggleFullscreen = useCallback(async () => {
    const el = screenRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen()
        const kb = (navigator as any).keyboard
        if (kb && typeof kb.lock === "function") {
          try { await kb.lock(["Escape"]) } catch {}
        }
      } catch {}
    } else {
      const kb = (navigator as any).keyboard
      if (kb && typeof kb.unlock === "function") {
        try { kb.unlock() } catch {}
      }
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => {
      const fs = document.fullscreenElement === screenRef.current
      setIsFullscreen(fs)
      // На выход — снимаем keyboard lock (на случай если вышли не нашей кнопкой).
      if (!fs) {
        const kb = (navigator as any).keyboard
        if (kb && typeof kb.unlock === "function") {
          try { kb.unlock() } catch {}
        }
      }
    }
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  // Раз Esc «захвачен» нами — сами выходим из fullscreen по нему.
  // Capture-phase, чтобы видео-инжект не отправил это клиенту как обычное нажатие.
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        const kb = (navigator as any).keyboard
        if (kb && typeof kb.unlock === "function") {
          try { kb.unlock() } catch {}
        }
        document.exitFullscreen().catch(() => {})
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [isFullscreen])

  // ── Toolbar: long-press → drag → snap к ближайшему краю ─────────────
  // Главное отличие от наивной реализации:
  //   - гистерезис: сторона переключается только если другая ближе
  //     минимум на SIDE_BUFFER px (защита от мельтешения на диагоналях);
  //   - rAF-троттлинг: pointermove приходит ~250 раз/с, апдейтим максимум
  //     раз в кадр — иначе React не успевает и движение «дёргается»;
  //   - clamp по размеру панели (useLayoutEffect ниже) — чтобы при разворачивании
  //     панель не уезжала кнопками за край.
  const SIDE_BUFFER = 50
  const computeDock = useCallback((clientX: number, clientY: number) => {
    const rect = screenRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top))
    const dists = { top: y, bottom: rect.height - y, left: x, right: rect.width - x }
    const cur = panelSideRef.current
    const minSide = (Object.keys(dists) as Array<keyof typeof dists>)
      .reduce((a, b) => (dists[a] <= dists[b] ? a : b))
    // Меняем сторону только если новая существенно ближе.
    const side: typeof panelSide =
      minSide !== cur && dists[minSide] + SIDE_BUFFER < dists[cur]
        ? minSide
        : cur
    const offset = (side === "top" || side === "bottom") ? x / rect.width : y / rect.height
    return { side, offset: Math.max(0.05, Math.min(0.95, offset)) }
  }, [])

  const handleChevronPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    longPressTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true
      setIsPanelDragging(true)
      longPressTimerRef.current = null
    }, 1000)
  }

  const handleChevronPointerUp = (_e: React.PointerEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      setToolbarExpanded((v) => !v)
    }
  }

  // Глобальные слушатели на время drag. rAF-троттл чтобы не апдейтить чаще кадра.
  useEffect(() => {
    if (!isPanelDragging) return
    let rafId = 0
    let pendingX = 0
    let pendingY = 0
    let hasPending = false
    const flush = () => {
      if (hasPending) {
        const d = computeDock(pendingX, pendingY)
        if (d) {
          setPanelSide(d.side)
          setPanelOffset(d.offset)
        }
        hasPending = false
      }
      rafId = requestAnimationFrame(flush)
    }
    rafId = requestAnimationFrame(flush)
    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX
      pendingY = e.clientY
      hasPending = true
    }
    const onUp = () => {
      isDraggingRef.current = false
      setIsPanelDragging(false)
    }
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
    }
  }, [isPanelDragging, computeDock])

  // После каждого ререндера панели — замеряем её размер и поджимаем offset,
  // чтобы панель целиком влезала в screen-контейнер. С chevron-anchored
  // позиционированием панель растёт от шеврона ВЛЕВО (или ВВЕРХ для
  // вертикальных сторон), поэтому если шеврон у левой/верхней кромки —
  // двигаем его к центру ровно настолько, чтобы кнопки помещались.
  useLayoutEffect(() => {
    const panelEl = panelRef.current
    const containerEl = screenRef.current
    if (!panelEl || !containerEl) return
    const pr = panelEl.getBoundingClientRect()
    const cr = containerEl.getBoundingClientRect()
    if (!pr.width || !cr.width) return
    const margin = 8
    const RIGHT_EXTENT = 22 // chevron_half (16) + panel padding (6)
    let next = panelOffset
    if (panelSide === "top" || panelSide === "bottom") {
      // Panel extends LEFT from chevron position.
      const minOff = (pr.width - RIGHT_EXTENT + margin) / cr.width
      const maxOff = (cr.width - RIGHT_EXTENT - margin) / cr.width
      next = Math.max(minOff, Math.min(maxOff, panelOffset))
    } else {
      const minOff = (pr.height - RIGHT_EXTENT + margin) / cr.height
      const maxOff = (cr.height - RIGHT_EXTENT - margin) / cr.height
      next = Math.max(minOff, Math.min(maxOff, panelOffset))
    }
    if (Math.abs(next - panelOffset) > 0.001) setPanelOffset(next)
  }, [panelSide, panelOffset, toolbarExpanded, status])

  // Подгоняем offset при ресайзе окна / выходе-входе в fullscreen.
  useEffect(() => {
    const containerEl = screenRef.current
    if (!containerEl) return
    const ro = new ResizeObserver(() => {
      // Просто триггерим useLayoutEffect выше через микро-возмущение offset'а.
      setPanelOffset((v) => v + 0.0001)
    })
    ro.observe(containerEl)
    return () => ro.disconnect()
  }, [])

  // Возвращаем fullscreen если файл-пикер его «выбил». ВАЖНО: requestFullscreen
  // требует свежей user activation. Change event у file input'а в Chrome 110+
  // её НЕ даёт. Поэтому restore надёжно срабатывает только в событиях,
  // которые признаются «активационными»: cancel (close-кнопка диалога),
  // и mousedown/keydown пользователя ПОСЛЕ закрытия диалога.
  // Стратегия: при открытии диалога вешаем одноразовые слушатели на cancel
  // + на следующий любой click/keydown по странице — кто первый стрельнёт,
  // тот и восстанавливает.
  const restoreFullscreenIfNeeded = useCallback(() => {
    if (wasFullscreenRef.current && !document.fullscreenElement && screenRef.current) {
      screenRef.current.requestFullscreen()
        .then(() => {
          wasFullscreenRef.current = false
          setNeedFullscreenRestore(false)
          const kb = (navigator as any).keyboard
          if (kb && typeof kb.lock === "function") {
            try { kb.lock(["Escape"]) } catch {}
          }
        })
        .catch(() => {
          // Не получилось (нет user activation) — оставляем флаг, ждём
          // следующего клика пользователя.
        })
    } else {
      wasFullscreenRef.current = false
      setNeedFullscreenRestore(false)
    }
  }, [])

  // ── файл-меню (dropdown) ─────────────────────────────────────────────
  const handlePickFromComputer = () => {
    setFileMenuOpen(false)
    const wasFs = !!document.fullscreenElement
    wasFullscreenRef.current = wasFs
    if (wasFs) setNeedFullscreenRestore(true)

    const input = fileInputRef.current
    if (!input) return

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      input.removeEventListener("cancel", onCancel)
      document.removeEventListener("mousedown", onGesture, true)
      document.removeEventListener("keydown", onGesture, true)
      document.removeEventListener("touchstart", onGesture, true)
    }
    const onCancel = () => { cleanup(); restoreFullscreenIfNeeded() }
    const onGesture = () => { cleanup(); restoreFullscreenIfNeeded() }

    input.addEventListener("cancel", onCancel)
    document.addEventListener("mousedown", onGesture, true)
    document.addEventListener("keydown", onGesture, true)
    document.addEventListener("touchstart", onGesture, true)

    input.click()
  }

  const handlePickFromSystem = async () => {
    setFileMenuOpen(false)
    setDriverPanelOpen(true)
    // Перезагружаем список при каждом открытии — админ мог добавить новый драйвер.
    setLoadingDrivers(true)
    try {
      const r = await fetch("/api/public/drivers", { cache: "no-store" })
      const data = await r.json()
      setDrivers(Array.isArray(data) ? data : [])
    } catch {
      setDrivers([])
      pushToast("error", "Не удалось загрузить список драйверов")
    }
    setLoadingDrivers(false)
  }

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const f of files) void sendFile(f)
    e.target.value = ""
    // Fullscreen восстанавливаем в первом mousedown/keydown пользователя
    // после закрытия диалога — change event сам по себе НЕ user activation
    // для requestFullscreen в современном Chrome, нужен «свежий» жест.
    // См. document-level слушатели в handlePickFromComputer.
  }

  // Click outside для закрытия file-меню.
  useEffect(() => {
    if (!fileMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [fileMenuOpen])

  // ── панель «Из системы» — выбор и отправка драйверов ─────────────────
  const toggleDriverSelected = (id: number) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Прямое скачивание: команда хосту через input-канал → хост сам
  // тянет файл из Render → пишет на диск → шлёт прогресс/итог в files-канал.
  // Файл вообще не проходит через браузер админа. Тарифит линию клиента,
  // не нашу. Прогресс/done/error/cancelled приходят в handleIncomingFile,
  // он апдейтит ту же карточку transfers по id.
  const sendDriverFileDirect = useCallback((d: SystemDriver) => {
    const inputCh = inputChanRef.current
    const filesCh = filesChanRef.current
    if (!inputCh || inputCh.readyState !== "open") return
    if (!filesCh || filesCh.readyState !== "open") return

    const id = `rd${++fileSeqRef.current}-${d.file_size}`
    const name = d.filename || d.name
    const fullUrl = d.url.startsWith("http")
      ? d.url
      : `${API_BASE_URL}${d.url.startsWith("/") ? "" : "/"}${d.url}`

    setTransfers((prev) => [...prev, {
      id, name, size: d.file_size || 0, sent: 0, state: "downloading",
    }])

    inputCh.send(JSON.stringify({
      type: "remote-download",
      id, url: fullUrl, name,
    }))
  }, [])

  const sendSelectedDrivers = () => {
    const selected = drivers.filter((d) => selectedDriverIds.has(d.id))
    if (selected.length === 0) return
    setDriverPanelOpen(false)
    setSelectedDriverIds(new Set())
    for (const d of selected) sendDriverFileDirect(d)
  }

  // ── drag & drop ──────────────────────────────────────────────────────
  const canSendFiles = status === "connected" && !!filesChanRef.current

  const handleDragOver = (e: React.DragEvent) => {
    if (!canSendFiles) return
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!canSendFiles) return
    const files = Array.from(e.dataTransfer.files || [])
    for (const f of files) void sendFile(f)
  }

  // ── события мыши и клавы ─────────────────────────────────────────────
  useEffect(() => {
    if (status !== "connected") return
    const video = videoRef.current
    if (!video) return

    function send(cmd: any) {
      const ch = inputChanRef.current
      if (ch && ch.readyState === "open") ch.send(JSON.stringify(cmd))
    }

    function norm(ev: MouseEvent) {
      const r = video!.getBoundingClientRect()
      const vw = video!.videoWidth || r.width
      const vh = video!.videoHeight || r.height
      const scale = Math.min(r.width / vw, r.height / vh)
      const dispW = vw * scale, dispH = vh * scale
      const offX = (r.width - dispW) / 2, offY = (r.height - dispH) / 2
      const x = (ev.clientX - r.left - offX) / dispW
      const y = (ev.clientY - r.top - offY) / dispH
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
    }

    let pendingMove: { x: number; y: number } | null = null
    let rafId = 0
    const flush = () => {
      if (pendingMove) { send({ type: "move", ...pendingMove }); pendingMove = null }
      rafId = requestAnimationFrame(flush)
    }
    rafId = requestAnimationFrame(flush)

    const onMove = (ev: MouseEvent) => { pendingMove = norm(ev) }
    const onDown = (ev: MouseEvent) => {
      ev.preventDefault()
      // preventDefault на mousedown блокирует автофокус → возвращаем явно.
      // Без этого клик по видео не даёт фокус, клавиши улетают в браузерный UI.
      video.focus()
      send({ type: "click", button: ev.button, down: true, ...norm(ev) })
    }
    const onUp = (ev: MouseEvent) => {
      ev.preventDefault()
      send({ type: "click", button: ev.button, down: false, ...norm(ev) })
    }
    // Авто-фокус когда мышь над видео — клавиатура «следует за курсором»
    // (TeamViewer-style). Hover на toolbar забирает фокус браузеру.
    const onPointerEnter = () => { video.focus() }
    const onCtx = (ev: Event) => ev.preventDefault()
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      send({ type: "wheel", dy: ev.deltaY })
    }

    // Клавиатура — ловим на document, не на video. Иначе при клике на любую
    // кнопку toolbar'а или поиск в панели драйверов фокус уходит с video,
    // и клавиши улетают в никуда. Исключение — поля ввода: если юзер
    // активно печатает в input/textarea (поиск драйверов, форма кода) —
    // пропускаем, чтобы он мог ввести текст там.
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true
      if (target.isContentEditable) return true
      return false
    }
    let keyToastTimer: ReturnType<typeof setTimeout> | null = null
    const flashKey = (s: string) => {
      setLastKeySent(s)
      if (keyToastTimer) clearTimeout(keyToastTimer)
      keyToastTimer = setTimeout(() => setLastKeySent(null), 600)
    }
    const onDocKeyDown = (ev: KeyboardEvent) => {
      if (isEditableTarget(ev.target)) return
      // Escape уже перехватывается capture-фазой для fullscreen — он сюда не дойдёт.
      ev.preventDefault()
      send({ type: "key", key: ev.key, code: ev.code, down: true })
      flashKey(ev.key.length === 1 ? ev.key : ev.code)
    }
    const onDocKeyUp = (ev: KeyboardEvent) => {
      if (isEditableTarget(ev.target)) return
      ev.preventDefault()
      send({ type: "key", key: ev.key, code: ev.code, down: false })
    }

    video.addEventListener("mousemove", onMove)
    video.addEventListener("mousedown", onDown)
    video.addEventListener("mouseup", onUp)
    video.addEventListener("contextmenu", onCtx)
    video.addEventListener("wheel", onWheel, { passive: false })
    video.addEventListener("pointerenter", onPointerEnter)
    document.addEventListener("keydown", onDocKeyDown)
    document.addEventListener("keyup", onDocKeyUp)
    video.focus()

    return () => {
      cancelAnimationFrame(rafId)
      video.removeEventListener("mousemove", onMove)
      video.removeEventListener("mousedown", onDown)
      video.removeEventListener("mouseup", onUp)
      video.removeEventListener("contextmenu", onCtx)
      video.removeEventListener("wheel", onWheel as any)
      video.removeEventListener("pointerenter", onPointerEnter)
      document.removeEventListener("keydown", onDocKeyDown)
      document.removeEventListener("keyup", onDocKeyUp)
    }
  }, [status])

  // ── UI ────────────────────────────────────────────────────────────────
  const isConnected = status === "connected"
  const showCodeForm = status === "idle"
  const showConnecting = status === "connecting"
  const showAccepted = status === "accepted"
  const showDenied = status === "denied" || status === "peer-left"
  const showError = status === "error"

  const deniedTitle = status === "peer-left"
    ? "Клиент завершил сеанс"
    : "Клиент отклонил подключение"

  const selectedCount = selectedDriverIds.size

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-7rem)] min-h-[600px]">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-brand-yellow border-2 border-yellow-500 shadow-sm">
          <MonitorSmartphone className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Удалённое управление</h1>
          <p className="text-sm text-gray-500">
            Подключение к компьютеру клиента по 9-значному коду из приложения PosPro Desk
          </p>
        </div>
      </div>

      <Card className="rounded-xl border-2 border-brand-yellow shadow-[0_12px_32px_rgba(0,0,0,0.18)] overflow-hidden flex-1 min-h-0">
        <CardContent className="p-0 h-full">
          <div
            ref={screenRef}
            className={`relative w-full h-full bg-gray-700 overflow-hidden transition-colors ${
              dragOver ? "ring-4 ring-brand-yellow ring-inset" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Видео — всегда в DOM, скрыто пока нет stream'а. */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              tabIndex={0}
              className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity ${
                isConnected ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ outline: "none" }}
            />

            {/* ── Toolbar: одна тёмная панель с белыми кнопками ─────── */}
            {isConnected && (() => {
              const isVertical = panelSide === "left" || panelSide === "right"
              // Якорим панель НЕ за центр, а за позицию шеврона (последний
              // элемент в flex'е). Тогда при сворачивании/разворачивании
              // шеврон остаётся ровно на том же месте, а кнопки выезжают/
              // прячутся «вглубь» от него. CHEVRON_HALF = 16px (его радиус).
              const CHEVRON_HALF = 16
              const panelStyle: React.CSSProperties = (() => {
                switch (panelSide) {
                  case "top":
                    return { top: 12, left: `${panelOffset * 100}%`, transform: `translateX(calc(-100% + ${CHEVRON_HALF}px + 6px))` }
                  case "bottom":
                    return { bottom: 12, left: `${panelOffset * 100}%`, transform: `translateX(calc(-100% + ${CHEVRON_HALF}px + 6px))` }
                  case "left":
                    return { left: 12, top: `${panelOffset * 100}%`, transform: `translateY(calc(-100% + ${CHEVRON_HALF}px + 6px))` }
                  case "right":
                    return { right: 12, top: `${panelOffset * 100}%`, transform: `translateY(calc(-100% + ${CHEVRON_HALF}px + 6px))` }
                }
              })()
              const chevronExpandedIcon =
                panelSide === "top" ? <ChevronUp className="h-3.5 w-3.5" /> :
                panelSide === "bottom" ? <ChevronDown className="h-3.5 w-3.5" /> :
                panelSide === "left" ? <ChevronLeft className="h-3.5 w-3.5" /> :
                <ChevronRight className="h-3.5 w-3.5" />
              const chevronCollapsedIcon =
                panelSide === "top" ? <ChevronDown className="h-3.5 w-3.5" /> :
                panelSide === "bottom" ? <ChevronUp className="h-3.5 w-3.5" /> :
                panelSide === "left" ? <ChevronRight className="h-3.5 w-3.5" /> :
                <ChevronLeft className="h-3.5 w-3.5" />

              const btnBase =
                "inline-flex items-center justify-center gap-1.5 rounded-full bg-white border-2 shadow-sm hover:shadow-md transition-all text-sm font-medium whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              const btnPad = isVertical ? "h-9 w-9 p-0" : "h-9 px-3.5"

              return (
                <div
                  ref={panelRef}
                  className={`absolute z-40 pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5 backdrop-blur-md ${
                    isVertical ? "flex-col" : "flex-row"
                  } ${
                    isPanelDragging
                      ? "bg-gray-900/95 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-2 ring-brand-yellow cursor-grabbing"
                      : "bg-gray-900/85 shadow-[0_8px_24px_rgba(0,0,0,0.30)] border border-white/10 transition-[top,bottom,left,right,transform] duration-200"
                  }`}
                  style={panelStyle}
                >
                  {toolbarExpanded && (
                    <>
                      {/* Файл с dropdown */}
                      <div ref={fileMenuRef} className="relative">
                        <button
                          onClick={() => setFileMenuOpen((v) => !v)}
                          disabled={!canSendFiles}
                          className={`${btnBase} ${btnPad} border-brand-yellow text-gray-700 hover:text-black`}
                          title={canSendFiles ? "Прикрепить файл" : "Доступно после подключения"}
                        >
                          <Paperclip className="h-4 w-4" />
                          {!isVertical && (
                            <>
                              Файл
                              <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-70" />
                            </>
                          )}
                        </button>
                        {fileMenuOpen && (
                          <div
                            className={`absolute min-w-[200px] rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden z-50 ${
                              panelSide === "top" ? "top-full left-0 mt-2" :
                              panelSide === "bottom" ? "bottom-full left-0 mb-2" :
                              panelSide === "left" ? "left-full top-0 ml-2" :
                              "right-full top-0 mr-2"
                            }`}
                          >
                            <button
                              onClick={handlePickFromComputer}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50"
                            >
                              <Computer className="h-4 w-4 text-gray-500" />
                              С компьютера
                            </button>
                            <button
                              onClick={handlePickFromSystem}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 border-t border-gray-100"
                            >
                              <Server className="h-4 w-4 text-gray-500" />
                              Из системы
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Блокировка ввода */}
                      <button
                        onClick={toggleBlock}
                        className={`${btnBase} ${btnPad} ${
                          blockActive
                            ? "!bg-brand-yellow border-yellow-500 text-black"
                            : "border-brand-yellow text-gray-700 hover:text-black"
                        }`}
                        title={blockActive ? "Разрешить ввод клиенту" : "Заблокировать ввод клиенту"}
                      >
                        {blockActive ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                        {!isVertical && (blockActive ? "Заблокировано" : "Блок ввода")}
                      </button>

                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className={`${btnBase} ${btnPad} border-brand-yellow text-gray-700 hover:text-black`}
                        title={isFullscreen ? "Свернуть" : "Во весь экран"}
                      >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        {!isVertical && (isFullscreen ? "Свернуть" : "Во весь экран")}
                      </button>

                      {/* Отключиться */}
                      <button
                        onClick={handleDisconnect}
                        className={`${btnBase} ${btnPad} border-red-400 text-red-700 hover:bg-red-50 hover:border-red-500`}
                        title="Отключиться"
                      >
                        <Link2Off className="h-4 w-4" />
                        {!isVertical && "Отключиться"}
                      </button>

                      {/* Лёгкий разделитель перед grip'ом */}
                      <div className={`${isVertical ? "w-6 h-px" : "h-6 w-px"} bg-white/15 mx-0.5`} />
                    </>
                  )}

                  {/* Шеврон / drag-handle */}
                  <button
                    onPointerDown={handleChevronPointerDown}
                    onPointerUp={handleChevronPointerUp}
                    className={`inline-flex items-center justify-center rounded-full bg-white border-2 border-brand-yellow shadow-sm hover:shadow-md transition-shadow w-8 h-8 text-gray-600 hover:text-black ${
                      isPanelDragging ? "cursor-grabbing" : "cursor-pointer"
                    }`}
                    title={
                      isPanelDragging
                        ? "Перемещайте панель — отпустите, чтобы приклеить к стороне"
                        : toolbarExpanded
                        ? "Кликнуть — свернуть. Удерживать — перетащить"
                        : "Кликнуть — развернуть. Удерживать — перетащить"
                    }
                  >
                    {isPanelDragging
                      ? <GripHorizontal className="h-4 w-4" />
                      : toolbarExpanded ? chevronExpandedIcon : chevronCollapsedIcon}
                  </button>
                </div>
              )
            })()}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFilesPicked}
              className="hidden"
            />

            {/* Debug-индикатор последней клавиши — в углу, прозрачный.
                Если при печати на ремоут он не загорается — значит наш
                document.keydown handler не срабатывает (фокус в input или
                браузер ест ивент). */}
            {lastKeySent && isConnected && (
              <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-black/70 backdrop-blur text-white text-xs font-mono px-2 py-1 border border-white/20 shadow">
                  <span className="text-gray-400">key:</span>
                  <span className="font-semibold">{lastKeySent}</span>
                </div>
              </div>
            )}

            {/* Подсказка вернуть fullscreen после файл-пикера. */}
            {needFullscreenRestore && !isFullscreen && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                <button
                  onClick={() => restoreFullscreenIfNeeded()}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-yellow border-2 border-yellow-500 text-black shadow-[0_8px_24px_rgba(0,0,0,0.35)] px-5 py-2.5 text-sm font-semibold hover:bg-yellow-300 transition-colors animate-pulse"
                >
                  <Maximize2 className="h-4 w-4" />
                  Кликни чтобы вернуть полный экран
                </button>
              </div>
            )}

            {/* Прогресс передач — справа сверху, ниже toolbar'а.
                Драйверы из системы проходят 2 фазы:
                  - "downloading" — скачиваем файл с бэка к нам в браузер (через WAN);
                  - "sending" — раздаём клиенту через WebRTC P2P. */}
            {transfers.length > 0 && (
              <div className="absolute top-20 right-4 z-30 flex flex-col gap-2 w-80 pointer-events-auto">
                {transfers.map((t) => {
                  const pct = t.size ? Math.min(100, Math.round((t.sent / t.size) * 100)) : 0
                  const isDone = t.state === "done"
                  const isError = t.state === "error"
                  const isCancelled = t.state === "cancelled"
                  const isDownloading = t.state === "downloading"
                  const isSending = t.state === "sending"
                  const inFlight = isDownloading || isSending

                  const phaseLabel =
                    isDownloading ? "Клиент скачивает с сервера" :
                    isSending ? "Отправка клиенту" :
                    isDone ? "Готово" :
                    isError ? "Ошибка" :
                    isCancelled ? "Отменено" : ""
                  const phaseIcon =
                    isDownloading ? <Download className="h-3.5 w-3.5 text-indigo-600" /> :
                    isSending ? <ArrowUp className="h-3.5 w-3.5 text-yellow-600" /> :
                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                  const barColor =
                    isDone ? "bg-emerald-500" :
                    isError ? "bg-red-400" :
                    isCancelled ? "bg-gray-300" :
                    isDownloading ? "bg-indigo-500" :
                    "bg-brand-yellow"
                  const borderColor =
                    isDone ? "border-emerald-300" :
                    isError ? "border-red-300" :
                    isCancelled ? "border-gray-300" :
                    isDownloading ? "border-indigo-200" :
                    "border-gray-200"

                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border px-3 py-2 transition-colors ${borderColor}`}
                    >
                      <div className="flex items-center gap-2">
                        {phaseIcon}
                        <div className="text-xs font-medium truncate flex-1 min-w-0" title={t.name}>
                          {t.name}
                        </div>
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : isError ? (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        ) : isCancelled ? (
                          <span className="text-[11px] text-gray-500 shrink-0">—</span>
                        ) : (
                          <span className="text-[11px] font-semibold text-gray-700 tabular-nums shrink-0">
                            {pct}%
                          </span>
                        )}
                        {inFlight && (
                          <button
                            onClick={() => cancelTransfer(t.id)}
                            className="p-0.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                            title="Отменить"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-400">
                        {phaseLabel}
                      </div>

                      <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${barColor}`}
                          style={{ width: `${isDone ? 100 : pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Drag&drop overlay */}
            {dragOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-brand-yellow/15 backdrop-blur-sm pointer-events-none">
                <div className="rounded-2xl bg-white border-2 border-dashed border-brand-yellow px-8 py-6 shadow-xl flex items-center gap-3">
                  <Upload className="h-6 w-6 text-black" />
                  <div className="text-base font-medium">Отпустите файл для отправки</div>
                </div>
              </div>
            )}

            {/* Тосты — внизу по центру, авто-исчезают через 3с. */}
            {toasts.length > 0 && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
                {toasts.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                      t.kind === "success"
                        ? "bg-emerald-500/85 text-white border border-emerald-400/40"
                        : t.kind === "error"
                        ? "bg-red-500/85 text-white border border-red-400/40"
                        : "bg-gray-900/80 text-white border border-white/10"
                    }`}
                  >
                    {t.kind === "success" && <CheckCircle2 className="h-4 w-4" />}
                    {t.kind === "error" && <XCircle className="h-4 w-4" />}
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Боковая панель «Из системы» — выдвигается справа. */}
            {(() => {
              const q = driverSearch.trim().toLowerCase()
              const filteredDrivers = q
                ? drivers.filter((d) =>
                    d.name.toLowerCase().includes(q) ||
                    (d.filename || "").toLowerCase().includes(q)
                  )
                : drivers
              return (
                <div
                  className={`absolute top-0 right-0 h-full w-[420px] max-w-[92%] bg-gray-900/95 backdrop-blur-md border-l-2 border-brand-yellow shadow-[-12px_0_40px_rgba(0,0,0,0.50)] z-40 flex flex-col transition-transform duration-300 ease-out ${
                    driverPanelOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-brand-yellow border border-yellow-600 shadow-sm">
                        <Server className="h-4 w-4 text-black" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white leading-tight">Файлы из системы</h3>
                        <div className="text-[11px] text-gray-400 leading-tight">Драйверы из админки</div>
                      </div>
                      {selectedCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-2 ml-1 rounded-full bg-brand-yellow text-black text-xs font-bold shadow">
                          {selectedCount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { setDriverPanelOpen(false); setSelectedDriverIds(new Set()); setDriverSearch("") }}
                      className="rounded-full p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Закрыть"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                      <input
                        type="text"
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                        placeholder="Поиск драйвера…"
                        className="w-full pl-9 pr-9 py-2 rounded-lg bg-gray-800 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition-colors"
                      />
                      {driverSearch && (
                        <button
                          onClick={() => setDriverSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {loadingDrivers ? (
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-xl bg-gray-800/80 animate-pulse overflow-hidden"
                            style={{ animationDelay: `${i * 80}ms` }}
                          >
                            <div className="aspect-square bg-gray-700/60" />
                            <div className="p-3 space-y-2">
                              <div className="h-3 bg-gray-700/60 rounded w-3/4" />
                              <div className="h-2.5 bg-gray-700/60 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredDrivers.length === 0 ? (
                      <div className="text-center py-16 text-sm text-gray-400">
                        {driverSearch ? "Ничего не найдено" : "Нет доступных драйверов"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {filteredDrivers.map((d, idx) => {
                          const checked = selectedDriverIds.has(d.id)
                          const imgUrl = d.image_url
                            ? (d.image_url.startsWith("http")
                                ? d.image_url
                                : `${API_BASE_URL}${d.image_url.startsWith("/") ? "" : "/"}${d.image_url}`)
                            : null
                          return (
                            <button
                              key={d.id}
                              onClick={() => toggleDriverSelected(d.id)}
                              className={`group relative rounded-xl bg-white overflow-hidden text-left animate-in fade-in slide-in-from-bottom-3 duration-300 border-2 transition-all ${
                                checked
                                  ? "border-brand-yellow scale-[1.02] shadow-[0_8px_24px_rgba(250,204,21,0.30)]"
                                  : "border-transparent hover:border-yellow-200 hover:shadow-lg shadow-sm"
                              }`}
                              style={{ animationDelay: `${Math.min(idx, 12) * 30}ms`, animationFillMode: "backwards" }}
                            >
                              {/* Selected badge */}
                              {checked && (
                                <div className="absolute top-2 right-2 z-10 inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-yellow border-2 border-yellow-600 shadow-md">
                                  <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
                                </div>
                              )}

                              {/* Thumbnail */}
                              <div className="aspect-square bg-gray-50 flex items-center justify-center p-3 border-b border-gray-100">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={d.name}
                                    className="max-h-full max-w-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none"
                                    }}
                                  />
                                ) : (
                                  <FileBox className="h-12 w-12 text-gray-300" strokeWidth={1.5} />
                                )}
                              </div>

                              {/* Info */}
                              <div className="p-2.5">
                                <div className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.2em]">
                                  {d.name}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-1 truncate">
                                  {formatSize(d.file_size)}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer — Send button */}
                  <div className="border-t border-white/10 p-3 bg-gray-900/50">
                    <button
                      onClick={sendSelectedDrivers}
                      disabled={selectedCount === 0 || !canSendFiles}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-yellow text-black hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(250,204,21,0.35)] hover:shadow-[0_6px_18px_rgba(250,204,21,0.50)] transition-all"
                    >
                      <Send className="h-4 w-4" />
                      {selectedCount > 0
                        ? `Отправить ${selectedCount} ${selectedCount === 1 ? "файл" : selectedCount < 5 ? "файла" : "файлов"}`
                        : "Выберите файлы"}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Форма ввода кода */}
            {showCodeForm && (
              <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-6">
                <div className="w-full max-w-md rounded-2xl bg-white border-2 border-brand-yellow shadow-[0_20px_50px_rgba(0,0,0,0.30)] p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <KeyRound className="h-4 w-4 text-gray-500" />
                    <h3 className="text-base font-semibold">Код подключения</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Попросите клиента продиктовать 9-значный код из приложения PosPro Desk
                  </p>
                  <Input
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && code.length === 9) handleConnect()
                    }}
                    placeholder="000 000 000"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={9}
                    className="font-mono text-lg tracking-[0.4em] text-center h-12 mb-3 border-gray-200 focus-visible:border-brand-yellow focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    onClick={handleConnect}
                    disabled={code.length !== 9}
                    className="w-full rounded-full bg-brand-yellow text-black hover:bg-yellow-500 shadow-sm hover:shadow-md disabled:opacity-50 h-12"
                  >
                    <Plug className="h-4 w-4 mr-1.5" />
                    Подключиться
                  </Button>
                  <p className="mt-3 text-[11px] text-gray-400 text-center">
                    Сигналинг: <code className="font-mono">{SIGNAL_URL}</code>
                  </p>
                </div>
              </div>
            )}

            {/* Ожидание подтверждения */}
            {showConnecting && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm">
                <div className="rounded-2xl bg-white border border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.30)] px-8 py-6 flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  <div>
                    <div className="text-base font-semibold">Ожидаем подтверждения</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Клиенту нужно нажать «Разрешить» в окне PosPro Desk
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showAccepted && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm">
                <div className="rounded-2xl bg-white border border-emerald-200 shadow-[0_20px_50px_rgba(0,0,0,0.30)] px-8 py-6 flex items-center gap-3">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  <div>
                    <div className="text-base font-semibold text-emerald-800">
                      Клиент разрешил подключение
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Устанавливаем P2P-соединение…</div>
                  </div>
                </div>
              </div>
            )}

            {showDenied && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm">
                <div className="rounded-2xl bg-white border border-red-200 shadow-[0_20px_50px_rgba(0,0,0,0.30)] px-8 py-6 flex items-center gap-3">
                  <XCircle className="h-7 w-7 text-red-600" />
                  <div>
                    <div className="text-base font-semibold text-red-800">{deniedTitle}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Можно попробовать ещё раз через несколько секунд
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm">
                <div className="rounded-2xl bg-white border border-red-200 shadow-[0_20px_50px_rgba(0,0,0,0.30)] px-8 py-6 flex items-center gap-3 max-w-md">
                  <XCircle className="h-7 w-7 text-red-600 shrink-0" />
                  <div>
                    <div className="text-base font-semibold text-red-800">
                      {errorText || "Ошибка подключения"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Проверьте код и сетевое соединение
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
