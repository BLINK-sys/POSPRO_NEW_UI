"use client"

/**
 * Обёртка одного блока в PageBuilder: drag-handle слева, кнопки
 * «удалить» / «вверх» / «вниз» справа, рамка при hover/selected.
 * Внутри рендерится редактор конкретного типа блока.
 */

import React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, ChevronUp, ChevronDown, Ungroup } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  id: string
  label: string      // «Заголовок», «Параграф» и т.п. — показывается в шапке блока
  icon?: React.ReactNode
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onUngroup?: () => void  // Только для columns — «разлепить» на отдельные блоки
  selected?: boolean
  onSelect?: () => void
  children: React.ReactNode
}

export function BlockWrapper({
  id, label, icon, onDelete, onMoveUp, onMoveDown, onUngroup, selected, onSelect, children,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative border rounded-lg bg-white transition-colors",
        selected ? "border-brand-yellow ring-2 ring-brand-yellow/40" : "border-gray-200 hover:border-gray-300",
      )}
      onClick={onSelect}
    >
      {/* Шапка блока — drag-handle + метка + кнопки. Всегда видна. */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 bg-gray-50/60 rounded-t-lg">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing"
          aria-label="Перетащить блок"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-auto">
          {icon}
          <span>{label}</span>
        </div>
        {onMoveUp && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveUp() }}
            className="p-1 rounded hover:bg-gray-200 text-gray-500"
            title="Выше"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveDown() }}
            className="p-1 rounded hover:bg-gray-200 text-gray-500"
            title="Ниже"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
        {onUngroup && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUngroup() }}
            className="p-1 rounded hover:bg-yellow-50 text-gray-600"
            title="Разлепить колонки — блоки станут отдельными"
          >
            <Ungroup className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1 rounded hover:bg-red-50 text-red-600"
          title="Удалить блок"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Тело блока */}
      <div className="p-3">
        {children}
      </div>
    </div>
  )
}
