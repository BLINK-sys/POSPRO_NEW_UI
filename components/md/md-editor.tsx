"use client"

/**
 * Простой Markdown-редактор для вложений `.md`. По структуре повторяет
 * ExcelEditor: тянет файл через `/api/admin/attachments/<id>/raw`,
 * сохраняет PUT-ом туда же. Снизу слева — textarea (правка), справа —
 * preview. Две вкладки сверху для переключения и split-режим.
 *
 * Preview — собственный мини-парсер. Этого хватит для ТЗ-типа текстов
 * (заголовки, списки, inline-формат, ссылки, цитаты, code). Если понадобится
 * таблицы/html/подсветка кода — замените на `marked` (npm i marked).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, ArrowLeft, Columns2, Eye, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Props {
  attachmentId: number
}

type ViewMode = "split" | "preview"

export default function MdEditor({ attachmentId }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("Файл")
  const [content, setContent] = useState<string>("")
  const [dirty, setDirty] = useState(false)
  const [view, setView] = useState<ViewMode>("split")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Имя файла прокидывает CrmDocumentsCard через sessionStorage (как у ExcelEditor).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`md-editor:${attachmentId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as { fileName?: string }
      if (parsed.fileName) setFileName(parsed.fileName)
    } catch { /* noop */ }
  }, [attachmentId])

  const reloadFromDisk = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/attachments/${attachmentId}/raw`,
        { cache: "no-store" },
      )
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { msg = JSON.parse(await res.text()).error || msg } catch {}
        throw new Error(msg)
      }
      const buf = await res.arrayBuffer()
      // Декодируем в UTF-8; при fatal fallback к Windows-1251.
      let text: string
      const bytes = new Uint8Array(buf)
      if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        text = new TextDecoder("utf-8").decode(bytes.slice(3))
      } else {
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        } catch {
          text = new TextDecoder("windows-1251").decode(bytes)
        }
      }
      setContent(text)
      setDirty(false)
    } catch (e: any) {
      setError(e?.message || "Не удалось открыть файл")
    } finally {
      setLoading(false)
    }
  }, [attachmentId])

  useEffect(() => { reloadFromDisk() }, [reloadFromDisk])

  // Guard при уходе с несохранёнными правками — как в ExcelEditor.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      // /raw принимает сырое тело запроса (см. excel-editor). multipart
      // здесь неправильный: бэк вызывает request.get_data() и пишет
      // всё тело включая MIME-boundaries как контент файла.
      const blob = new Blob([content], { type: "text/markdown; charset=utf-8" })
      const res = await fetch(
        `/api/admin/attachments/${attachmentId}/raw`,
        {
          method: "PUT",
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
          body: blob,
        },
      )
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { msg = JSON.parse(await res.text()).error || msg } catch {}
        throw new Error(msg)
      }
      setDirty(false)
      toast({ title: "Сохранено", description: fileName })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка сохранения", description: e?.message })
    } finally {
      setSaving(false)
    }
  }, [attachmentId, content, fileName, toast])

  // Ctrl/Cmd+S — быстрое сохранение.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (dirty && !saving) handleSave()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dirty, saving, handleSave])

  const html = useMemo(() => renderMarkdown(content), [content])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загружаю…
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-700">
        <div className="text-red-600">Ошибка: {error}</div>
        <Button variant="outline" onClick={() => router.back()}>Назад</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-white shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Назад
        </Button>
        <FileText className="h-4 w-4 text-gray-500" />
        <div className="text-sm font-semibold truncate flex-1 min-w-0" title={fileName}>
          {fileName}
          {dirty && <span className="ml-2 text-xs text-amber-600 font-normal">• несохранено</span>}
        </div>
        <div className="inline-flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
          {([
            { v: "split" as const, label: "Split", Icon: Columns2 },
            { v: "preview" as const, label: "Превью", Icon: Eye },
          ]).map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-2 py-1 rounded text-xs inline-flex items-center gap-1 transition-colors",
                view === v
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="bg-brand-yellow text-black hover:bg-yellow-500"
          size="sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
          Сохранить
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={cn(
          "h-full",
          view === "split" ? "grid grid-cols-2" : "grid grid-cols-1",
        )}>
          {view === "split" && (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (!dirty) setDirty(true)
              }}
              spellCheck={false}
              className="h-full w-full border-0 border-r resize-none p-4 font-mono text-[13px] leading-6 outline-none bg-white"
            />
          )}
          <div
            className="h-full overflow-y-auto p-6 bg-white md-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {/* Минимальная типографика превью. Namespaced под md-preview, чтобы
          не влияло на остальной сайт. */}
      <style jsx global>{`
        .md-preview h1 { font-size: 1.75rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .md-preview h2 { font-size: 1.35rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .md-preview h3 { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
        .md-preview p  { margin: 0.5rem 0; line-height: 1.55; }
        .md-preview ul,
        .md-preview ol { margin: 0.5rem 0 0.5rem 1.5rem; }
        .md-preview li { margin: 0.15rem 0; }
        .md-preview a  { color: #2563eb; text-decoration: underline; }
        .md-preview code {
          background: #f3f4f6; padding: 0.1em 0.35em; border-radius: 4px;
          font-size: 0.9em; font-family: ui-monospace, Menlo, Monaco, monospace;
        }
        .md-preview pre {
          background: #0f172a; color: #e2e8f0; padding: 0.75rem 1rem;
          border-radius: 8px; overflow-x: auto; margin: 0.5rem 0;
          font-size: 0.85em; line-height: 1.5;
        }
        .md-preview pre code { background: transparent; padding: 0; color: inherit; }
        .md-preview blockquote {
          border-left: 3px solid #d1d5db; padding: 0.1rem 0.75rem;
          color: #4b5563; margin: 0.5rem 0;
        }
        .md-preview hr {
          border: 0; border-top: 1px solid #e5e7eb; margin: 1rem 0;
        }
        .md-preview strong { font-weight: 700; }
        .md-preview em { font-style: italic; }
      `}</style>
    </div>
  )
}

// ─── Mini-markdown → HTML ──────────────────────────────────────────────
// Не держит все расширения MD, но ловит то что встречается в наших чек-
// листах/ТЗ: # ## ### заголовки, *bold* / _italic_ / `inline`,
// ``` code block ```, - / * / N. списки, > цитата, --- hr, [text](url).

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function inlineMd(src: string): string {
  // Экранирование — потом вставляем теги. Код сохраняем нетронутым.
  const codes: string[] = []
  let s = src.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${escape(code)}</code>`)
    return `\u0000${codes.length - 1}\u0000`
  })
  s = escape(s)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>")
  s = s.replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, "$1<em>$2</em>")
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => codes[Number(i)])
  return s
}

function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block ```…```
    if (/^```/.test(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // closing ```
      out.push(`<pre><code>${escape(buf.join("\n"))}</code></pre>`)
      continue
    }

    // Horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      out.push("<hr/>")
      i++
      continue
    }

    // Headings 1–6
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`)
      i++
      continue
    }

    // Blockquote (multi-line)
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""))
        i++
      }
      out.push(`<blockquote>${inlineMd(buf.join(" "))}</blockquote>`)
      continue
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*+]\s+/, ""))
        i++
      }
      out.push("<ul>" + buf.map((x) => `<li>${inlineMd(x)}</li>`).join("") + "</ul>")
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i++
      }
      out.push("<ol>" + buf.map((x) => `<li>${inlineMd(x)}</li>`).join("") + "</ol>")
      continue
    }

    // Blank line
    if (line.trim() === "") {
      i++
      continue
    }

    // Paragraph — склеиваем до пустой строки/спец-блока.
    const buf: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```|^#{1,6}\s|^\s*[-*+]\s+|^\s*\d+\.\s+|^\s*>|^\s*(---|\*\*\*|___)\s*$/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    out.push(`<p>${inlineMd(buf.join(" "))}</p>`)
  }

  return out.join("\n")
}
