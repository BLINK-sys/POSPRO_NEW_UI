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

// ── Сортируемый элемент списка ────────────────────────────────────────

interface SortableRowProps {
  item: HeaderMenuItem
  onEdit: () => void
  onDelete: () => void
  onToggleActive: (id: number, value: boolean) => void
  togglePending: boolean
}

function SortableRow({ item, onEdit, onDelete, onToggleActive, togglePending }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing"
        aria-label="Перетащить"
        type="button"
      >
        <GripVertical className="h-5 w-5" />
      </button>
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
        {item.kind === "custom" && item.product_ids && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 border-brand-yellow text-yellow-700">
            {item.product_ids.length} тов.
          </Badge>
        )}
        {item.slug && (
          <span className="text-xs text-gray-400 truncate hidden md:inline">/category/{item.slug}</span>
        )}
      </div>
      {/* Inline-Switch активности — правится прямо в списке, не заходя в модалку */}
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
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
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

  const [deleteTarget, setDeleteTarget] = useState<HeaderMenuItem | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

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
    setDialogOpen(true)
  }

  const handleEditClick = (item: HeaderMenuItem) => {
    setEditingItem(item)
    setDialogOpen(true)
  }

  const handleToggleActive = async (id: number, value: boolean) => {
    // Оптимистично меняем локально — свитч не «залипает» на время запроса
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: value } : i)))
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
                  {items.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      onEdit={() => handleEditClick(item)}
                      onDelete={() => setDeleteTarget(item)}
                      onToggleActive={handleToggleActive}
                      togglePending={togglingId === item.id}
                    />
                  ))}
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
