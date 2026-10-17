"use client"

/**
 * Чек-листы задачи с группировкой по `group_name`.
 *
 * UX-модель:
 *  • В карточке — компактный вид с группами. Каждая группа
 *    сворачиваемая (chevron слева), у каждой — прогресс-бар и
 *    кнопка карандашика для редактирования.
 *  • Всё редактирование (переименовать группу, добавить/удалить/
 *    изменить пункты) — в отдельной модалке `GroupEditor`.
 *  • Создание нового списка — та же модалка, только пустая.
 *  • Пункт с `group_name = null` (устаревшие, если такие были) UI
 *    показывает под шапкой «Общее». Через модалку тоже редактируется.
 *
 * Бэк:
 *   POST /api/admin/tasks/<id>/checklist          {text, group_name}
 *   PUT  /api/admin/tasks/<id>/checklist/<iid>    {text? done? group_name?}
 *   DELETE /api/admin/tasks/<id>/checklist/<iid>
 */

import { useEffect, useMemo, useState } from "react"
import {
  Plus, ListChecks, Trash2, Pencil, Check, X, ChevronDown, Link2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import type { TaskChecklistItem } from "@/lib/tasks-types"

const UNGROUPED_KEY = "__ungrouped__"

interface Props {
  taskId: number
  checklist: TaskChecklistItem[]
  onChange: () => void
}

export default function TaskChecklistCard({
  taskId, checklist, onChange,
}: Props) {
  const { toast } = useToast()
  const [editorOpen, setEditorOpen] = useState<null | "new" | string>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, TaskChecklistItem[]>()
    for (const item of checklist) {
      const key = item.group_name ?? UNGROUPED_KEY
      if (!map.has(key)) { map.set(key, []); order.push(key) }
      map.get(key)!.push(item)
    }
    const idx = order.indexOf(UNGROUPED_KEY)
    if (idx >= 0 && idx < order.length - 1) {
      order.splice(idx, 1); order.push(UNGROUPED_KEY)
    }
    return order.map((k) => ({
      key: k,
      name: k === UNGROUPED_KEY ? "Общее" : k,
      items: map.get(k)!,
    }))
  }, [checklist])

  /**
   * Множество имён групп, у которых ВСЕ пункты выполнены (100%).
   * Используется как справочник для вычисления «эффективного done»
   * пунктов-ссылок: если пункт ссылается на завершённую группу — он
   * визуально показывается как выполненный.
   */
  const doneGroupNames = useMemo(() => {
    const s = new Set<string>()
    for (const g of groups) {
      if (g.key === UNGROUPED_KEY) continue // общая — не именованная, нельзя ссылаться
      if (g.items.length > 0 && g.items.every((i) => i.done)) s.add(g.name)
    }
    return s
  }, [groups])

  const isEffectivelyDone = (item: TaskChecklistItem): boolean => {
    if (item.done) return true
    if (item.depends_on_group && doneGroupNames.has(item.depends_on_group)) return true
    return false
  }

  const total = checklist.length
  const done = checklist.filter(isEffectivelyDone).length

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const s = new Set(prev)
      if (s.has(key)) s.delete(key); else s.add(key)
      return s
    })
  }

  const handleToggle = async (item: TaskChecklistItem) => {
    try {
      await crmPut(`/api/admin/tasks/${taskId}/checklist/${item.id}`, {
        done: !item.done,
      })
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось обновить",
        description: e?.message,
      })
    }
  }

  // Данные для модалки, определяются по режиму open.
  const editorGroup = useMemo(() => {
    if (editorOpen == null || editorOpen === "new") return null
    return groups.find((g) => g.name === editorOpen) ?? null
  }, [editorOpen, groups])

  return (
    <Card className="rounded-xl border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700">Чек-листы</h2>
          {total > 0 && (
            <span className="text-[11px] text-gray-500 tabular-nums">
              {done}/{total}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditorOpen("new")}
          className="text-[11px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-0.5 focus:outline-none"
        >
          <Plus className="h-3 w-3" /> новый список
        </button>
      </div>

      {total > 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-yellow transition-all"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-xs text-gray-400 italic text-center py-3">
          Чек-листов пока нет. Создайте первый.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const gDone = g.items.filter(isEffectivelyDone).length
            const gTotal = g.items.length
            const isCollapsed = collapsed.has(g.key)
            return (
              <div key={g.key} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50/60">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.key)}
                    className="p-0.5 rounded hover:bg-gray-200 focus:outline-none"
                    title={isCollapsed ? "Развернуть" : "Свернуть"}
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-gray-500 transition-transform",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                  </button>
                  <ListChecks className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <div className="text-[12px] font-medium text-gray-800 truncate flex-1">
                    {g.name}
                  </div>
                  <div className="text-[10px] text-gray-500 tabular-nums shrink-0">
                    {gDone}/{gTotal}
                  </div>
                  <div className="h-1 w-16 bg-gray-200 rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: gTotal ? `${Math.round((gDone / gTotal) * 100)}%` : "0%" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(g.name)}
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-500 focus:outline-none shrink-0"
                    title="Редактировать список"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                {!isCollapsed && (
                  <ul className="py-1 px-2 space-y-0.5">
                    {g.items.map((item) => {
                      // Пункт-ссылка на другой чек-лист: если тот
                      // завершён на 100 % — пункт визуально помечается
                      // выполненным (line-through + галка), но
                      // «настоящий» done в БД мы не меняем.
                      const byRef = Boolean(
                        item.depends_on_group && doneGroupNames.has(item.depends_on_group),
                      )
                      const effDone = item.done || byRef
                      return (
                        <li key={item.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={effDone}
                            disabled={byRef && !item.done}
                            onChange={() => !byRef && handleToggle(item)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-yellow focus:ring-brand-yellow mt-1 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span
                            className={cn(
                              "flex-1",
                              effDone && "line-through text-gray-400",
                            )}
                            title={
                              byRef
                                ? `Автовыполнен: чек-лист «${item.depends_on_group}» завершён`
                                : undefined
                            }
                          >
                            {item.text}
                            {item.depends_on_group && !byRef && (
                              <span className="ml-1.5 text-[10px] text-gray-400 inline-flex items-center gap-0.5">
                                <Link2 className="h-2.5 w-2.5" />
                                {item.depends_on_group}
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      <GroupEditor
        taskId={taskId}
        open={editorOpen !== null}
        onClose={() => setEditorOpen(null)}
        // Режим создания — пустая группа с plain-name (юзер задаст).
        // Редактирование — прокидываем текущую группу и все её пункты.
        initialName={editorGroup ? (editorGroup.key === UNGROUPED_KEY ? "" : editorGroup.name) : ""}
        initialItems={editorGroup ? editorGroup.items : []}
        // Все существующие named-группы для выпадашки «зависит от».
        // Исключаем «Общее» (нельзя ссылаться на пункты без группы) и
        // саму себя (чтобы не создать петлю).
        availableGroups={groups
          .filter((g) => g.key !== UNGROUPED_KEY)
          .map((g) => g.name)
          .filter((n) => n !== (editorGroup?.name ?? ""))}
        onDirty={onChange}
      />
    </Card>
  )
}

// ============================================================================

interface DraftItem {
  /**
   * `id`:
   *   number  — уже существующий пункт (сохранён на бэке)
   *   string  — новый пункт, ещё не отправлен
   */
  id: number | string
  text: string
  done: boolean
  /** Имя группы, от которой зависит этот пункт (см. TaskChecklistItem). */
  depends_on_group: string | null
  toDelete?: boolean
}

/**
 * Модалка редактирования одного чек-листа (группы). Работает не live,
 * а «через сохранить»: юзер меняет всё локально, кнопка «Сохранить»
 * применяет diff одним пакетом POST/PUT/DELETE.
 */
function GroupEditor({
  taskId,
  open,
  onClose,
  initialName,
  initialItems,
  availableGroups,
  onDirty,
}: {
  taskId: number
  open: boolean
  onClose: () => void
  initialName: string
  initialItems: TaskChecklistItem[]
  /** Список чужих чек-листов, на которые может ссылаться каждый пункт. */
  availableGroups: string[]
  onDirty: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(initialName)
  const [items, setItems] = useState<DraftItem[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)

  // Сброс при каждом открытии.
  useEffect(() => {
    if (!open) return
    setName(initialName)
    setItems(initialItems.map((i) => ({
      id: i.id,
      text: i.text,
      done: i.done,
      depends_on_group: i.depends_on_group,
    })))
    setConfirmWipe(false)
  }, [open, initialName, initialItems])

  const isNew = initialItems.length === 0 && initialName === ""

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        text: "", done: false, depends_on_group: null,
      },
    ])
  }
  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  const removeItem = (idx: number) => {
    setItems((prev) => {
      const it = prev[idx]
      // Существующий пункт — помечаем на удаление, при сохранении DELETE.
      // Новый (id = string) — просто выкидываем.
      if (typeof it.id === "string") {
        return prev.filter((_, i) => i !== idx)
      }
      return prev.map((x, i) => i === idx ? { ...x, toDelete: true } : x)
    })
  }
  const visibleItems = items.filter((i) => !i.toDelete)

  const handleSave = async () => {
    const groupName = name.trim() || null
    setSaving(true)
    // Считаем diff. Порядок операций: удаления, потом обновления, потом
    // создания — так у нового пункта не будет коллизии по названию с
    // удаляемым.
    try {
      const toDelete = items.filter((i) => i.toDelete && typeof i.id === "number")
      const toCreate = items.filter((i) => typeof i.id === "string" && !i.toDelete && i.text.trim())
      const toUpdate = items.filter((i) => {
        if (typeof i.id !== "number" || i.toDelete) return false
        const orig = initialItems.find((o) => o.id === i.id)
        if (!orig) return false
        return (
          orig.text !== i.text.trim() ||
          orig.done !== i.done ||
          (orig.group_name ?? null) !== groupName ||
          (orig.depends_on_group ?? null) !== (i.depends_on_group ?? null)
        )
      })

      for (const it of toDelete) {
        await crmDelete(`/api/admin/tasks/${taskId}/checklist/${it.id}`)
      }
      for (const it of toUpdate) {
        await crmPut(`/api/admin/tasks/${taskId}/checklist/${it.id}`, {
          text: it.text.trim(),
          done: it.done,
          group_name: groupName,
          depends_on_group: it.depends_on_group,
        })
      }
      for (const it of toCreate) {
        await crmPost(`/api/admin/tasks/${taskId}/checklist`, {
          text: it.text.trim(),
          group_name: groupName,
          depends_on_group: it.depends_on_group,
        })
      }

      toast({ title: "Сохранено" })
      onDirty()
      onClose()
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

  const handleWipe = async () => {
    // Удаление всего списка = удалить все существующие пункты этой
    // группы. Модалка закрывается, родитель делает refetch.
    setSaving(true)
    try {
      for (const it of initialItems) {
        await crmDelete(`/api/admin/tasks/${taskId}/checklist/${it.id}`)
      }
      toast({ title: "Список удалён" })
      onDirty()
      onClose()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    } finally {
      setSaving(false)
      setConfirmWipe(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Новый чек-лист" : "Редактирование списка"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">
                Название
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например «Астана» (можно оставить пустым — тогда «Общее»)"
                autoFocus={isNew}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-gray-500">
                  Пункты
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-[11px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-0.5 focus:outline-none"
                >
                  <Plus className="h-3 w-3" /> пункт
                </button>
              </div>

              {visibleItems.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-3 text-center">
                  Пунктов пока нет. Добавьте первый.
                </div>
              ) : (
                // `py-1 px-0.5` — запас чтобы focus-ring Input'а не резался
                // краем overflow-y-auto. Тесно расположенные Input'ы иначе
                // обрезаются сверху/снизу при фокусе.
                <ul className="space-y-2 max-h-[50vh] overflow-y-auto py-1 px-0.5">
                  {items.map((it, idx) => {
                    if (it.toDelete) return null
                    return (
                      <li key={String(it.id)} className="space-y-1">
                       <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={it.done}
                          onChange={(e) => updateItem(idx, { done: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-brand-yellow focus:ring-brand-yellow shrink-0 cursor-pointer"
                        />
                        <Input
                          value={it.text}
                          onChange={(e) => updateItem(idx, { text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); addItem() }
                          }}
                          placeholder="Текст пункта"
                          className="h-8 text-sm"
                          autoFocus={typeof it.id === "string" && it.text === ""}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600 focus:outline-none p-1 shrink-0"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                       </div>
                       {availableGroups.length > 0 && (
                         <div className="flex items-center gap-1 pl-6">
                           <Link2 className="h-3 w-3 text-gray-400 shrink-0" />
                           <span className="text-[10px] text-gray-500 shrink-0">
                             ссылка на:
                           </span>
                           <select
                             value={it.depends_on_group ?? ""}
                             onChange={(e) => updateItem(idx, {
                               depends_on_group: e.target.value || null,
                             })}
                             className="text-[11px] rounded border border-gray-200 bg-white px-1.5 py-0.5 focus:outline-none focus:ring-0 focus:border-brand-yellow max-w-[220px]"
                           >
                             <option value="">— нет —</option>
                             {availableGroups.map((n) => (
                               <option key={n} value={n}>{n}</option>
                             ))}
                           </select>
                         </div>
                       )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {!isNew && (
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="text-[11px] text-red-500 hover:text-red-700 inline-flex items-center gap-0.5 focus:outline-none"
              >
                <Trash2 className="h-3 w-3" /> Удалить весь список
              </button>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Check className="h-4 w-4 mr-1.5 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить список целиком?</AlertDialogTitle>
            <AlertDialogDescription>
              Список «{initialName || "Общее"}» и все его пункты будут удалены.
              Отменить нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipe}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
