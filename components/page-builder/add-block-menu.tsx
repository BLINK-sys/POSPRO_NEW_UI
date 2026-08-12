"use client"

import { useState } from "react"
import {
  Plus,
  Heading as HeadingIcon,
  Type,
  Image as ImageIcon,
  Info,
  Minus,
  Youtube as YoutubeIcon,
  MousePointerClick,
  Table as TableIcon,
  Columns as ColumnsIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PageBlockType } from "@/lib/page-blocks/types"

interface Props {
  onAdd: (type: PageBlockType) => void
  className?: string
  // Nested-режим (внутри колонки) прячет пункты «Колонки» и «HTML»,
  // чтобы нельзя было вкладывать колонки в колонки.
  nested?: boolean
  // Вариант отображения:
  //   'inline'  — старый dropdown-стиль (кнопка + всплывающее меню). Для
  //               nested-контейнеров внутри колонок.
  //   'sidebar' — развёрнутый вертикальный список кнопок. Для sticky
  //               панели инструментов в корневом PageBuilder.
  variant?: "inline" | "sidebar"
}

const ITEMS: Array<{ type: PageBlockType; label: string; icon: React.ReactNode; hint: string; nestedOk: boolean }> = [
  { type: "heading",   label: "Заголовок",  icon: <HeadingIcon className="h-4 w-4" />,        hint: "H1/H2/H3", nestedOk: true },
  { type: "paragraph", label: "Параграф",   icon: <Type className="h-4 w-4" />,               hint: "Текст с форматированием", nestedOk: true },
  { type: "image",     label: "Картинка",   icon: <ImageIcon className="h-4 w-4" />,          hint: "С обтеканием", nestedOk: true },
  { type: "callout",   label: "Callout",    icon: <Info className="h-4 w-4" />,               hint: "Инфо / предупреждение / успех", nestedOk: true },
  { type: "table",     label: "Таблица",    icon: <TableIcon className="h-4 w-4" />,          hint: "Строки × столбцы", nestedOk: true },
  { type: "youtube",   label: "YouTube",    icon: <YoutubeIcon className="h-4 w-4" />,        hint: "Видео по URL", nestedOk: true },
  { type: "button",    label: "Кнопка",     icon: <MousePointerClick className="h-4 w-4" />,  hint: "Ссылка-кнопка", nestedOk: true },
  { type: "divider",   label: "Разделитель",icon: <Minus className="h-4 w-4" />,              hint: "Горизонтальная линия", nestedOk: true },
  { type: "columns",   label: "Колонки",    icon: <ColumnsIcon className="h-4 w-4" />,        hint: "2 или 3 в ряд", nestedOk: false },
]

export function AddBlockMenu({ onAdd, className, nested = false, variant = "inline" }: Props) {
  const [open, setOpen] = useState(false)
  const items = nested ? ITEMS.filter((i) => i.nestedOk) : ITEMS

  if (variant === "sidebar") {
    // Развёрнутая панель для sticky-сайдбара — все кнопки видны сразу.
    return (
      <div className={cn("space-y-1", className)}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 px-2 pb-1">
          Добавить блок
        </div>
        {items.map((it) => (
          <button
            key={it.type}
            type="button"
            onClick={() => onAdd(it.type)}
            className="w-full flex items-start gap-2 px-2 py-1.5 rounded hover:bg-yellow-50 text-left transition-colors"
          >
            <span className="text-gray-500 mt-0.5">{it.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">{it.label}</span>
              <span className="block text-[11px] text-gray-500 truncate">{it.hint}</span>
            </span>
          </button>
        ))}
      </div>
    )
  }

  // Inline (dropdown) — для колонок и «в конце списка» вариантов.
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed",
          "border-gray-300 text-gray-500 hover:border-brand-yellow hover:text-black transition-colors",
        )}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Добавить блок</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-1 grid grid-cols-1 gap-0.5">
            {items.map((it) => (
              <button
                key={it.type}
                type="button"
                onClick={() => { setOpen(false); onAdd(it.type) }}
                className="flex items-start gap-2 px-3 py-2 rounded hover:bg-yellow-50 text-left"
              >
                <span className="text-gray-500 mt-0.5">{it.icon}</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-gray-900">{it.label}</span>
                  <span className="block text-xs text-gray-500">{it.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
