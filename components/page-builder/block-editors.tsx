"use client"

/**
 * Редакторы для каждого типа блока. Разделены в один файл, чтобы не
 * плодить мелкие файлы — каждый компонент 30-80 строк.
 *
 * Общий контракт: получают `block` и `onChange(patch)` — патч сливается
 * с текущим состоянием в PageBuilder (partial update).
 */

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  AlignLeft, AlignCenter, AlignRight, StretchHorizontal,
  Bold, Italic, Underline, Link2, Upload, Loader2, Info as InfoIcon,
  AlertTriangle, CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/lib/api-address"
import { Plus, Trash2, Rows, Columns } from "lucide-react"
import type {
  HeadingBlock, ParagraphBlock, ImageBlock, CalloutBlock, YoutubeBlock,
  ButtonBlock, TableBlock, BlockAlign, ImageAlign, CalloutKind,
} from "@/lib/page-blocks/types"

// ── Общее: панелька выравнивания ────────────────────────────────────

function AlignRow<T extends BlockAlign | ImageAlign>({
  value, onChange, allowNone = false,
}: { value: T; onChange: (v: T) => void; allowNone?: boolean }) {
  const opts: Array<{ v: string; icon: React.ReactNode; title: string }> = [
    { v: "left",   icon: <AlignLeft   className="h-3.5 w-3.5" />, title: "Слева" },
    { v: "center", icon: <AlignCenter className="h-3.5 w-3.5" />, title: "По центру" },
    { v: "right",  icon: <AlignRight  className="h-3.5 w-3.5" />, title: "Справа" },
  ]
  if (allowNone) opts.push({ v: "none", icon: <StretchHorizontal className="h-3.5 w-3.5" />, title: "Без выравнивания" })
  return (
    <div className="inline-flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          title={o.title}
          onClick={() => onChange(o.v as T)}
          className={cn(
            "p-1 rounded transition-colors",
            value === o.v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

// ── Heading ────────────────────────────────────────────────────────

export function HeadingEditor({ block, onChange }: { block: HeadingBlock; onChange: (p: Partial<HeadingBlock>) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="inline-flex bg-gray-100 rounded p-0.5">
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => onChange({ level: lvl })}
              className={cn(
                "px-2 py-1 text-xs font-semibold rounded",
                block.level === lvl ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900",
              )}
            >
              H{lvl}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <AlignRow value={block.align} onChange={(v) => onChange({ align: v })} />
        </div>
      </div>
      {/* Native input вместо shadcn <Input> — тот жёстко ставит
          text-base + md:text-sm + h-10, из-за чего мой text-2xl не работал.
          Здесь свои стили без перекрытий, размер шрифта видно сразу. */}
      <input
        type="text"
        value={block.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Заголовок…"
        className={cn(
          "w-full bg-transparent font-bold text-gray-900 leading-tight",
          "border-0 border-b border-gray-200 rounded-none px-0 py-2",
          "outline-none focus:border-brand-yellow placeholder:text-gray-400 placeholder:font-normal",
          block.level === 1 && "text-3xl",
          block.level === 2 && "text-2xl",
          block.level === 3 && "text-xl",
          block.align === "center" && "text-center",
          block.align === "right" && "text-right",
        )}
      />
    </div>
  )
}

// ── Paragraph ──────────────────────────────────────────────────────

export function ParagraphEditor({ block, onChange }: { block: ParagraphBlock; onChange: (p: Partial<ParagraphBlock>) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // Инициализация contenteditable через ref один раз — React не должен
  // перерисовывать это поле после первого mount'а (иначе теряется каретка
  // и inline-форматирование). Синхронизация с внешним value происходит
  // только если оно реально расходится (например, после сохранения бэком).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (block.html || "")) {
      ref.current.innerHTML = block.html || ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!ref.current) return
    // Синхронизируем только если фокуса нет — не портим карет юзера
    if (document.activeElement !== ref.current && ref.current.innerHTML !== (block.html || "")) {
      ref.current.innerHTML = block.html || ""
    }
  }, [block.html])

  const emit = () => {
    if (ref.current) onChange({ html: ref.current.innerHTML })
  }

  const exec = (cmd: string, val?: string) => {
    // execCommand deprecated, но всё ещё работает во всех браузерах
    // и это самый простой путь для inline-форматирования в contenteditable.
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    emit()
  }

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const savedRange = useRef<Range | null>(null)

  const openLink = () => {
    // Сохраняем выделение — Dialog отбирает фокус, execCommand потом не
    // будет знать куда вставлять.
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange()
    setLinkUrl("")
    setLinkOpen(true)
  }
  const applyLink = () => {
    const url = linkUrl.trim()
    setLinkOpen(false)
    if (!url) return
    const normalized = /^(https?:\/\/|\/|mailto:|tel:)/.test(url) ? url : `https://${url}`
    // Восстанавливаем выделение и вставляем ссылку
    ref.current?.focus()
    if (savedRange.current) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(savedRange.current)
    }
    document.execCommand("createLink", false, normalized)
    emit()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        <button type="button" onClick={() => exec("bold")}      className="p-1 rounded hover:bg-gray-100" title="Жирный (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => exec("italic")}    className="p-1 rounded hover:bg-gray-100" title="Курсив (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => exec("underline")} className="p-1 rounded hover:bg-gray-100" title="Подчёркнутый (Ctrl+U)"><Underline className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={openLink}                className="p-1 rounded hover:bg-gray-100" title="Ссылка"><Link2 className="h-3.5 w-3.5" /></button>
        <div className="ml-auto">
          <AlignRow value={block.align} onChange={(v) => onChange({ align: v })} />
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          // prose даёт визуальные стили для inline-формата (жирный, курсив,
          // подчёркивание, ссылки) — иначе юзер жмёт Bold и не видит
          // изменений. Prose-invert не нужен, но prose-sm компактнее.
          "prose prose-sm max-w-none",
          "min-h-[60px] p-2 border border-gray-200 rounded focus:outline-none focus:border-brand-yellow text-gray-800",
          "[&_a]:text-yellow-700 [&_a]:underline",
          "[&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-gray-400 [&:empty:before]:pointer-events-none",
          block.align === "center" && "text-center",
          block.align === "right" && "text-right",
        )}
        onInput={emit}          // сохраняем на каждый ввод — не ждём blur
        onBlur={emit}           // + финальный blur как safety-net
        data-placeholder="Введите текст…"
      />

      {/* Модалка ссылки */}
      {linkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLinkOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg w-96 max-w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-900">Вставить ссылку</div>
            <Input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com или /category/…"
              onKeyDown={(e) => { if (e.key === "Enter") applyLink() }}
            />
            <p className="text-[11px] text-gray-500">Выделите текст перед вставкой, чтобы ссылка обернула его.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setLinkOpen(false)}>Отмена</Button>
              <Button size="sm" onClick={applyLink} className="bg-brand-yellow hover:bg-yellow-500 text-black">ОК</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Image ──────────────────────────────────────────────────────────

export function ImageEditor({ block, onChange, slug }: {
  block: ImageBlock; onChange: (p: Partial<ImageBlock>) => void; slug: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.append("file", file)
    form.append("slug", slug)
    // JWT берём из client-cookie (jwt-token-client) как в других admin-fetch'ах.
    const token = document.cookie.split("; ").find((r) => r.startsWith("jwt-token-client="))?.split("=")[1]
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/static-page/upload-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const j = await res.json()
      if (!res.ok || !j.url) { alert(j.error || "Ошибка загрузки"); return }
      const full = j.url.startsWith("http") ? j.url : `${API_BASE_URL}${j.url}`
      onChange({ src: full })
    } finally {
      setUploading(false)
    }
  }

  const widths = [25, 33, 50, 66, 75, 100] as const

  // Drag-ресайз: 3 разные ручки на картинке.
  //   - right   → тянет ТОЛЬКО ширину (heightPx не меняется, auto = пропорция)
  //   - bottom  → тянет ТОЛЬКО высоту (widthPercent не меняется)
  //   - corner  → тянет ОБЕ независимо (не сохраняет пропорцию — можно
  //                деформировать)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const startResize = (
    e: React.MouseEvent,
    axis: "x" | "y" | "xy",
  ) => {
    e.preventDefault()
    e.stopPropagation()
    if (!wrapperRef.current || !imgRef.current) return
    const container = wrapperRef.current.getBoundingClientRect()
    const imgRect = imgRef.current.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startPercent = block.widthPercent
    const startHeightPx = block.heightPx ?? imgRect.height

    const onMove = (ev: MouseEvent) => {
      const patch: Partial<ImageBlock> = {}
      if (axis === "x" || axis === "xy") {
        const deltaPercent = ((ev.clientX - startX) / container.width) * 100
        patch.widthPercent = Math.max(10, Math.min(100, Math.round(startPercent + deltaPercent)))
      }
      if (axis === "y" || axis === "xy") {
        const nextH = Math.max(40, Math.round(startHeightPx + (ev.clientY - startY)))
        patch.heightPx = nextH
      }
      onChange(patch)
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const resetHeight = () => onChange({ heightPx: undefined })

  return (
    <div className="space-y-2">
      {block.src ? (
        <div
          ref={wrapperRef}
          className={cn(
            "relative",
            block.align === "center" && "flex justify-center",
            block.align === "right" && "flex justify-end",
          )}
        >
          <div className="relative inline-block group max-w-full" style={{ width: `${block.widthPercent}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={block.src}
              alt={block.alt}
              className="rounded border border-gray-200 w-full block"
              style={{
                height: block.heightPx ? `${block.heightPx}px` : "auto",
                // Когда юзер явно задал высоту — растягиваем буквально
                // (без cover/центрирования, иначе визуально «растёт вверх»
                // из-за симметричного object-position center).
                objectFit: block.heightPx ? "fill" : undefined,
                objectPosition: "top",
              }}
            />
            {/* 3 ручки: правая (X), нижняя (Y), угловая (XY независимо) */}
            <div
              onMouseDown={(e) => startResize(e, "x")}
              title="Ширина"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-8 bg-brand-yellow border-2 border-white rounded cursor-ew-resize shadow-md opacity-70 hover:opacity-100 transition-opacity"
            />
            <div
              onMouseDown={(e) => startResize(e, "y")}
              title="Высота"
              className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-8 h-3 bg-brand-yellow border-2 border-white rounded cursor-ns-resize shadow-md opacity-70 hover:opacity-100 transition-opacity"
            />
            <div
              onMouseDown={(e) => startResize(e, "xy")}
              title="Свободный ресайз (без пропорции)"
              className="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 w-4 h-4 bg-brand-yellow border-2 border-white rounded-sm cursor-se-resize shadow-md opacity-80 hover:opacity-100 transition-opacity"
            />
            {/* Индикатор размера + кнопка сброса высоты */}
            <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                {block.widthPercent}%{block.heightPx ? ` × ${block.heightPx}px` : ""}
              </span>
              {block.heightPx != null && (
                <button
                  type="button"
                  onClick={resetHeight}
                  title="Сбросить высоту (авто/пропорция)"
                  className="bg-white/90 hover:bg-white text-gray-700 text-[10px] px-1.5 py-0.5 rounded shadow"
                >
                  auto H
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-brand-yellow hover:text-black transition-colors"
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Upload className="h-6 w-6 mb-1" /><span className="text-sm">Загрузить картинку</span></>}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
          if (fileRef.current) fileRef.current.value = ""
        }}
      />

      {block.src && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] uppercase text-gray-500">Alt-текст</Label>
              <Input
                value={block.alt}
                onChange={(e) => onChange({ alt: e.target.value })}
                placeholder="Описание для SEO / скринридеров"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase text-gray-500">URL</Label>
              <Input
                value={block.src}
                onChange={(e) => onChange({ src: e.target.value })}
                placeholder="Ссылка на изображение"
                className="h-8 text-sm"
              />
            </div>
          </div>
          {/* flex-wrap + gap-y-2 — при узкой ширине (напр. в колонке) элементы
              переносятся на следующие строки, не уезжают за край. */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <Label className="text-[11px] uppercase text-gray-500 mr-1">Ширина</Label>
              <div className="inline-flex bg-gray-100 rounded p-0.5 flex-wrap">
                {widths.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onChange({ widthPercent: w })}
                    className={cn(
                      "px-2 py-1 text-[11px] rounded",
                      block.widthPercent === w ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900",
                    )}
                  >
                    {w}%
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-gray-500 hidden md:inline">или тяни угол</span>
            </div>
            <AlignRow value={block.align} onChange={(v) => onChange({ align: v })} allowNone />
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => fileRef.current?.click()}
              className="h-8 text-xs"
            >
              <Upload className="h-3 w-3 mr-1" />Заменить
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Callout ───────────────────────────────────────────────────────

const CALLOUT_STYLES: Record<CalloutKind, { cls: string; icon: React.ReactNode; label: string }> = {
  info:    { cls: "bg-blue-50 border-blue-600 text-blue-900",       icon: <InfoIcon className="h-3.5 w-3.5" />, label: "Инфо" },
  warning: { cls: "bg-amber-50 border-amber-600 text-amber-900",    icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Внимание" },
  success: { cls: "bg-green-50 border-green-700 text-green-900",    icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Успех" },
}

export function CalloutEditor({ block, onChange }: { block: CalloutBlock; onChange: (p: Partial<CalloutBlock>) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (block.html || "")) {
      ref.current.innerHTML = block.html || ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!ref.current) return
    if (document.activeElement !== ref.current && ref.current.innerHTML !== (block.html || "")) {
      ref.current.innerHTML = block.html || ""
    }
  }, [block.html])
  const emit = () => { if (ref.current) onChange({ html: ref.current.innerHTML }) }
  return (
    <div className="space-y-2">
      <div className="inline-flex bg-gray-100 rounded p-0.5">
        {(Object.keys(CALLOUT_STYLES) as CalloutKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange({ kind: k })}
            className={cn(
              "px-2 py-1 text-xs rounded inline-flex items-center gap-1",
              block.kind === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900",
            )}
          >
            {CALLOUT_STYLES[k].icon}
            <span>{CALLOUT_STYLES[k].label}</span>
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "prose prose-sm max-w-none",
          "border-l-4 rounded px-3 py-2 focus:outline-none",
          "[&_a]:underline",
          CALLOUT_STYLES[block.kind].cls,
        )}
        onInput={emit}
        onBlur={emit}
      />
    </div>
  )
}

// ── YouTube ───────────────────────────────────────────────────────

export function YoutubeEditor({ block, onChange }: { block: YoutubeBlock; onChange: (p: Partial<YoutubeBlock>) => void }) {
  return (
    <div className="space-y-2">
      <Input
        value={block.url}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="https://www.youtube.com/watch?v=… или https://youtu.be/…"
        className="h-9 text-sm"
      />
      {block.url && (
        <p className="text-[11px] text-gray-500">
          При сохранении URL нормализуется в embed-ссылку. Проверить встраивание можно на публичной странице.
        </p>
      )}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────

export function ButtonEditor({ block, onChange }: { block: ButtonBlock; onChange: (p: Partial<ButtonBlock>) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="inline-flex bg-gray-100 rounded p-0.5">
          <button type="button" onClick={() => onChange({ variant: "primary" })}
            className={cn("px-2 py-1 text-xs rounded", block.variant === "primary" ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}>Жёлтая</button>
          <button type="button" onClick={() => onChange({ variant: "outline" })}
            className={cn("px-2 py-1 text-xs rounded", block.variant === "outline" ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}>Обводка</button>
        </div>
        <div className="ml-auto">
          <AlignRow value={block.align} onChange={(v) => onChange({ align: v })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={block.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Текст кнопки" className="h-8 text-sm" />
        <Input value={block.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="Ссылка" className="h-8 text-sm" />
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────

export function TableEditor({ block, onChange }: { block: TableBlock; onChange: (p: Partial<TableBlock>) => void }) {
  const cols = block.rows[0]?.length ?? 0

  const setCell = (r: number, c: number, val: string) => {
    const next = block.rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row
    )
    onChange({ rows: next })
  }

  const addRow = () => {
    onChange({ rows: [...block.rows, new Array(cols).fill("")] })
  }
  const addCol = () => {
    onChange({ rows: block.rows.map((row) => [...row, ""]) })
  }
  const delRow = (r: number) => {
    if (block.rows.length <= 1) return
    onChange({ rows: block.rows.filter((_, i) => i !== r) })
  }
  const delCol = (c: number) => {
    if (cols <= 1) return
    onChange({ rows: block.rows.map((row) => row.filter((_, i) => i !== c)) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={block.hasHeader}
            onChange={(e) => onChange({ hasHeader: e.target.checked })}
            className="rounded"
          />
          Первая строка — заголовок
        </label>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Строка
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addCol} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Столбец
          </Button>
        </div>
      </div>

      {/* Обёртка с pt-6 pl-2 — освобождает место для кнопок удаления
          столбцов над таблицей. Кнопки всегда видны (не hover-only). */}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Строка кнопок удаления столбцов — над таблицей */}
          {cols > 1 && (
            <thead>
              <tr>
                {block.rows[0]?.map((_, c) => (
                  <th key={c} className="p-0 h-6 relative border-b border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => delCol(c)}
                      title="Удалить столбец"
                      className="mx-auto flex items-center justify-center w-5 h-5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </th>
                ))}
                <th className="w-8 border-b border-gray-200 bg-gray-50" />
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r} className={block.hasHeader && r === 0 ? "bg-yellow-50/40" : ""}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-gray-200 p-0">
                    <input
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className={cn(
                        "w-full h-full px-2 py-1.5 text-sm bg-transparent border-0 focus:outline-none focus:bg-yellow-50",
                        block.hasHeader && r === 0 && "font-semibold",
                      )}
                      placeholder={block.hasHeader && r === 0 ? "Заголовок" : ""}
                    />
                  </td>
                ))}
                {/* Кнопка удаления строки — справа, всегда видимая */}
                <td className="w-8 p-0 border-l border-gray-200 bg-gray-50">
                  {block.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => delRow(r)}
                      title="Удалить строку"
                      className="mx-auto flex items-center justify-center w-5 h-5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">
        Красные кнопки — удаление строки/столбца. Кликнув по ячейке, можно её редактировать.
      </p>
    </div>
  )
}

// ── Columns ───────────────────────────────────────────────────────
//
// Nested: внутри каждой колонки свой мини-список блоков. Без DnD
// (dnd-kit multi-container сложно и хрупко), перестановка стрелками
// «вверх/вниз», добавление через локальный «+ Добавить блок». Внутрь
// колонок нельзя вкладывать сами columns (запрещаем в add-menu).

import type { ColumnsBlock, PageBlock, PageBlockType } from "@/lib/page-blocks/types"
import { defaultBlockData } from "@/lib/page-blocks/types"
import { BlockWrapper } from "./block-wrapper"
import { AddBlockMenu } from "./add-block-menu"

// Отдельный компонент чтобы избежать циклического импорта в page-builder.
// PageBuilder тоже использует BlockEditorSwitch (см. renderNestedBlock ниже).
export function BlockEditorSwitch({ block, onChange, slug }: {
  block: PageBlock; onChange: (p: any) => void; slug: string
}) {
  switch (block.type) {
    case "heading":   return <HeadingEditor   block={block} onChange={onChange} />
    case "paragraph": return <ParagraphEditor block={block} onChange={onChange} />
    case "image":     return <ImageEditor     block={block} onChange={onChange} slug={slug} />
    case "callout":   return <CalloutEditor   block={block} onChange={onChange} />
    case "youtube":   return <YoutubeEditor   block={block} onChange={onChange} />
    case "button":    return <ButtonEditor    block={block} onChange={onChange} />
    case "table":     return <TableEditor     block={block} onChange={onChange} />
    case "divider":   return <div className="border-t border-gray-300 my-2" />
    case "html":      return (
      <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
        Legacy HTML в колонке — удалите и добавьте новые блоки.
      </div>
    )
    // columns внутри columns запрещены — в add-menu пункт скрыт.
    case "columns":   return null
  }
}

export function ColumnsEditor({ block, onChange, slug }: {
  block: ColumnsBlock; onChange: (p: Partial<ColumnsBlock>) => void; slug: string
}) {
  const setCount = (n: 2 | 3) => {
    // При изменении количества — сохраняем существующие блоки, лишние
    // колонки схлопываем в последнюю, недостающие добавляем пустыми.
    const cur = block.items
    if (n === cur.length) return
    if (n > cur.length) {
      onChange({ columnsCount: n, items: [...cur, ...Array.from({ length: n - cur.length }, () => [] as PageBlock[])] })
    } else {
      // n < cur.length — сливаем хвост в последнюю оставшуюся
      const kept = cur.slice(0, n - 1)
      const rest = cur.slice(n - 1).flat()
      onChange({ columnsCount: n, items: [...kept, rest] })
    }
  }

  const setColItems = (colIdx: number, items: PageBlock[]) => {
    onChange({ items: block.items.map((c, i) => (i === colIdx ? items : c)) })
  }

  const swapCols = (i: number, j: number) => {
    if (i === j || i < 0 || j < 0 || i >= block.items.length || j >= block.items.length) return
    const next = block.items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange({ items: next })
  }

  // Переместить блок из колонки src в колонку dst (в конец)
  const moveBlockToCol = (blockId: string, srcCol: number, dstCol: number) => {
    if (srcCol === dstCol) return
    const src = block.items[srcCol]
    const dst = block.items[dstCol]
    if (!src || !dst) return
    const item = src.find((b) => b.id === blockId)
    if (!item) return
    const nextItems = block.items.map((col, i) => {
      if (i === srcCol) return col.filter((b) => b.id !== blockId)
      if (i === dstCol) return [...col, item]
      return col
    })
    onChange({ items: nextItems })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Колонок:</span>
        <div className="inline-flex bg-gray-100 rounded p-0.5">
          {([2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={cn(
                "px-2 py-1 text-xs rounded",
                block.columnsCount === n ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="ml-2 text-[11px] text-gray-500">
          Поменять местами:
        </span>
        {block.items.map((_, i) => (
          i < block.items.length - 1 ? (
            <button
              key={i}
              type="button"
              onClick={() => swapCols(i, i + 1)}
              className="px-1.5 py-0.5 text-[11px] rounded border border-gray-300 hover:bg-yellow-50 text-gray-700"
              title={`Поменять колонки ${i + 1} и ${i + 2} местами`}
            >
              {i + 1} ↔ {i + 2}
            </button>
          ) : null
        ))}

        <span className="ml-2 text-[11px] text-gray-500">Выравнивание:</span>
        <div className="inline-flex bg-gray-100 rounded p-0.5">
          {(["top", "center", "bottom"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ verticalAlign: v })}
              className={cn(
                "px-2 py-1 text-[11px] rounded",
                (block.verticalAlign || "top") === v
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-900",
              )}
              title={v === "top" ? "По верху" : v === "center" ? "По центру" : "По низу"}
            >
              {v === "top" ? "⇱" : v === "center" ? "⇔" : "⇲"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        "grid gap-2",
        block.columnsCount === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2",
        (block.verticalAlign || "top") === "center" && "items-center",
        (block.verticalAlign || "top") === "bottom" && "items-end",
      )}>
        {block.items.map((col, colIdx) => (
          <NestedColumn
            key={colIdx}
            items={col}
            colIdx={colIdx}
            totalCols={block.items.length}
            onChange={(items) => setColItems(colIdx, items)}
            onMoveToCol={(id, dst) => moveBlockToCol(id, colIdx, dst)}
            slug={slug}
          />
        ))}
      </div>
    </div>
  )
}

function NestedColumn({ items, colIdx, totalCols, onChange, onMoveToCol, slug }: {
  items: PageBlock[]
  colIdx: number
  totalCols: number
  onChange: (v: PageBlock[]) => void
  onMoveToCol: (blockId: string, dstCol: number) => void
  slug: string
}) {
  const add = (type: PageBlockType) => onChange([...items, defaultBlockData(type)])
  const del = (id: string) => onChange(items.filter((b) => b.id !== id))
  const move = (id: string, dir: -1 | 1) => {
    const i = items.findIndex((b) => b.id === id)
    if (i < 0) return
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const update = (id: string, patch: any) => {
    onChange(items.map((b) => (b.id === id ? { ...b, ...patch } as PageBlock : b)))
  }

  return (
    <div className="p-2 rounded bg-gray-50 border border-dashed border-gray-300 space-y-2 min-h-[80px]">
      {items.length === 0 && (
        <div className="text-[11px] text-gray-400 text-center py-3">Пустая колонка</div>
      )}
      {items.map((b, idx) => (
        <div key={b.id} className="p-2 rounded bg-white border border-gray-200 space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="uppercase tracking-wide font-medium mr-auto">{b.type}</span>
            {idx > 0 && (
              <button type="button" onClick={() => move(b.id, -1)} className="hover:text-gray-900" title="Выше">↑</button>
            )}
            {idx < items.length - 1 && (
              <button type="button" onClick={() => move(b.id, 1)} className="hover:text-gray-900" title="Ниже">↓</button>
            )}
            {colIdx > 0 && (
              <button
                type="button"
                onClick={() => onMoveToCol(b.id, colIdx - 1)}
                className="hover:text-gray-900"
                title="В левую колонку"
              >←</button>
            )}
            {colIdx < totalCols - 1 && (
              <button
                type="button"
                onClick={() => onMoveToCol(b.id, colIdx + 1)}
                className="hover:text-gray-900"
                title="В правую колонку"
              >→</button>
            )}
            <button type="button" onClick={() => del(b.id)} className="text-red-600 hover:text-red-700" title="Удалить">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <BlockEditorSwitch block={b} onChange={(p) => update(b.id, p)} slug={slug} />
        </div>
      ))}
      <AddBlockMenu onAdd={add} nested />
    </div>
  )
}
