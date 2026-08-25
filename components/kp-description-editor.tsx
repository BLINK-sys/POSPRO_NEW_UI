"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Placeholder from "@tiptap/extension-placeholder"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bold as BoldIcon, Italic as ItalicIcon, Palette, RemoveFormatting } from "lucide-react"

/**
 * Компактный rich-text редактор для описания товара в КП.
 *
 * Поддерживает жирный / курсив / цвет выделенного текста. Значение
 * хранится как HTML (в поле KPItem.description). Пустое значение —
 * пустая строка (не `<p></p>`), чтобы placeholder показывался
 * корректно и старые «текстовые» описания продолжали работать.
 *
 * История клавиш: Ctrl+B, Ctrl+I как в стандартных редакторах.
 * Undo/Redo — Ctrl+Z / Ctrl+Y (обеспечивает StarterKit).
 */

const COLOR_PRESETS = [
  { name: "Обычный", value: "" },
  { name: "Красный", value: "#dc2626" },
  { name: "Зелёный", value: "#16a34a" },
  { name: "Синий", value: "#2563eb" },
  { name: "Оранжевый", value: "#ea580c" },
  { name: "Серый", value: "#6b7280" },
  { name: "Чёрный", value: "#000000" },
]

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function KpDescriptionEditor({ value, onChange, placeholder = "Описание товара…", className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          // Без `.prose` — она устанавливает --tw-prose-body для потомков
          // и перебивает inline style="color:X" от Color extension в spans,
          // поэтому цвет в редакторе не отображался. Базовый styling
          // остаётся ручным (text-[11px], leading-snug и т.п.).
          "focus:outline-none min-h-[64px] max-w-none px-2 py-1.5",
          "text-[11px] leading-snug text-gray-700",
          "[&_p]:m-0 [&_p+p]:mt-1 [&_p:empty]:min-h-[1em]",
          "[&_strong]:font-bold [&_em]:italic",
        ),
      },
    },
    onUpdate({ editor }) {
      // Пустой документ tiptap = `<p></p>` — сохраняем '' чтобы старая
      // логика hasDescription (item.description.trim().length > 0)
      // корректно определяла пустоту.
      const html = editor.getHTML()
      const isEmpty = editor.isEmpty
      onChange(isEmpty ? "" : html)
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Не эмитим update — иначе бесконечная петля через onChange.
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  const currentColor: string = (editor.getAttributes("textStyle").color as string) || ""

  const setColor = (c: string) => {
    const chain = editor.chain().focus()
    if (!c) chain.unsetColor().run()
    else chain.setColor(c).run()
  }

  const Btn = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void
    active?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-200 transition-colors",
        active && "bg-gray-200 text-gray-900",
      )}
    >
      {children}
    </button>
  )

  return (
    <div className={cn("border border-gray-200 rounded overflow-hidden bg-white", className)}>
      <div className="flex items-center gap-0.5 border-b border-gray-100 bg-gray-50 px-1 py-0.5">
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Жирный (Ctrl+B)"
        >
          <BoldIcon className="h-3 w-3" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Курсив (Ctrl+I)"
        >
          <ItalicIcon className="h-3 w-3" />
        </Btn>
        <div className="w-px h-4 bg-gray-300 mx-0.5" />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Цвет выделенного текста"
              className={cn(
                "h-6 px-1 inline-flex items-center gap-1 rounded hover:bg-gray-200 transition-colors",
                currentColor && "bg-gray-200 text-gray-900",
              )}
            >
              <Palette className="h-3 w-3" />
              <span
                className="inline-block w-3 h-3 rounded-full border border-gray-300"
                style={{ backgroundColor: currentColor || "transparent" }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2 space-y-2" align="start">
            <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Цвет текста</div>
            <div className="grid grid-cols-7 gap-1">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value || "reset"}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.name}
                  className={cn(
                    "w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform",
                    currentColor === c.value && "ring-2 ring-brand-yellow ring-offset-1",
                    !c.value && "bg-white bg-[linear-gradient(45deg,transparent_45%,#e5e7eb_45%,#e5e7eb_55%,transparent_55%)]",
                  )}
                  style={c.value ? { backgroundColor: c.value } : undefined}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentColor || "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded border border-gray-300 cursor-pointer bg-white p-0 overflow-hidden appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0"
                title="Свой цвет"
              />
              <input
                type="text"
                value={currentColor}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#RRGGBB"
                className="flex-1 min-w-0 h-7 px-1.5 rounded border border-gray-200 bg-white text-[10px] font-mono focus:outline-none focus:border-brand-yellow"
              />
            </div>
          </PopoverContent>
        </Popover>
        <div className="ml-auto">
          <Btn
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
            title="Очистить форматирование выделения"
          >
            <RemoveFormatting className="h-3 w-3" />
          </Btn>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
