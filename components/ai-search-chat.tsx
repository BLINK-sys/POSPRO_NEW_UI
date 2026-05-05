"use client"

import React, { useEffect, useRef, useState } from "react"
import { Sparkles, Send, Loader2, MessageSquare, Square } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface AISearchResult {
  product_ids: number[]
  search_label: string
}

interface AISearchChatProps {
  /**
   * Called whenever the AI emits a final list of product ids. The parent
   * page (e.g. /ai) handles fetching and rendering the actual cards.
   */
  onResults: (result: AISearchResult) => void
  /**
   * Initial chat history loaded from sessionStorage by the parent page.
   * The chat will overwrite this state internally.
   */
  initialMessages?: ChatMessage[]
  /**
   * Notified after every state change so the parent can persist to storage.
   */
  onStateChange?: (state: { messages: ChatMessage[] }) => void
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const STARTER_PROMPTS = [
  "Открываю кафе на 20 мест, что нужно?",
  "Холодильник на 500 литров до 800к",
  "Топ кофемашин",
  "Витрина для пекарни",
]

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Привет! Я PosPro AI 👋 Расскажите что ищете — задам пару уточняющих вопросов и подберу подходящие товары.",
}

export function AISearchChat({ onResults, initialMessages, onStateChange }: AISearchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages && initialMessages.length > 0 ? initialMessages : [GREETING],
  )
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Стабильный токен сессии чата — генерится при первом сообщении и
  // персиститься в localStorage. Используется только для логирования
  // на бэке (одна сессия = один UUID на всю переписку до очистки данных).
  const sessionTokenRef = useRef<string | null>(null)
  useEffect(() => {
    if (typeof window === "undefined") return
    const KEY = "pospro-ai-chat-session-token"
    let token = window.localStorage.getItem(KEY)
    if (!token) {
      token = (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `s${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.localStorage.setItem(KEY, token)
    }
    sessionTokenRef.current = token
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, busy])

  // Notify parent so it can persist messages to sessionStorage.
  useEffect(() => {
    onStateChange?.({ messages })
  }, [messages, onStateChange])

  // Autofocus input on mount.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setError(null)
    const newHistory: ChatMessage[] = [...messages, { role: "user", content: trimmed }]
    setMessages([...newHistory, { role: "assistant", content: "" }])
    setInput("")
    setBusy(true)
    setStatusText(null)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const apiMessages = newHistory.filter((m, i) => !(i === 0 && m === GREETING))
      const resp = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          messages: apiMessages,
          session_token: sessionTokenRef.current,
        }),
        signal: ctrl.signal,
      })

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let assembledText = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let idx
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 2)
          if (!rawEvent.startsWith("data:")) continue
          const json = rawEvent.slice(5).trim()
          let evt: any
          try { evt = JSON.parse(json) } catch { continue }

          if (evt.type === "delta" && typeof evt.text === "string") {
            assembledText += evt.text
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === "assistant") {
                next[next.length - 1] = { role: "assistant", content: assembledText }
              }
              return next
            })
            setStatusText(null)
          } else if (evt.type === "text_reset") {
            // Server signals: drop accumulated text — what came before was
            // the model's commentary between tool calls, not the answer.
            assembledText = ""
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === "assistant") {
                next[next.length - 1] = { role: "assistant", content: "" }
              }
              return next
            })
          } else if (evt.type === "status" && typeof evt.text === "string") {
            setStatusText(evt.text)
          } else if (evt.type === "products" && Array.isArray(evt.ids)) {
            onResults({ product_ids: evt.ids, search_label: evt.label || "" })
          } else if (evt.type === "error") {
            throw new Error(evt.message || "Stream error")
          }
        }
      }

      if (!assembledText.trim()) {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === "assistant" && !last.content) {
            next[next.length - 1] = { role: "assistant", content: "Готово, посмотрите подобранные товары." }
          }
          return next
        })
      }
    } catch (e: any) {
      const aborted = e?.name === "AbortError" || ctrl.signal.aborted
      if (aborted) {
        // User clicked Stop. Replace empty placeholder with a short note,
        // don't surface a red error banner for an intentional cancel.
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === "assistant" && !last.content) {
            next[next.length - 1] = { role: "assistant", content: "⏹ Остановлено." }
          }
          return next
        })
      } else {
        console.error("AI chat error:", e)
        setError(e?.message || "Что-то пошло не так")
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === "assistant" && !last.content) {
            next[next.length - 1] = { role: "assistant", content: "Извините, не получилось получить ответ. Попробуйте ещё раз." }
          }
          return next
        })
      }
    } finally {
      abortRef.current = null
      setBusy(false)
      setStatusText(null)
    }
  }

  const stop = () => {
    abortRef.current?.abort()
  }

  const reset = () => {
    setMessages([GREETING])
    setInput("")
    setError(null)
  }

  // Hide trailing empty assistant placeholder.
  const visibleMessages = messages.filter(
    (m, i) => !(i === messages.length - 1 && m.role === "assistant" && !m.content),
  )

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-brand-yellow/30 to-transparent">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-brand-yellow text-black">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">PosPro AI</div>
            <div className="text-[11px] text-gray-500 leading-tight">Подбор оборудования</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={reset}
          disabled={busy}
          title="Начать заново"
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          Новый чат
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visibleMessages.map((m, idx) => (
          <ChatBubble key={idx} role={m.role} content={m.content} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-gray-500 pl-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{statusText || "Думаю..."}</span>
            <button
              type="button"
              onClick={stop}
              className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-[11px] transition-colors"
              title="Остановить"
            >
              <Square className="h-3 w-3 fill-current" />
              Стоп
            </button>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 px-3 py-2 bg-red-50 rounded-md">{error}</div>
        )}
      </div>

      {/* Quick starter chips — only when there's just the greeting */}
      {messages.length === 1 && !busy && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-brand-yellow/30 text-gray-700 hover:text-black transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (!busy) send(input)
              }
            }}
            rows={1}
            placeholder={busy ? "Стоп → пишите ответ..." : "Опишите задачу..."}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow max-h-32"
            style={{ minHeight: 38 }}
          />
          {busy ? (
            <Button
              onClick={stop}
              className="h-9 w-9 p-0 rounded-full bg-gray-900 hover:bg-black text-white flex-shrink-0"
              title="Остановить"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="h-9 w-9 p-0 rounded-full bg-brand-yellow hover:bg-yellow-500 text-black flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Enter — отправить · Shift+Enter — новая строка
        </p>
      </div>
    </div>
  )
}

function ChatBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-yellow text-black px-3.5 py-2 text-sm whitespace-pre-wrap leading-snug">
          {content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 text-gray-900 px-3.5 py-2 text-sm leading-snug">
        <MarkdownLite text={content} />
      </div>
    </div>
  )
}

// Tiny inline-markdown renderer: paragraphs (\n\n), line breaks (\n),
// **bold** and *italic*. We avoid pulling in react-markdown for this — the
// model output is short and the syntax is narrow.
function MarkdownLite({ text }: { text: string }) {
  if (!text) return null
  const paragraphs = text.split(/\n{2,}/)
  return (
    <>
      {paragraphs.map((para, pi) => (
        <p key={pi} className={pi === 0 ? "" : "mt-2"}>
          {para.split("\n").map((line, li, arr) => (
            <span key={li}>
              {renderInline(line)}
              {li < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  )
}

function renderInline(line: string): React.ReactNode[] {
  // Split on **bold** and *italic* groups while keeping the markers.
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <span key={i}>{part}</span>
  })
}
