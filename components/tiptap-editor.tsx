"use client"

import React, { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { cn } from "@/lib/utils"
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Quote,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react"

interface TipTapEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
}

export function TipTapEditor({ value, onChange, placeholder = "Введите текст инструкции...", editable = true }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-600 underline" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  const Btn = ({
    onClick,
    active,
    disabled,
    title,
    children,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-2 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
        active && "bg-gray-200 text-gray-900",
      )}
    >
      {children}
    </button>
  )

  const addLink = () => {
    const url = window.prompt("Введите URL:", "https://")
    if (!url) return
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-gray-50 px-2 py-1.5">
          <Btn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Жирный (Ctrl+B)"
          >
            <BoldIcon className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Курсив (Ctrl+I)"
          >
            <ItalicIcon className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Подчёркнутый (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Btn>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <Btn
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Заголовок 1"
          >
            <Heading1 className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Заголовок 2"
          >
            <Heading2 className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Заголовок 3"
          >
            <Heading3 className="h-4 w-4" />
          </Btn>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <Btn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Маркированный список"
          >
            <List className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Нумерованный список"
          >
            <ListOrdered className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Цитата"
          >
            <Quote className="h-4 w-4" />
          </Btn>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <Btn onClick={addLink} active={editor.isActive("link")} title="Ссылка">
            <Link2 className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="Очистить форматирование"
          >
            <RemoveFormatting className="h-4 w-4" />
          </Btn>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <Btn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Повторить (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Btn>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
