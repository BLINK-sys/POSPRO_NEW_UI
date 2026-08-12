"use client"

/**
 * Блочный конструктор страницы. Хранит массив блоков (`PageBlock[]`),
 * отдаёт наверх сериализованную JSON-строку через `onChange`.
 *
 * Layout: sticky-сайдбар слева (панель «Добавить блок» + переключатель
 * режима) + список блоков справа. Режима два:
 *   - edit    — обёртки блоков с настройками, drag-handles, up/down/delete
 *   - preview — как выглядит страница, но при hover появляется drag-handle
 *               и удаление; клик по блоку — быстрый переход в edit-режим
 *               с автоскроллом к этому блоку.
 *
 * Drag-to-side (Notion-style): при drag'е блока над правой половиной
 * другого блока (или его левой) — вместо обычного reorder происходит
 * группировка в `columns` (2 колонки). Активная зона визуализируется
 * вертикальной жёлтой полосой у соседа.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  pointerWithin, DragOverlay, useDroppable,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Heading as HeadingIcon, Type, Image as ImageIcon, Info as InfoIcon, Minus,
  Youtube as YoutubeIcon, MousePointerClick, Code, Table as TableIcon, Columns as ColumnsIcon,
  Eye, Edit3, GripVertical, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BlockWrapper } from "./block-wrapper"
import { AddBlockMenu } from "./add-block-menu"
import { BlockEditorSwitch, ColumnsEditor } from "./block-editors"
import { BlocksRenderer } from "./renderer"
import {
  defaultBlockData, parsePageContent, serializePageContent, newBlockId,
  type PageBlock, type PageBlockType, type ColumnsBlock,
} from "@/lib/page-blocks/types"

const LABELS: Record<PageBlockType, { label: string; icon: React.ReactNode }> = {
  heading:   { label: "Заголовок",   icon: <HeadingIcon className="h-3.5 w-3.5" /> },
  paragraph: { label: "Параграф",    icon: <Type className="h-3.5 w-3.5" /> },
  image:     { label: "Картинка",    icon: <ImageIcon className="h-3.5 w-3.5" /> },
  callout:   { label: "Callout",     icon: <InfoIcon className="h-3.5 w-3.5" /> },
  youtube:   { label: "YouTube",     icon: <YoutubeIcon className="h-3.5 w-3.5" /> },
  button:    { label: "Кнопка",      icon: <MousePointerClick className="h-3.5 w-3.5" /> },
  table:     { label: "Таблица",     icon: <TableIcon className="h-3.5 w-3.5" /> },
  columns:   { label: "Колонки",     icon: <ColumnsIcon className="h-3.5 w-3.5" /> },
  divider:   { label: "Разделитель", icon: <Minus className="h-3.5 w-3.5" /> },
  html:      { label: "Сырой HTML (legacy)", icon: <Code className="h-3.5 w-3.5" /> },
}

interface Props {
  value: string
  onChange: (jsonString: string) => void
  slug: string
}

type Mode = "edit" | "preview"

export function PageBuilder({ value, onChange, slug }: Props) {
  const initial = useMemo(() => parsePageContent(value), [])
  const [blocks, setBlocks] = useState<PageBlock[]>(initial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("edit")
  // Явное намерение drop: reorder = поменять местами (индикатор — линия между
  // блоками), merge-left/right = склеить в columns (индикатор — обводка + значок).
  // Отдельный state вместо `dropSide` string — код читается прямее и меньше
  // мерцает: индикатор обновляется только при смене intent или target.
  const [dropIntent, setDropIntent] = useState<null | { targetId: string; kind: "reorder" | "merge-left" | "merge-right" }>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Внешнее обновление value — ре-парсим только если реально другой.
  useEffect(() => {
    const parsed = parsePageContent(value)
    if (serializePageContent(parsed) !== serializePageContent(blocks)) {
      setBlocks(parsed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const commit = useCallback((next: PageBlock[]) => {
    setBlocks(next)
    onChange(serializePageContent(next))
  }, [onChange])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const addBlock = (type: PageBlockType) => {
    const b = defaultBlockData(type)
    commit([...blocks, b])
    setSelectedId(b.id)
  }

  const deleteBlock = (id: string) => {
    commit(blocks.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= blocks.length) return
    commit(arrayMove(blocks, idx, next))
  }

  const updateBlock = (id: string, patch: any) => {
    commit(blocks.map((b) => (b.id === id ? { ...b, ...patch } as PageBlock : b)))
  }

  // Возвращает индекс блока по id (либо -1)
  const idxOf = (id: string) => blocks.findIndex((b) => b.id === id)

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id))
    setDropIntent(null)
  }

  // Логика drop-зон:
  //   - Reorder: over.id = id блока (обычный sortable-droppable).
  //   - Merge:   over.id = `${blockId}::merge-<left|right>` — специальные
  //              nested droppable-зоны, зарегистрированные через
  //              useDroppable в компоненте DropOverlay. Наведение на них =
  //              автоматически "выбирает" их (не надо считать координаты).
  //   Приоритет: nested-зоны рендерятся с pointer-events: auto поверх
  //   блока, поэтому pointerWithin находит их первыми.
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) { setDropIntent(null); return }
    const overId = String(over.id)
    if (overId === String(active.id)) { setDropIntent(null); return }

    // Парсим суффикс merge-зоны
    if (overId.includes("::merge-")) {
      const [blockId, sub] = overId.split("::")
      if (blockId === String(active.id)) { setDropIntent(null); return }
      const activeBlock = blocks.find((b) => b.id === active.id)
      const overBlock = blocks.find((b) => b.id === blockId)
      const canMerge = !!overBlock && !!activeBlock
        && overBlock.type !== "columns" && activeBlock.type !== "columns"
      if (!canMerge) {
        setDropIntent((prev) => prev?.targetId === blockId && prev.kind === "reorder" ? prev : { targetId: blockId, kind: "reorder" })
        return
      }
      const kind: DropKind = sub === "merge-left" ? "merge-left" : "merge-right"
      setDropIntent((prev) => prev?.targetId === blockId && prev.kind === kind ? prev : { targetId: blockId, kind })
      return
    }

    // Обычный sortable-target — reorder
    setDropIntent((prev) => prev?.targetId === overId && prev.kind === "reorder" ? prev : { targetId: overId, kind: "reorder" })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    const intent = dropIntent
    setDraggingId(null)
    setDropIntent(null)

    if (!over) return
    const overRaw = String(over.id)
    // Достаём blockId цели (для merge-зон убираем суффикс `::merge-*`)
    const overBlockId = overRaw.includes("::") ? overRaw.split("::")[0] : overRaw
    if (overBlockId === String(active.id)) return

    const aIdx = idxOf(String(active.id))
    const oIdx = idxOf(overBlockId)
    if (aIdx < 0 || oIdx < 0) return

    // Merge → columns
    if (intent && (intent.kind === "merge-left" || intent.kind === "merge-right") && intent.targetId === overBlockId) {
      const activeBlock = blocks[aIdx]
      const overBlock = blocks[oIdx]
      if (!activeBlock || !overBlock || overBlock.type === "columns" || activeBlock.type === "columns") {
        commit(arrayMove(blocks, aIdx, oIdx))
        return
      }
      const first = intent.kind === "merge-left" ? activeBlock : overBlock
      const second = intent.kind === "merge-left" ? overBlock : activeBlock
      const group: ColumnsBlock = {
        id: newBlockId(), type: "columns", columnsCount: 2,
        items: [[first], [second]],
      }
      const next = blocks
        .map((b, i) => (i === oIdx ? group : b))
        .filter((b) => b.id !== activeBlock.id)
      commit(next)
      return
    }

    // Reorder
    commit(arrayMove(blocks, aIdx, oIdx))
  }

  // Разлепить columns → блоки становятся standalone, в том же месте.
  const ungroupColumns = (id: string) => {
    const idx = idxOf(id)
    if (idx < 0) return
    const b = blocks[idx]
    if (b.type !== "columns") return
    const flat = b.items.flat()
    const next = blocks.slice(0, idx).concat(flat).concat(blocks.slice(idx + 1))
    commit(next)
  }

  const editBlockInEditMode = (id: string) => {
    setMode("edit")
    setSelectedId(id)
    // Автоскролл — на следующем тике DOM будет с BlockWrapper
    setTimeout(() => {
      document.getElementById(`pb-block-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 50)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
      {/* ── Sticky-сайдбар слева: режим + панель «Добавить блок» ───────── */}
      <aside className="md:sticky md:top-24 self-start bg-white border border-gray-200 rounded-lg p-2 h-fit">
        <div className="inline-flex bg-gray-100 rounded p-0.5 w-full mb-3">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
              mode === "edit" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900",
            )}
            title="Редактирование"
          >
            <Edit3 className="h-3 w-3" />
            <span>Правка</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
              mode === "preview" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900",
            )}
            title="Превью"
          >
            <Eye className="h-3 w-3" />
            <span>Превью</span>
          </button>
        </div>

        <AddBlockMenu onAdd={addBlock} variant="sidebar" />
      </aside>

      {/* ── Правая колонка: список блоков ───────────────────────────────
          overflow-hidden — страховка от горизонтального скроллбара, если
          DragOverlay/drop-indicator неудачно вылезет за края. */}
      <div className="min-w-0 overflow-x-hidden">
        {blocks.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            Пусто. Добавьте блок из панели слева.
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setDraggingId(null); setDropIntent(null) }}
        >
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((b, idx) => (
                <RootBlock
                  key={b.id}
                  block={b}
                  idx={idx}
                  total={blocks.length}
                  mode={mode}
                  selected={selectedId === b.id}
                  slug={slug}
                  intent={dropIntent?.targetId === b.id ? dropIntent.kind : null}
                  isDragging={draggingId === b.id}
                  isSomethingDragging={!!draggingId && draggingId !== b.id}
                  onSelect={() => setSelectedId(b.id)}
                  onDelete={() => deleteBlock(b.id)}
                  onMoveUp={idx > 0 ? () => moveBlock(b.id, -1) : undefined}
                  onMoveDown={idx < blocks.length - 1 ? () => moveBlock(b.id, 1) : undefined}
                  onUpdate={(p) => updateBlock(b.id, p)}
                  onEditInEditMode={() => editBlockInEditMode(b.id)}
                  onUngroupColumns={b.type === "columns" ? () => ungroupColumns(b.id) : undefined}
                />
              ))}
            </div>
          </SortableContext>

          {/* DragOverlay: перетаскиваемый прокси-элемент. Оригинал остаётся
              в потоке (opacity 0.4 через isDragging), overlay летает поверх
              вне flow — не двигает layout, не вылезает за родителя. */}
          <DragOverlay
            dropAnimation={null}
            style={{ pointerEvents: "none" }}
          >
            {draggingId ? (() => {
              const b = blocks.find((x) => x.id === draggingId)
              if (!b) return null
              const meta = LABELS[b.type]
              return (
                <div className="bg-white border-2 border-brand-yellow rounded-lg shadow-2xl px-3 py-2 flex items-center gap-2 opacity-90 max-w-md">
                  {meta.icon}
                  <span className="text-sm font-medium text-gray-900">
                    {meta.label}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">перенос…</span>
                </div>
              )
            })() : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

// ── Один корневой блок: рендер зависит от mode ───────────────────────

type DropKind = "reorder" | "merge-left" | "merge-right"

interface RootBlockProps {
  block: PageBlock
  idx: number
  total: number
  mode: Mode
  selected: boolean
  slug: string
  intent: DropKind | null
  isDragging: boolean
  isSomethingDragging: boolean  // общий флаг что drag активен (не именно этот блок)
  onSelect: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onUpdate: (p: any) => void
  onEditInEditMode: () => void
  onUngroupColumns?: () => void
}

/**
 * Overlay поверх блока при drag'е.
 *
 * Merge-зоны (левая/правая половины) — реальные droppable через
 * useDroppable с id `${blockId}::merge-left` / `::merge-right`. Наведение
 * курсором на любую точку зоны сразу переключает intent — не считаем
 * координаты вручную. `pointer-events: auto` на зонах, DragOverlay-прокси
 * имеет `pointer-events: none`, поэтому курсор физически «видит» зоны.
 *
 * Reorder работает как обычный sortable-таргет — над блоком, вне merge-зон
 * (верхние/нижние 20%). Индикатор — жёлтая полоска сверху/снизу.
 *
 * `enabled` — только когда идёт drag ДРУГОГО блока. `mergeAllowed` — false
 * для columns-target, тогда merge-зоны скрыты и вся площадь = reorder.
 */
function DropOverlay({
  blockId, intent, enabled, mergeAllowed,
}: { blockId: string; intent: DropKind | null; enabled: boolean; mergeAllowed: boolean }) {
  const dropLeft = useDroppable({ id: `${blockId}::merge-left`, disabled: !enabled || !mergeAllowed })
  const dropRight = useDroppable({ id: `${blockId}::merge-right`, disabled: !enabled || !mergeAllowed })

  if (!enabled) return null

  const activeLeft  = intent === "merge-left"
  const activeRight = intent === "merge-right"
  const activeReorder = intent === "reorder"

  return (
    <div className="absolute inset-0 pointer-events-none z-20 rounded-lg overflow-hidden">
      {/* Reorder полоски сверху/снизу — просто индикация, реальный reorder
          триггерится через parent sortable (наведение на блок вне merge-зон). */}
      <span className={cn(
        "absolute top-0 left-0 right-0 h-1.5 transition-colors",
        activeReorder ? "bg-brand-yellow" : "bg-transparent",
      )} />
      <span className={cn(
        "absolute bottom-0 left-0 right-0 h-1.5 transition-colors",
        activeReorder ? "bg-brand-yellow" : "bg-transparent",
      )} />

      {mergeAllowed && (
        <>
          {/* Левая половина: pointer-events:auto → droppable ловит hover */}
          <div
            ref={dropLeft.setNodeRef}
            className={cn(
              "absolute left-0 w-1/2 flex items-center justify-center text-[11px] font-medium transition-all pointer-events-auto",
              "top-[20%] bottom-[20%]",
              activeLeft
                ? "bg-brand-yellow/80 text-black shadow-inner ring-2 ring-inset ring-brand-yellow"
                : "bg-brand-yellow/15 text-yellow-700 border-r border-yellow-200/60",
            )}
          >
            <span className={cn("px-2 py-1 rounded", activeLeft && "bg-white/60")}>← Прилепить слева</span>
          </div>
          {/* Правая половина: то же справа */}
          <div
            ref={dropRight.setNodeRef}
            className={cn(
              "absolute right-0 w-1/2 flex items-center justify-center text-[11px] font-medium transition-all pointer-events-auto",
              "top-[20%] bottom-[20%]",
              activeRight
                ? "bg-brand-yellow/80 text-black shadow-inner ring-2 ring-inset ring-brand-yellow"
                : "bg-brand-yellow/15 text-yellow-700",
            )}
          >
            <span className={cn("px-2 py-1 rounded", activeRight && "bg-white/60")}>Прилепить справа →</span>
          </div>
        </>
      )}
    </div>
  )
}

function RootBlock(props: RootBlockProps) {
  // Разные компоненты для edit/preview — каждый вызывает useSortable у себя,
  // чтобы не было двух хуков для одного sortable id в одном рендере.
  return props.mode === "preview" ? <PreviewBlock {...props} /> : <EditBlock {...props} />
}

function PreviewBlock({
  block, selected, intent, isDragging, isSomethingDragging,
  onSelect, onDelete, onEditInEditMode,
}: RootBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`pb-block-${block.id}`}
      className={cn(
        "relative group rounded transition-all",
        selected && !intent && "outline outline-2 outline-brand-yellow outline-offset-2",
      )}
    >
        <DropOverlay blockId={block.id} intent={intent} enabled={isSomethingDragging} mergeAllowed={block.type !== "columns"} />

        {/* Оверлейные кнопки: drag-handle слева + edit/delete справа */}
        <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            {...attributes}
            {...listeners}
            type="button"
            title="Перетащить (drag вправо на соседа = колонки)"
            className="p-1 rounded bg-white border border-gray-200 shadow-sm hover:bg-yellow-50 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
          <button
            type="button"
            onClick={onEditInEditMode}
            title="Открыть в правке"
            className="p-1 rounded bg-white border border-gray-200 shadow-sm hover:bg-yellow-50 text-gray-500 hover:text-black"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Удалить блок"
            className="p-1 rounded bg-white border border-gray-200 shadow-sm hover:bg-red-50 text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

      {/* Сам контент — рендерится через public renderer */}
      <div onClick={onSelect} className="cursor-pointer">
        <BlocksRenderer blocks={[block]} />
      </div>
    </div>
  )
}

function EditBlock({
  block, selected, slug, intent, isSomethingDragging,
  onSelect, onDelete, onMoveUp, onMoveDown, onUpdate, onUngroupColumns,
}: RootBlockProps) {
  const meta = LABELS[block.type]
  return (
    <div id={`pb-block-${block.id}`} className="relative">
      <DropOverlay blockId={block.id} intent={intent} enabled={isSomethingDragging} mergeAllowed={block.type !== "columns"} />

      <BlockWrapper
        id={block.id}
        label={meta.label}
        icon={meta.icon}
        selected={selected}
        onSelect={onSelect}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onUngroup={onUngroupColumns}
      >
        {block.type === "columns" ? (
          <ColumnsEditor block={block} onChange={onUpdate} slug={slug} />
        ) : block.type === "html" ? (
          <div className="space-y-2">
            <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Старый HTML (до перехода на блочный редактор). Пересобери из блоков — иначе останется как есть.
            </div>
            <div
              className="prose prose-sm max-w-none border border-gray-200 rounded p-2 bg-gray-50"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          </div>
        ) : (
          <BlockEditorSwitch block={block} onChange={onUpdate} slug={slug} />
        )}
      </BlockWrapper>
    </div>
  )
}
