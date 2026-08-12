"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Save,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  Tag,
  Sparkles,
  Loader2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronDown as ChevronDownSmall,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import AdminLoading from "@/components/admin-loading"
import HeaderMenuItemDialog from "@/components/header-menu-item-dialog"
import {
  getHeaderStripSettings,
  saveHeaderStripSettings,
  getHeaderMenuItems,
  deleteHeaderMenuItem,
  reorderHeaderMenuItems,
  updateHeaderMenuItem,
  type HeaderStripSettings,
  type HeaderMenuItem,
} from "@/app/actions/header-settings"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const SOFT_INPUT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)]"
const CARD_CLASS =
  "rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"

const DEFAULT_STRIP: HeaderStripSettings = {
  strip_enabled: false,
  strip_text: "",
  strip_clickable: false,
  strip_url: "",
  strip_open_new_tab: false,
}

// ── Сортируемый элемент списка (top-level, с DnD) ─────────────────────

interface SortableRowProps {
  item: HeaderMenuItem
  onEdit: () => void
  onDelete: () => void
  onToggleActive: (id: number, value: boolean) => void
  togglePending: boolean
  onAddChild?: () => void
  isExpanded?: boolean
  onToggleExpanded?: () => void
}

function SortableRow({
  item, onEdit, onDelete, onToggleActive, togglePending,
  onAddChild, isExpanded, onToggleExpanded,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const hasChildrenMode = item.kind === "custom" && item.has_children_mode
  const childrenCount = item.children?.length ?? 0

  return (
    <div ref={setNodeRef} style={style}>
      <RowInner
        item={item}
        dragHandleProps={{ ...attributes, ...listeners }}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        togglePending={togglePending}
        onAddChild={onAddChild}
        isExpanded={isExpanded}
        onToggleExpanded={hasChildrenMode ? onToggleExpanded : undefined}
        childrenCount={childrenCount}
        canMove={undefined}
      />
    </div>
  )
}

/**
 * Внутреннее содержимое строки — общий рендер для top-level (обёрнут в
 * useSortable) и nested-children (без DnD, только стрелки up/down).
 */
function RowInner({
  item, dragHandleProps, onEdit, onDelete, onToggleActive, togglePending,
  onAddChild, isExpanded, onToggleExpanded, childrenCount, canMove,
}: {
  item: HeaderMenuItem
  dragHandleProps?: any
  onEdit: () => void
  onDelete: () => void
  onToggleActive: (id: number, value: boolean) => void
  togglePending: boolean
  onAddChild?: () => void
  isExpanded?: boolean
  onToggleExpanded?: () => void
  childrenCount: number
  canMove?: { up: boolean; down: boolean; onUp: () => void; onDown: () => void }
}) {
  const hasChildrenMode = item.kind === "custom" && item.has_children_mode
  return (
    <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg">
      {dragHandleProps ? (
        <button
          {...dragHandleProps}
          className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Перетащить"
          type="button"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      ) : canMove ? (
        <div className="flex flex-col shrink-0">
          <button type="button" onClick={canMove.onUp} disabled={!canMove.up}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={canMove.onDown} disabled={!canMove.down}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronDownSmall className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      {onToggleExpanded ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
          title={isExpanded ? "Свернуть" : "Развернуть"}
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {item.kind === "custom" ? (
          <Sparkles className="h-4 w-4 text-brand-yellow shrink-0" />
        ) : (
          <Tag className="h-4 w-4 text-gray-500 shrink-0" />
        )}
        <span className={`font-medium truncate ${!item.is_active ? "text-gray-400" : "text-gray-900"}`}>
          {item.name || "(без названия)"}
        </span>
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
          {item.kind === "custom" ? "Свой раздел" : "Категория"}
        </Badge>
        {hasChildrenMode && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 border-brand-yellow text-yellow-700">
            {childrenCount} внутри
          </Badge>
        )}
        {item.kind === "custom" && !hasChildrenMode && item.product_ids && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 border-brand-yellow text-yellow-700">
            {item.product_ids.length} тов.
          </Badge>
        )}
        {item.slug && (
          <span className="text-xs text-gray-400 truncate hidden md:inline">/category/{item.slug}</span>
        )}
      </div>

      {onAddChild && (
        <Button
          variant="ghost" size="sm"
          onClick={onAddChild}
          className="h-8 text-xs"
          title="Добавить вложенный пункт"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Вложенные категории
        </Button>
      )}

      <label
        className="inline-flex items-center gap-2 text-xs text-gray-600 shrink-0 cursor-pointer"
        title={item.is_active ? "Скрыть из шапки" : "Показать в шапке"}
      >
        <Switch
          checked={item.is_active}
          disabled={togglePending}
          onCheckedChange={(v) => onToggleActive(item.id, v)}
        />
        <span className="hidden sm:inline">{item.is_active ? "Виден" : "Скрыт"}</span>
      </label>
      <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost" size="icon"
        onClick={onDelete}
        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * Рекурсивный рендер nested-детей. Без DnD (multi-container сложно и
 * хрупко), reorder через стрелки up/down. Move между parent'ами через
 * PUT parent_id (не сделано пока — юзер редактирует через удаление+создание).
 */
function ChildrenList({
  items, parentId, onEdit, onDelete, onToggleActive, togglingId,
  onAddChild, expanded, onToggleExpanded, onMoveChild,
}: {
  items: HeaderMenuItem[]
  parentId: number
  onEdit: (item: HeaderMenuItem) => void
  onDelete: (item: HeaderMenuItem) => void
  onToggleActive: (id: number, value: boolean) => void
  togglingId: number | null
  onAddChild: (parentId: number) => void
  expanded: Set<number>
  onToggleExpanded: (id: number) => void
  onMoveChild: (parentId: number, id: number, dir: -1 | 1) => void
}) {
  return (
    <div className="ml-8 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
      {items.map((child, idx) => {
        const isCustom = child.kind === "custom" && child.has_children_mode
        const isExp = expanded.has(child.id)
        return (
          <div key={child.id}>
            <RowInner
              item={child}
              onEdit={() => onEdit(child)}
              onDelete={() => onDelete(child)}
              onToggleActive={onToggleActive}
              togglePending={togglingId === child.id}
              onAddChild={isCustom ? () => onAddChild(child.id) : undefined}
              isExpanded={isExp}
              onToggleExpanded={isCustom ? () => onToggleExpanded(child.id) : undefined}
              childrenCount={child.children?.length ?? 0}
              canMove={{
                up: idx > 0,
                down: idx < items.length - 1,
                onUp: () => onMoveChild(parentId, child.id, -1),
                onDown: () => onMoveChild(parentId, child.id, 1),
              }}
            />
            {isCustom && isExp && child.children && child.children.length > 0 && (
              <ChildrenList
                items={child.children}
                parentId={child.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
                togglingId={togglingId}
                onAddChild={onAddChild}
                expanded={expanded}
                onToggleExpanded={onToggleExpanded}
                onMoveChild={onMoveChild}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Основной компонент ────────────────────────────────────────────────

export default function HeaderInfoTab() {
  const { toast } = useToast()
  const [strip, setStrip] = useState<HeaderStripSettings>(DEFAULT_STRIP)
  const [items, setItems] = useState<HeaderMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingStrip, setSavingStrip] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<HeaderMenuItem | null>(null)
  // При открытии диалога для нового вложенного пункта передаём parent_id
  const [dialogParentId, setDialogParentId] = useState<number | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<HeaderMenuItem | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, list] = await Promise.all([
        getHeaderStripSettings(),
        getHeaderMenuItems(),
      ])
      if (s) setStrip(s)
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSaveStrip = async () => {
    setSavingStrip(true)
    const res = await saveHeaderStripSettings(strip)
    setSavingStrip(false)
    if (res.success) {
      toast({ title: "Сохранено", description: "Строка уведомления обновлена" })
    } else {
      toast({ title: "Ошибка", description: res.error, variant: "destructive" })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.id === active.id)
    const newIdx = items.findIndex((i) => i.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(items, oldIdx, newIdx)
    setItems(next) // оптимистично
    const res = await reorderHeaderMenuItems(next.map((i) => i.id))
    if (!res.success) {
      toast({ title: "Ошибка", description: res.error, variant: "destructive" })
      await load()
    }
  }

  const handleAddClick = () => {
    setEditingItem(null)
    setDialogParentId(null)
    setDialogOpen(true)
  }

  const handleAddChild = (parentId: number) => {
    setEditingItem(null)
    setDialogParentId(parentId)
    setDialogOpen(true)
    // Автораскрываем родителя чтобы новый ребёнок сразу был виден
    setExpanded((prev) => new Set([...Array.from(prev), parentId]))
  }

  const handleEditClick = (item: HeaderMenuItem) => {
    setEditingItem(item)
    setDialogParentId(null)
    setDialogOpen(true)
  }

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Перестановка ребёнка внутри одного parent'а (без DnD)
  const handleMoveChild = async (parentId: number, id: number, dir: -1 | 1) => {
    // Локально ищем и переставляем в дереве
    const swap = (arr: HeaderMenuItem[]): HeaderMenuItem[] => {
      const i = arr.findIndex((x) => x.id === id)
      if (i < 0) return arr
      const j = i + dir
      if (j < 0 || j >= arr.length) return arr
      const next = arr.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    }
    // walkTree — заменяем children нужного parent'а
    const walk = (arr: HeaderMenuItem[]): HeaderMenuItem[] =>
      arr.map((n) => {
        if (n.id === parentId && n.children) return { ...n, children: swap(n.children) }
        if (n.children) return { ...n, children: walk(n.children) }
        return n
      })
    const nextItems = walk(items)
    setItems(nextItems)
    // Находим новый порядок id для parent'а
    const findKids = (arr: HeaderMenuItem[]): HeaderMenuItem[] | null => {
      for (const n of arr) {
        if (n.id === parentId) return n.children ?? []
        if (n.children) {
          const r = findKids(n.children)
          if (r) return r
        }
      }
      return null
    }
    const kids = findKids(nextItems)
    if (!kids) return
    const res = await reorderHeaderMenuItems(kids.map((k) => k.id), parentId)
    if (!res.success) {
      toast({ title: "Ошибка", description: res.error, variant: "destructive" })
      await load()
    }
  }

  const handleToggleActive = async (id: number, value: boolean) => {
    // Оптимистично меняем локально — свитч не «залипает» на время запроса.
    // Рекурсивно, потому что пункт может быть в children.
    const walk = (arr: HeaderMenuItem[]): HeaderMenuItem[] =>
      arr.map((n) =>
        n.id === id ? { ...n, is_active: value }
        : n.children ? { ...n, children: walk(n.children) }
        : n
      )
    setItems((prev) => walk(prev))
    setTogglingId(id)
    const res = await updateHeaderMenuItem(id, { is_active: value })
    setTogglingId(null)
    if (!res.success) {
      toast({ title: "Ошибка", description: res.error, variant: "destructive" })
      await load() // откатываемся к серверному состоянию
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const res = await deleteHeaderMenuItem(deleteTarget.id)
    setDeleteTarget(null)
    if (res.success) {
      toast({ title: "Удалено" })
      await load()
    } else {
      toast({ title: "Ошибка", description: res.error, variant: "destructive" })
    }
  }

  if (loading) return <AdminLoading />

  return (
    <div className="space-y-6">
      {/* ── Строка уведомления ─────────────────────────────────────
          Компактный однорядный layout: заголовок + 3 переключателя-чипа
          + Сохранить в одной строке шапки, ниже — Text и (условно) Url в
          два равных инпута. Подписи под свитчами убрал — короткого лейбла
          и подсказки-tooltip достаточно, а описание чем является полоса
          не помогает при десятом просмотре страницы. */}
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-lg mr-auto">Строка уведомления</CardTitle>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <Switch
                checked={strip.strip_enabled}
                onCheckedChange={(v) => setStrip((s) => ({ ...s, strip_enabled: v }))}
              />
              <span>Показывать</span>
            </label>
            <label className={`inline-flex items-center gap-2 text-sm cursor-pointer transition-opacity ${!strip.strip_enabled ? "opacity-40" : "text-gray-700"}`}>
              <Switch
                checked={strip.strip_clickable}
                onCheckedChange={(v) => setStrip((s) => ({ ...s, strip_clickable: v }))}
                disabled={!strip.strip_enabled}
              />
              <span>Кликабельная</span>
            </label>
            <label className={`inline-flex items-center gap-2 text-sm cursor-pointer transition-opacity ${!strip.strip_clickable || !strip.strip_enabled ? "opacity-40" : "text-gray-700"}`} title='target="_blank"'>
              <Switch
                checked={strip.strip_open_new_tab}
                onCheckedChange={(v) => setStrip((s) => ({ ...s, strip_open_new_tab: v }))}
                disabled={!strip.strip_clickable || !strip.strip_enabled}
              />
              <span>В новой вкладке</span>
            </label>

            <Button onClick={handleSaveStrip} disabled={savingStrip} size="sm" className={PRIMARY_BTN}>
              {savingStrip ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Save className="h-4 w-4 mr-1.5" /> Сохранить</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={`grid gap-3 ${strip.strip_clickable ? "md:grid-cols-2" : "grid-cols-1"}`}>
            <Input
              value={strip.strip_text}
              onChange={(e) => setStrip((s) => ({ ...s, strip_text: e.target.value }))}
              placeholder="Текст полосы, напр. «Новое поступление кофейного оборудования»"
              maxLength={500}
              className={SOFT_INPUT}
            />
            {strip.strip_clickable && (
              <Input
                value={strip.strip_url}
                onChange={(e) => setStrip((s) => ({ ...s, strip_url: e.target.value }))}
                placeholder="Ссылка: /category/... или https://..."
                maxLength={500}
                className={SOFT_INPUT}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Разделы категорий ────────────────────────────────────── */}
      <Card className={CARD_CLASS}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">Разделы категорий</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Пункты нижней полосы шапки. Категория — ссылка на существующую;
              «свой раздел» — курируемый список товаров с уникальным slug.
            </p>
          </div>
          <Button onClick={handleAddClick} className={PRIMARY_BTN}>
            <Plus className="h-4 w-4 mr-2" /> Добавить
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Пока пусто. Добавьте категорию или создайте свой раздел.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {items.map((item) => {
                    const isCustom = item.kind === "custom" && item.has_children_mode
                    const isExp = expanded.has(item.id)
                    return (
                      <div key={item.id}>
                        <SortableRow
                          item={item}
                          onEdit={() => handleEditClick(item)}
                          onDelete={() => setDeleteTarget(item)}
                          onToggleActive={handleToggleActive}
                          togglePending={togglingId === item.id}
                          onAddChild={isCustom ? () => handleAddChild(item.id) : undefined}
                          isExpanded={isExp}
                          onToggleExpanded={() => toggleExpanded(item.id)}
                        />
                        {isCustom && isExp && item.children && item.children.length > 0 && (
                          <ChildrenList
                            items={item.children}
                            parentId={item.id}
                            onEdit={handleEditClick}
                            onDelete={setDeleteTarget}
                            onToggleActive={handleToggleActive}
                            togglingId={togglingId}
                            onAddChild={handleAddChild}
                            expanded={expanded}
                            onToggleExpanded={toggleExpanded}
                            onMoveChild={handleMoveChild}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <HeaderMenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        parentId={dialogParentId}
        onSaved={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пункт?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» будет удалён из шапки. Отменить нельзя.
              {deleteTarget?.kind === "custom" && (
                <> Связка с товарами тоже удалится (сами товары останутся).</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
