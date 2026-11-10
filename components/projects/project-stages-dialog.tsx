"use client"

/**
 * Модалка настройки колонок канбана проекта: добавить, переименовать,
 * сменить цвет, выбрать соответствие глобальному статусу
 * (`maps_to_status`), удалить. Перетаскивание порядка — через стрелки
 * (DnD здесь переизбыток).
 *
 * Все правки идут отдельными PUT/POST/DELETE и обновляют ЛОКАЛЬНЫЙ
 * draft по ответу сервера. Parent (`onChanged`) дёргаем ТОЛЬКО при
 * закрытии модалки — иначе каждый PUT перезагружал бы `stages` prop,
 * `useEffect` сбрасывал бы draft, и несохранённые правки в соседних
 * input'ах терялись бы (видно было: при добавлении новой колонки
 * слетали названия уже введённых, но ещё не ушедших в blur).
 */

import { useEffect, useRef, useState } from "react"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"
import {
  type ProjectStage, type TaskStageStatus, STAGE_STATUS_META,
} from "@/lib/projects-types"

const STATUS_OPTIONS: TaskStageStatus[] = [
  "pending", "in_progress", "waiting_check", "done", "paused",
]

// Пресеты — те же что в стадиях сделок (pipelines-manager → COLOR_PRESETS),
// чтобы визуально проект и сделка смотрелись как одна система.
const COLOR_PRESETS: string[] = [
  "#94a3b8", "#6b7280", "#ef4444", "#fb7185", "#f97316",
  "#f59e0b", "#eab308", "#facc15", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
]

export default function ProjectStagesDialog({
  projectId, stages, open, onOpenChange, onChanged,
}: {
  projectId: number
  stages: ProjectStage[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<ProjectStage[]>(stages)
  // Флаг «за время жизни модалки что-то реально изменилось» → только
  // тогда дёрнем onChanged() при закрытии.
  const dirtyRef = useRef(false)
  // Id колонки, которую юзер подтверждает удалить. null → модалка закрыта.
  // Браузерный confirm() заменён на AlertDialog ради единого стиля
  // (нативный диалог Chrome в другом шрифте и цветах).
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  // Что сейчас реально сохранено на сервере для каждого stage.id —
  // нужно отдельно от draft, чтобы в onBlur сравнить «текущий ввод» с
  // «последним сохранённым». Если сравнивать с `draft.name`, условие
  // всегда True (потому что onChange уже успел обновить draft) → PUT
  // не отправляется и имя не сохраняется. Было бы симптомом: в БД
  // остаются «Новая колонка» навсегда.
  const savedNamesRef = useRef<Map<number, string>>(new Map())

  // Синхронизируем draft с parent-ом ТОЛЬКО по факту открытия модалки
  // (не на каждое изменение stages). Иначе фоновый onChanged() от
  // другой части страницы мог бы снести локальные правки.
  useEffect(() => {
    if (open) {
      setDraft(stages)
      savedNamesRef.current = new Map(stages.map((s) => [s.id, s.name]))
      dirtyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sorted = [...draft].sort((a, b) => a.sort_order - b.sort_order)

  const commitUpdate = async (sid: number, patch: Partial<ProjectStage>) => {
    try {
      await crmPut(
        `/api/admin/projects/${projectId}/stages/${sid}`, patch,
      )
      dirtyRef.current = true
      // ВАЖНО: мерджим только patch, а не ответ сервера. Если юзер
      // параллельно правит `name` в input'е и ещё не blur'нул, а потом
      // в том же ряду меняет maps_to_status — `res.stage.name` придёт
      // старым (из БД), и мы бы затёрли локально введённое имя. Берём
      // ТОЛЬКО то, что реально отправили.
      setDraft((prev) => prev.map((x) => x.id === sid ? { ...x, ...patch } : x))
      if (patch.name !== undefined) {
        savedNamesRef.current.set(sid, patch.name as string)
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message })
    }
  }

  const handleAdd = async () => {
    try {
      const res = await crmPost<{ stage: ProjectStage }>(
        `/api/admin/projects/${projectId}/stages`,
        { name: "Новая колонка", color: "#94a3b8" },
      )
      dirtyRef.current = true
      if (res?.stage) {
        setDraft((prev) => [...prev, res.stage])
        savedNamesRef.current.set(res.stage.id, res.stage.name)
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message })
    }
  }

  const performDelete = async (sid: number) => {
    try {
      await crmDelete(`/api/admin/projects/${projectId}/stages/${sid}`)
      dirtyRef.current = true
      setDraft((prev) => prev.filter((x) => x.id !== sid))
      savedNamesRef.current.delete(sid)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message })
    } finally {
      setConfirmDeleteId(null)
    }
  }

  const move = async (sid: number, dir: -1 | 1) => {
    const idx = sorted.findIndex((s) => s.id === sid)
    if (idx < 0) return
    const neighbour = sorted[idx + dir]
    if (!neighbour) return
    const order = [...sorted]
    order[idx] = neighbour
    order[idx + dir] = sorted[idx]
    try {
      await crmPost(`/api/admin/projects/${projectId}/stages/reorder`, {
        order: order.map((s) => s.id),
      })
      dirtyRef.current = true
      // Перепишем sort_order в draft соответственно новому порядку.
      setDraft((prev) => prev.map((x) => {
        const newIdx = order.findIndex((o) => o.id === x.id)
        return newIdx >= 0 ? { ...x, sort_order: newIdx } : x
      }))
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message })
    }
  }

  const handleClose = (v: boolean) => {
    if (!v && dirtyRef.current) {
      onChanged()
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Колонки канбана</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {sorted.map((s, idx) => (
            <div
              key={s.id}
              className="flex items-center gap-2 border border-gray-200 rounded-lg p-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(s.id, -1)}
                  disabled={idx === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(s.id, +1)}
                  disabled={idx === sorted.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <StageColorPicker
                value={s.color}
                onChange={(v) => {
                  setDraft((prev) => prev.map((x) => x.id === s.id ? { ...x, color: v } : x))
                  commitUpdate(s.id, { color: v })
                }}
              />
              <Input
                value={s.name}
                onChange={(e) => setDraft((prev) =>
                  prev.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x),
                )}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  const saved = savedNamesRef.current.get(s.id) ?? ""
                  if (!next) {
                    // Пустое имя сервер не примет — откатываем в последнее
                    // сохранённое имя (НЕ в s.name — то уже обновилось
                    // через onChange и тоже пустое).
                    setDraft((prev) => prev.map((x) =>
                      x.id === s.id ? { ...x, name: saved } : x,
                    ))
                    return
                  }
                  // Сравниваем с «сохранённым», а не с draft.name — иначе
                  // условие всегда ложно (onChange уже обновил draft).
                  if (next !== saved) commitUpdate(s.id, { name: next })
                }}
                className="h-8 text-sm flex-1"
              />
              <Select
                value={s.maps_to_status}
                onValueChange={(v) => {
                  setDraft((prev) => prev.map((x) =>
                    x.id === s.id ? { ...x, maps_to_status: v as TaskStageStatus } : x,
                  ))
                  commitUpdate(s.id, { maps_to_status: v as TaskStageStatus })
                }}
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((st) => {
                    const meta = STAGE_STATUS_META[st]
                    return (
                      <SelectItem key={st} value={st}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                          {meta.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmDeleteId(s.id)}
                className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="text-xs text-gray-400 italic text-center py-4">
              Колонок нет. Добавь первую.
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button onClick={handleAdd} variant="outline" className="rounded-lg">
            <Plus className="h-4 w-4 mr-1.5" />
            Добавить колонку
          </Button>
          <Button onClick={() => handleClose(false)} className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500">
            Готово
          </Button>
        </DialogFooter>

        <AlertDialog
          open={confirmDeleteId !== null}
          onOpenChange={(v) => { if (!v) setConfirmDeleteId(null) }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить колонку?</AlertDialogTitle>
              <AlertDialogDescription>
                Задачи, которые были в этой колонке, останутся в проекте
                без привязки к колонке. Их можно будет перенести в другую
                колонку вручную.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmDeleteId !== null) performDelete(confirmDeleteId)
                }}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}

// Палитра пресетов + свой цвет. Полностью совпадает с таким же в
// pipelines-manager.tsx (стадии сделок) — одинаковый UX в двух местах,
// где юзер настраивает колонки канбана.
function StageColorPicker({
  value, onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 shrink-0 rounded border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer"
          style={{ backgroundColor: value }}
          title="Цвет колонки"
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Палитра
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_PRESETS.map((c) => {
            const active = c.toLowerCase() === (value || "").toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={cn(
                  "h-7 w-7 rounded transition-transform",
                  "border border-black/5 hover:scale-110",
                  active && "scale-110",
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Свой цвет
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-12 rounded cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
              }}
              className="flex-1 h-8 rounded border border-gray-200 px-2 text-xs font-mono uppercase focus:outline-none focus:border-gray-400"
              placeholder="#000000"
              maxLength={7}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
