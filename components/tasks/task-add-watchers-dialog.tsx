"use client"

/**
 * Диалог «Добавить задачу в избранное другому участнику».
 *
 * Открывается с карточки задачи у тех, у кого в правах стоит
 * `can_see_all_tasks` (или owner/admin/system). В списке — только
 * участники самой задачи: постановщик, исполнитель, соисполнители,
 * наблюдатели.
 *
 * При подтверждении — POST /api/admin/tasks/<tid>/watch/batch, тело
 * `{ user_ids: [...] }`. Бэк ещё раз фильтрует по участникам, так что
 * здесь это просто UX.
 */

import { useEffect, useMemo, useState } from "react"
import { Loader2, Star } from "lucide-react"

import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { crmPost } from "@/lib/crm-fetch"
import type { TaskFull } from "@/lib/tasks-types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  task: TaskFull
  usersById: Map<number, string>
  /** Родитель перезагружает задачу чтобы обновить watcher_ids в UI. */
  onAdded?: (added: number) => void
}

interface Participant {
  user_id: number
  role: "creator" | "responsible" | "co-worker" | "observer"
  roleLabel: string
}

const ROLE_LABEL: Record<Participant["role"], string> = {
  creator: "Постановщик",
  responsible: "Исполнитель",
  "co-worker": "Соисполнитель",
  observer: "Наблюдатель",
}

export default function TaskAddWatchersDialog({
  open, onOpenChange, task, usersById, onAdded,
}: Props) {
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  // Исходный «кто уже отслеживает» — чтобы по сабмиту посчитать дельту:
  // кого добавить, у кого снять.
  const initialWatchers = useMemo(
    () => new Set(task.watcher_ids ?? []),
    [task.watcher_ids],
  )

  // Собираем всех причастных без дублей, с указанием роли.
  const participants: Participant[] = useMemo(() => {
    const seen = new Map<number, Participant>()
    const push = (uid: number | null | undefined, role: Participant["role"]) => {
      if (!uid || seen.has(uid)) return
      seen.set(uid, { user_id: uid, role, roleLabel: ROLE_LABEL[role] })
    }
    push(task.creator_id, "creator")
    push(task.responsible_id, "responsible")
    for (const m of task.members ?? []) {
      push(m.user_id, m.role)
    }
    return Array.from(seen.values())
  }, [task])

  // При открытии инициализируем выбор уже-отслеживающими — чекбоксы
  // сразу стоят у них, можно снимать и ставить галки свободно.
  useEffect(() => {
    if (open) setSelected(new Set(initialWatchers))
  }, [open, initialWatchers])

  const toggle = (uid: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  // Дельта: кого добавить и у кого снять по сравнению с initial.
  const toAdd = useMemo(
    () => Array.from(selected).filter((uid) => !initialWatchers.has(uid)),
    [selected, initialWatchers],
  )
  const toRemove = useMemo(
    () => Array.from(initialWatchers).filter((uid) => !selected.has(uid)),
    [selected, initialWatchers],
  )
  const diffSize = toAdd.length + toRemove.length

  const submit = async () => {
    if (diffSize === 0) return
    setSaving(true)
    try {
      const res = await crmPost<{ added: number; removed: number }>(
        `/api/admin/tasks/${task.id}/watch/batch`,
        { add: toAdd, remove: toRemove },
      )
      const added = res.added ?? 0
      const removed = res.removed ?? 0
      const parts: string[] = []
      if (added) parts.push(`добавлено: ${added}`)
      if (removed) parts.push(`снято: ${removed}`)
      toast({
        title: parts.length ? parts.join(", ") : "Без изменений",
      })
      onAdded?.(added + removed)
      onOpenChange(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить в избранное</DialogTitle>
          <DialogDescription>
            Выберите, кому из участников задачи добавить её в раздел
            «Отслеживаемые». В списке только те, кто уже привязан к
            задаче — постановщик, исполнитель, соисполнители и
            наблюдатели.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
          {participants.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              У задачи пока нет участников.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {participants.map((p) => {
                const name = usersById.get(p.user_id) ?? `#${p.user_id}`
                const wasWatching = initialWatchers.has(p.user_id)
                const checked = selected.has(p.user_id)
                return (
                  <li key={p.user_id}>
                    <label className="flex items-center gap-3 py-2.5 px-1 rounded cursor-pointer hover:bg-gray-50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(p.user_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {p.roleLabel}
                          {wasWatching && (
                            <span className="ml-1.5 text-brand-yellow font-medium">
                              · отслеживает
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-lg"
          >
            Отмена
          </Button>
          <Button
            onClick={submit}
            disabled={saving || diffSize === 0}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Star className="h-4 w-4 mr-1.5" />
            )}
            {diffSize === 0 ? "Применить" :
             toRemove.length === 0 ? `Добавить (${toAdd.length})` :
             toAdd.length === 0    ? `Снять (${toRemove.length})` :
             `Применить (+${toAdd.length} / −${toRemove.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
