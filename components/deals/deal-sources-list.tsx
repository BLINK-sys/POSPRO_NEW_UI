"use client"

/**
 * Справочник «Источник сделки» (/admin/deals/sources). CRUD, доступ только
 * для owner / can_manage_pipelines (та же привычная связка для настройки
 * CRM-структуры). Используется в селекте «Источник» на карточке сделки и
 * в поле «Источник по умолчанию» карточки веб-хука.
 *
 * Бэк: /api/admin/deal-sources.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown, ChevronRight, GripVertical, Layers, Loader2,
  Pencil, Plus, Signpost, Trash2, X,
} from "lucide-react"
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/context/auth-context"
import { useAdminUI } from "@/context/admin-ui-context"
import { useToast } from "@/hooks/use-toast"
import { crmDelete, crmGet, crmPost, crmPut } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"

interface DealSource {
  id: number
  name: string
  color: string | null
  sort_order: number
  is_active: boolean
  /** Кол-во DealSourceVariant под этим источником — приходит с бэка. */
  variants_count?: number
}

interface SourceVariant {
  id: number
  parent_source_id: number
  name: string
  order_pos: number
}

interface FormState {
  id: number | null
  name: string
  color: string
  sort_order: number
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  color: "#64748b",
  sort_order: 0,
  is_active: true,
}

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#facc15", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#78716c", "#64748b", "#334155",
]

export default function DealSourcesList() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { setHideHeader } = useAdminUI()
  const router = useRouter()

  // Гейт как у воронок: owner / can_manage_pipelines (одна галочка на
  // всю настройку CRM-структуры — воронки + проекты + источники).
  const canManage = Boolean(
    user && (user.is_owner || user.can_manage_pipelines),
  )
  useEffect(() => {
    if (user && !canManage) router.replace("/admin/deals")
  }, [user, canManage, router])

  // Прячем AdminHeaderNav когда открыта панель вариантов — чтобы освободить
  // вертикальное место (панель помещается от топа до низа viewport'а).
  // На анмаунт/закрытии гарантированно возвращаем.

  const [sources, setSources] = useState<DealSource[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DealSource | null>(null)

  // Варианты открываются в отдельной модалке — здесь храним какой источник
  // сейчас открыт (null = закрыто) и мапу загруженных вариантов (lazy).
  const [variantsModalSource, setVariantsModalSource] = useState<DealSource | null>(null)
  const [variantsBySource, setVariantsBySource] = useState<Map<number, SourceVariant[]>>(new Map())
  const [variantsLoading, setVariantsLoading] = useState<Set<number>>(new Set())
  const [newVariantName, setNewVariantName] = useState<Map<number, string>>(new Map())
  const [variantDeleteTarget, setVariantDeleteTarget] = useState<SourceVariant | null>(null)
  const [variantEditTarget, setVariantEditTarget] = useState<SourceVariant | null>(null)
  const [variantEditName, setVariantEditName] = useState("")

  // Прячем admin header когда открыта панель вариантов.
  useEffect(() => {
    setHideHeader(Boolean(variantsModalSource))
    return () => setHideHeader(false)
  }, [variantsModalSource, setHideHeader])

  const load = useCallback(() => {
    setLoading(true)
    crmGet<{ sources: DealSource[] }>("/api/admin/deal-sources")
      .then((res) => setSources(res.sources || []))
      .catch((e) =>
        toast({
          variant: "destructive",
          title: "Не удалось загрузить источники",
          description: e?.message,
        }),
      )
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sort_order: (sources.at(-1)?.sort_order ?? -1) + 1 })
    setEditorOpen(true)
  }
  const openEdit = (s: DealSource) => {
    setForm({
      id: s.id,
      name: s.name,
      color: s.color || "#64748b",
      sort_order: s.sort_order,
      is_active: s.is_active,
    })
    setEditorOpen(true)
  }

  const handleSubmit = async () => {
    const name = form.name.trim()
    if (!name) {
      toast({ variant: "destructive", title: "Название обязательно" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name,
        color: form.color,
        sort_order: form.sort_order,
        is_active: form.is_active,
      }
      if (form.id == null) {
        await crmPost("/api/admin/deal-sources", payload)
        toast({ title: "Источник создан" })
      } else {
        await crmPut(`/api/admin/deal-sources/${form.id}`, payload)
        toast({ title: "Источник обновлён" })
      }
      setEditorOpen(false)
      load()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось сохранить",
        description: e?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (s: DealSource) => {
    try {
      const r = await crmPut<{ source: DealSource }>(
        `/api/admin/deal-sources/${s.id}`,
        { is_active: !s.is_active },
      )
      setSources((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, is_active: r.source.is_active } : x)),
      )
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось переключить",
        description: e?.message,
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await crmDelete(`/api/admin/deal-sources/${deleteTarget.id}`)
      toast({ title: "Источник удалён" })
      setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id))
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  // ─── Варианты (DealSourceVariant) ──────────────────────────────────

  const loadVariants = useCallback(async (sid: number) => {
    setVariantsLoading((prev) => new Set(prev).add(sid))
    try {
      const res = await crmGet<{ variants: SourceVariant[] }>(
        `/api/admin/deal-sources/${sid}/variants`,
      )
      setVariantsBySource((prev) => {
        const next = new Map(prev)
        next.set(sid, res.variants || [])
        return next
      })
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось загрузить варианты",
        description: e?.message,
      })
    } finally {
      setVariantsLoading((prev) => {
        const next = new Set(prev)
        next.delete(sid)
        return next
      })
    }
  }, [toast])

  const openVariants = (s: DealSource) => {
    setVariantsModalSource(s)
    if (!variantsBySource.has(s.id)) void loadVariants(s.id)
  }

  // DnD-сортировка карточек. Переставляем локально + шлём пачку
  // {id, sort_order} на бэк. На ошибке — откатываем визуально.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const prev = [...sources]
    const fromIdx = prev.findIndex((s) => s.id === Number(active.id))
    const toIdx = prev.findIndex((s) => s.id === Number(over.id))
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...prev]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    // Переопределим sort_order по новому порядку (0..N).
    const reindexed = next.map((s, i) => ({ ...s, sort_order: i }))
    setSources(reindexed)
    try {
      await crmPost(
        "/api/admin/deal-sources/reorder",
        reindexed.map((s) => ({ id: s.id, sort_order: s.sort_order })),
      )
    } catch (e: any) {
      setSources(prev)
      toast({
        variant: "destructive",
        title: "Не удалось сохранить порядок",
        description: e?.message,
      })
    }
  }

  const handleCreateVariant = async (sid: number) => {
    const name = (newVariantName.get(sid) || "").trim()
    if (!name) return
    try {
      const res = await crmPost<{ variant: SourceVariant }>(
        `/api/admin/deal-sources/${sid}/variants`,
        { name },
      )
      setVariantsBySource((prev) => {
        const next = new Map(prev)
        const list = next.get(sid) || []
        next.set(sid, [...list, res.variant])
        return next
      })
      setNewVariantName((prev) => {
        const next = new Map(prev)
        next.set(sid, "")
        return next
      })
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось создать вариант",
        description: e?.message,
      })
    }
  }

  const handleUpdateVariant = async () => {
    if (!variantEditTarget) return
    const name = variantEditName.trim()
    if (!name || name === variantEditTarget.name) {
      setVariantEditTarget(null)
      return
    }
    try {
      const res = await crmPut<{ variant: SourceVariant }>(
        `/api/admin/deal-source-variants/${variantEditTarget.id}`,
        { name },
      )
      setVariantsBySource((prev) => {
        const next = new Map(prev)
        const list = next.get(variantEditTarget.parent_source_id) || []
        next.set(
          variantEditTarget.parent_source_id,
          list.map((v) => v.id === res.variant.id ? res.variant : v),
        )
        return next
      })
      setVariantEditTarget(null)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось обновить вариант",
        description: e?.message,
      })
    }
  }

  const handleDeleteVariant = async () => {
    if (!variantDeleteTarget) return
    try {
      await crmDelete(`/api/admin/deal-source-variants/${variantDeleteTarget.id}`)
      setVariantsBySource((prev) => {
        const next = new Map(prev)
        const list = next.get(variantDeleteTarget.parent_source_id) || []
        next.set(
          variantDeleteTarget.parent_source_id,
          list.filter((v) => v.id !== variantDeleteTarget.id),
        )
        return next
      })
      setVariantDeleteTarget(null)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить вариант",
        description: e?.message,
      })
    }
  }

  if (user && !canManage) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className={cn(
      "space-y-4",
      // В режиме панели вариантов берём всю оставшуюся высоту viewport'а и
      // прячем общий скролл — скроллятся только внутренние колонки сетки.
      variantsModalSource && "lg:h-[calc(100vh-200px)] lg:flex lg:flex-col lg:overflow-hidden",
    )}>
      {!variantsModalSource && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
              <Signpost className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight">Источники сделок</h1>
              <p className="text-sm text-gray-500">
                Откуда пришла сделка — Instagram, 2GIS, холодный звонок и т.д.
              </p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="bg-brand-yellow text-black hover:bg-yellow-500 rounded-full"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Новый источник
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : sources.length === 0 ? (
        <Card className="rounded-xl border-gray-200 p-10 text-center text-sm text-gray-500">
          Источников пока нет. Создайте первый — например «Instagram» или «2GIS».
        </Card>
      ) : (
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sources.map((s) => s.id)}
            strategy={rectSortingStrategy}
          >
            {variantsModalSource ? (
              // Split-layout: слева одна колонка карточек со скроллом,
              // справа — панель вариантов выбранного источника.
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-4 w-full min-w-0 lg:flex-1 lg:min-h-0">
                <div className="space-y-2 lg:h-full lg:overflow-y-auto pr-1 min-w-0">
                  {sources.map((s) => (
                    <SortableSourceCard
                      key={s.id}
                      source={s}
                      variantsCount={
                        variantsBySource.has(s.id)
                          ? (variantsBySource.get(s.id) || []).length
                          : (s.variants_count ?? 0)
                      }
                      selected={s.id === variantsModalSource.id}
                      onEdit={() => openEdit(s)}
                      onDelete={() => setDeleteTarget(s)}
                      onToggleActive={() => toggleActive(s)}
                      onOpenVariants={() => openVariants(s)}
                    />
                  ))}
                </div>
                <VariantsPanel
                  source={variantsModalSource}
                  variants={variantsBySource.get(variantsModalSource.id) || []}
                  loading={variantsLoading.has(variantsModalSource.id)}
                  newName={newVariantName.get(variantsModalSource.id) || ""}
                  onNewNameChange={(v) =>
                    setNewVariantName((prev) => {
                      const next = new Map(prev)
                      next.set(variantsModalSource.id, v)
                      return next
                    })
                  }
                  onCreate={() => handleCreateVariant(variantsModalSource.id)}
                  onEdit={(v) => { setVariantEditTarget(v); setVariantEditName(v.name) }}
                  onDelete={(v) => setVariantDeleteTarget(v)}
                  onClose={() => setVariantsModalSource(null)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sources.map((s) => (
                  <SortableSourceCard
                    key={s.id}
                    source={s}
                    variantsCount={
                      variantsBySource.has(s.id)
                        ? (variantsBySource.get(s.id) || []).length
                        : (s.variants_count ?? 0)
                    }
                    onEdit={() => openEdit(s)}
                    onDelete={() => setDeleteTarget(s)}
                    onToggleActive={() => toggleActive(s)}
                    onOpenVariants={() => openVariants(s)}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id == null ? "Новый источник" : "Источник"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Название *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Например: Instagram"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Цвет чипа</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-lg"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: form.color }}
                    />
                    {form.color}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="grid grid-cols-5 gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        className={cn(
                          "h-7 w-7 rounded-full border-2 transition-all",
                          form.color === c
                            ? "border-black shadow-md scale-110"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить источник?</AlertDialogTitle>
            <AlertDialogDescription>
              Сделки, у которых стоял этот источник, получат «пусто» (данные
              не удаляются, просто отвязываются). Это нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Переименование варианта (DealSourceVariant). */}
      <Dialog
        open={Boolean(variantEditTarget)}
        onOpenChange={(v) => !v && setVariantEditTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Переименовать вариант</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Название *</Label>
            <Input
              autoFocus
              value={variantEditName}
              onChange={(e) => setVariantEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleUpdateVariant()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantEditTarget(null)}>
              Отмена
            </Button>
            <Button
              onClick={handleUpdateVariant}
              disabled={!variantEditName.trim()}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Удаление варианта. */}
      <AlertDialog
        open={Boolean(variantDeleteTarget)}
        onOpenChange={(v) => !v && setVariantDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вариант?</AlertDialogTitle>
            <AlertDialogDescription>
              Сделки, у которых стоял этот вариант, получат «пусто» в поле
              «Доп. об источнике» (сам источник остаётся). Отменить нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVariant}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}


// ===========================================================================
// VariantsPanel — правая панель со списком вариантов выбранного источника.
// ===========================================================================

function VariantsPanel({
  source,
  variants,
  loading,
  newName,
  onNewNameChange,
  onCreate,
  onEdit,
  onDelete,
  onClose,
}: {
  source: DealSource
  variants: SourceVariant[]
  loading: boolean
  newName: string
  onNewNameChange: (v: string) => void
  onCreate: () => void
  onEdit: (v: SourceVariant) => void
  onDelete: (v: SourceVariant) => void
  onClose: () => void
}) {
  return (
    <Card className="p-4 flex flex-col gap-3 rounded-xl border-gray-200 min-w-0 overflow-hidden lg:h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-3.5 w-3.5 rounded-full border border-gray-200 shrink-0"
            style={{ backgroundColor: source.color || "#e5e7eb" }}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{source.name}</div>
            <div className="text-xs text-gray-500">Варианты «Доп. об источнике»</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 rounded-full text-gray-500 hover:text-gray-900"
          title="Закрыть, вернуться к сетке"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="text-xs text-gray-400 py-2 text-center">
            Загрузка вариантов…
          </div>
        ) : variants.length === 0 ? (
          <div className="text-xs text-gray-400 py-3 text-center">
            Вариантов пока нет
          </div>
        ) : (
          <ul className="space-y-1">
            {variants.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 text-sm py-1 pr-1 pl-2 rounded hover:bg-gray-50"
              >
                <span className="text-gray-400">→</span>
                <span className="flex-1 min-w-0 truncate" title={v.name}>
                  {v.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(v)}
                  className="h-7 w-7 rounded-full text-gray-500 hover:text-gray-900"
                  title="Переименовать"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(v)}
                  className="h-7 w-7 rounded-full text-red-500 hover:bg-red-50"
                  title="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <Input
          placeholder="Новый вариант — название"
          value={newName}
          onChange={(e) => onNewNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onCreate()
            }
          }}
          className="h-9 text-sm"
        />
        <Button
          type="button"
          size="sm"
          onClick={onCreate}
          disabled={!newName.trim()}
          className="h-9 shrink-0 bg-brand-yellow text-black hover:bg-yellow-500"
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </div>
    </Card>
  )
}


// ===========================================================================
// SortableSourceCard — одна карточка источника в grid (с drag-handle).
// ===========================================================================

function SortableSourceCard({
  source,
  variantsCount,
  selected,
  onEdit,
  onDelete,
  onToggleActive,
  onOpenVariants,
}: {
  source: DealSource
  variantsCount: number
  selected?: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  onOpenVariants: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: source.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <Card className={cn(
        "p-3 rounded-xl border bg-white flex flex-col gap-2.5",
        selected ? "border-brand-yellow ring-1 ring-brand-yellow" : "border-gray-200",
        isDragging && "shadow-lg",
      )}>
        <div className="flex items-start gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="h-6 w-5 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
            title="Перетащить"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span
            className="h-3.5 w-3.5 rounded-full shrink-0 border border-gray-200 mt-1"
            style={{ backgroundColor: source.color || "#e5e7eb" }}
          />
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-sm font-medium truncate",
                !source.is_active && "text-gray-400 line-through",
              )}
              title={source.name}
            >
              {source.name}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenVariants}
          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 rounded px-1 self-start"
          title="Варианты «Доп. об источнике»"
        >
          <Layers className="h-3.5 w-3.5" />
          Варианты: {variantsCount}
        </button>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5 min-w-0">
            <Switch
              checked={source.is_active}
              onCheckedChange={onToggleActive}
            />
            <span className="text-xs text-gray-500">
              {source.is_active ? "активен" : "выкл"}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-900"
              title="Редактировать"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
              title="Удалить"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
