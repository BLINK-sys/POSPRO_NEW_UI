"use client"

/**
 * Карточка задачи /admin/tasks/[id]. Full-width layout аналогично
 * сделке: три колонки.
 *
 *   ┌──── header (back / title / status / trash) ────┐
 *
 *   ┌── left (Info) ──┬── mid (Members/Checklist/Docs) ──┬── right (Chat) ──┐
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, Trash2, CheckCircle2, Circle, Clock,
  AlertCircle, PauseCircle, Briefcase, RotateCcw, Check, Save,
  Play, Pause, Send, CheckCheck, Undo2, Star, UserPlus,
  MessageSquare, ChevronUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Project } from "@/lib/projects-types"
import {
  STATUS_META,
  type TaskFull,
  type TaskStatus,
} from "@/lib/tasks-types"

import TaskInfoCard from "./task-info-card"
import TaskChecklistCard from "./task-checklist-card"
import TaskDocumentsCard from "./task-documents-card"
import TaskChatPanel from "./task-chat-panel"
import TaskAddWatchersDialog from "./task-add-watchers-dialog"

interface Props {
  taskId: number
}

interface Sys {
  id: number
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
}

interface DealLite {
  id: number
  name: string
}

const STATUS_ICONS: Record<TaskStatus, any> = {
  pending: Circle,
  in_progress: Clock,
  waiting_check: AlertCircle,
  done: CheckCircle2,
  paused: PauseCircle,
}

export default function TaskDetail({ taskId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const [task, setTask] = useState<TaskFull | null>(null)
  const [users, setUsers] = useState<Sys[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [deals, setDeals] = useState<DealLite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Чат по умолчанию свёрнут — освобождает место под описание,
  // чек-листы и документы. Юзер разворачивает по клику. Выбор
  // запоминаем в localStorage (per-browser), чтобы следующий заход
  // не возвращал в свёрнутое, если юзер предпочитает развёрнутый.
  const [chatCollapsed, setChatCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true
    try {
      const v = window.localStorage.getItem("task-chat-collapsed")
      return v === null ? true : v === "1"
    } catch { return true }
  })
  const toggleChat = useCallback(() => {
    setChatCollapsed((v) => {
      const next = !v
      try { window.localStorage.setItem("task-chat-collapsed", next ? "1" : "0") } catch {}
      return next
    })
  }, [])
  const [addWatchersOpen, setAddWatchersOpen] = useState(false)
  // Куда уходим после подтверждения выхода без сохранения. null = диалога нет.
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  // Инкрементим когда файл прилетел из чата — DocumentsCard видит это
  // через refreshKey и перечитывает список без reload страницы.
  const [docRefreshKey, setDocRefreshKey] = useState(0)

  const [draft, setDraft] = useState<Partial<TaskFull>>({})

  const reload = useCallback(async () => {
    const res = await crmGet<{ task: TaskFull }>(`/api/admin/tasks/${taskId}`)
    setTask(res.task)
  }, [taskId])

  useEffect(() => {
    let ignore = false
    setLoading(true)

    Promise.all([
      crmGet<{ task: TaskFull }>(`/api/admin/tasks/${taskId}`),
      crmGet<Sys[] | { users: Sys[] }>("/api/system-users").catch(() => []),
      crmGet<{ projects: Project[] }>("/api/admin/projects").catch(() => ({ projects: [] })),
      crmGet<{ deals: DealLite[] }>("/api/admin/deals?limit=200").catch(() => ({ deals: [] })),
    ])
      .then(([t, u, p, d]) => {
        if (ignore) return
        setTask(t.task)
        setDraft(makeDraft(t.task))
        const us = Array.isArray(u) ? u : (u as any).users || []
        setUsers(us)
        setProjects(p.projects || [])
        setDeals(d.deals || [])
      })
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить задачу",
          description: e?.message,
        })
      })
      .finally(() => { if (!ignore) setLoading(false) })

    return () => { ignore = true }
  }, [taskId, toast])

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, userDisplayName(u)])),
    [users],
  )

  const isDirty = useMemo(() => {
    if (!task) return false
    for (const k of Object.keys(draft) as (keyof TaskFull)[]) {
      if ((draft as any)[k] !== (task as any)[k]) return true
    }
    return false
  }, [draft, task])

  const handleSave = async () => {
    if (!task) return
    setSaving(true)
    try {
      const payload: Record<string, any> = {}
      for (const k of Object.keys(draft) as (keyof TaskFull)[]) {
        if ((draft as any)[k] !== (task as any)[k]) {
          payload[k as string] = (draft as any)[k]
        }
      }
      const res = await crmPut<{ task: TaskFull }>(
        `/api/admin/tasks/${task.id}`,
        payload,
      )
      setTask(res.task)
      setDraft(makeDraft(res.task))
      toast({ title: "Сохранено" })
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

  const handleStatusChange = async (status: TaskStatus) => {
    if (!task) return
    const prev = task.status
    setTask({ ...task, status })
    try {
      const res = await crmPost<{ task: TaskFull }>(
        `/api/admin/tasks/${task.id}/status`,
        { status },
      )
      setTask(res.task)
    } catch (e: any) {
      setTask({ ...task, status: prev })
      toast({
        variant: "destructive",
        title: "Не удалось сменить статус",
        description: e?.message,
      })
    }
  }

  const handleDelete = async () => {
    if (!task) return
    try {
      await crmDelete(`/api/admin/tasks/${task.id}`)
      toast({ title: "Задача удалена" })
      router.push("/admin/tasks")
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    }
  }

  const handleToggleWatch = async () => {
    if (!task || currentUserId == null) return
    const prev = Boolean(task.is_watched)
    const next = !prev
    // Оптимистично меняем звёздочку в state И список watcher_ids —
    // чтобы модалка «В избранное…» мгновенно знала про своего же
    // юзера. Откатываем при ошибке.
    setTask((t) => {
      if (!t) return t
      const ids = new Set(t.watcher_ids ?? [])
      if (next) ids.add(currentUserId)
      else      ids.delete(currentUserId)
      return { ...t, is_watched: next, watcher_ids: Array.from(ids) }
    })
    try {
      if (next) await crmPost(`/api/admin/tasks/${task.id}/watch`, {})
      else      await crmDelete(`/api/admin/tasks/${task.id}/watch`)
    } catch (e: any) {
      setTask((t) => {
        if (!t) return t
        const ids = new Set(t.watcher_ids ?? [])
        if (prev) ids.add(currentUserId)
        else      ids.delete(currentUserId)
        return { ...t, is_watched: prev, watcher_ids: Array.from(ids) }
      })
      toast({
        variant: "destructive",
        title: "Не удалось обновить отслеживание",
        description: e?.message,
      })
    }
  }

  // Предупреждение при закрытии/перезагрузке таба если есть изменения.
  // Навигация внутри приложения — через кнопку «К списку», она сама
  // открывает AlertDialog ниже.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!task) {
    return (
      <div className="text-center py-24 text-gray-500">Задача не найдена</div>
    )
  }

  const st = STATUS_META[task.status]
  const StatusIcon = STATUS_ICONS[task.status]
  const overdue =
    task.due_at &&
    task.status !== "done" &&
    new Date(task.due_at).getTime() < Date.now()

  // Кнопка «добавить в избранное другому участнику» — только для
  // владельца системы / админа / тех у кого стоит can_see_all_tasks.
  const canManageWatchers = Boolean(
    user?.is_owner ||
    user?.role === "admin" ||
    user?.role === "system" ||
    user?.can_see_all_tasks,
  )

  return (
    <div className="xl:flex xl:flex-col xl:h-[calc(100dvh-6rem)] space-y-2">
      {/* Шапка */}
      <Card className="rounded-xl border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] shrink-0">
        <div className="px-3 py-2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 px-2.5"
            onClick={() => {
              if (isDirty) setPendingNavigation("/admin/tasks")
              else router.push("/admin/tasks")
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            К списку
          </Button>

          <div className="min-w-0 max-w-[520px] shrink">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className={cn(
                "text-xs font-semibold leading-snug break-words line-clamp-2",
                task.status === "done" && "line-through text-gray-400",
              )}>
                {task.title}
              </h1>
              {task.status === "done" && (
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                  Завершена
                </span>
              )}
            </div>
            {(task.deal_ref || task.project_ref || overdue) && (
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                {task.deal_ref && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {task.deal_ref.name}
                  </span>
                )}
                {task.project_ref && (
                  <>
                    {task.deal_ref && <span>·</span>}
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: task.project_ref.color || "#94a3b8" }}
                      />
                      {task.project_ref.name}
                    </span>
                  </>
                )}
                {overdue && (
                  <>
                    {(task.deal_ref || task.project_ref) && <span>·</span>}
                    <span className="text-red-600 font-medium">просрочена</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Spacer слева от центральных кнопок — чтобы они встали по центру. */}
          <div className="flex-1" />

          {/* Контекстные кнопки действий по статусу — по центру шапки
              (как в Б24). Зависят от текущего task.status. Селект
              статуса справа остаётся как fallback для нестандартных
              переходов. */}
          <div className="flex items-center gap-1.5 shrink-0">
            {task.status === "pending" && (
              <Button
                size="sm"
                onClick={() => handleStatusChange("in_progress")}
                className="rounded-lg h-8 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Начать
              </Button>
            )}
            {task.status === "in_progress" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("paused")}
                  className="rounded-lg h-8 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <Pause className="h-3.5 w-3.5 mr-1.5" />
                  Пауза
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("waiting_check")}
                  className="rounded-lg h-8 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  На проверку
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("done")}
                  className="rounded-lg h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Завершить
                </Button>
              </>
            )}
            {task.status === "paused" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("in_progress")}
                  className="rounded-lg h-8 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Продолжить
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("done")}
                  className="rounded-lg h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Завершить
                </Button>
              </>
            )}
            {task.status === "waiting_check" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("done")}
                  className="rounded-lg h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Принять
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("in_progress")}
                  className="rounded-lg h-8 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                  На доработку
                </Button>
              </>
            )}
            {task.status === "done" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("in_progress")}
                className="rounded-lg h-8 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Открыть заново
              </Button>
            )}
          </div>

          {/* Spacer чтобы «правые» кнопки прижать к правому краю. */}
          <div className="flex-1" />

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-lg h-8 bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Сохранить
          </Button>

          <div className="w-40">
            <Select
              value={task.status}
              onValueChange={(v) => handleStatusChange(v as TaskStatus)}
            >
              <SelectTrigger className="rounded-lg gap-1.5 h-8 text-sm focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0">
                <StatusIcon className="h-3.5 w-3.5 shrink-0" style={{ color: st.color }} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleWatch}
            className={cn(
              "rounded-lg h-8 px-2.5 gap-1.5",
              task.is_watched
                ? "text-brand-yellow hover:bg-brand-yellow/10"
                : "text-gray-500 hover:text-brand-yellow hover:bg-gray-100",
            )}
            title={task.is_watched ? "Убрать из «Отслеживаемые»" : "Добавить в «Отслеживаемые»"}
          >
            <Star className={cn("h-4 w-4", task.is_watched && "fill-brand-yellow")} />
            <span className="text-sm">
              {task.is_watched ? "Отслеживается" : "Отслеживать"}
            </span>
          </Button>

          {canManageWatchers && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddWatchersOpen(true)}
              className="rounded-lg h-8 px-2.5 gap-1.5 text-gray-600 hover:text-black hover:bg-gray-100"
              title="Поставить задачу в «Отслеживаемые» другому участнику"
            >
              <UserPlus className="h-4 w-4" />
              <span className="text-sm">В избранное…</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            className="text-red-500 hover:bg-red-50 h-8 w-8"
            title="Удалить задачу"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Основной грид: инфо / чек-листы+файлы+роли / (чат).
          Если чат свёрнут — третьей колонки нет, вместо неё под гридом
          выводится маленькая горизонтальная кнопка «Обсуждения». */}
      <div
        className={cn(
          "grid grid-cols-1 gap-2 xl:flex-1 xl:min-h-0",
          chatCollapsed
            ? "xl:grid-cols-[minmax(360px,1.2fr)_minmax(0,1.1fr)]"
            : "xl:grid-cols-[minmax(320px,1fr)_minmax(0,0.9fr)_minmax(440px,1.4fr)]",
        )}
      >
        <div className="min-w-0 xl:overflow-y-auto xl:pr-1">
          <TaskInfoCard
            task={task}
            draft={draft}
            onDraft={(patch) => setDraft((p) => ({ ...p, ...patch }))}
            onSave={handleSave}
            saving={saving}
            isDirty={isDirty}
            users={users}
            projects={projects}
            deals={deals}
            usersById={usersById}
            onRolesChange={reload}
            onDealCreated={(d) => setDeals((prev) => [d, ...prev.filter((x) => x.id !== d.id)])}
            onProjectCreated={(p) => setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)])}
          />
        </div>

        <div className="min-w-0 xl:overflow-y-auto xl:pr-1 flex flex-col">
          <div className="space-y-3">
            <TaskChecklistCard
              taskId={task.id}
              checklist={task.checklist ?? []}
              onChange={reload}
            />

            <TaskDocumentsCard
              taskId={task.id}
              usersById={usersById}
              refreshKey={docRefreshKey}
            />
          </div>

          {chatCollapsed && (
            <button
              type="button"
              onClick={toggleChat}
              className={cn(
                "mt-auto self-end rounded-lg bg-brand-yellow/15 border border-brand-yellow/40",
                "hover:bg-brand-yellow/25 text-black inline-flex items-center gap-1.5",
                "px-3 py-1.5 text-sm font-semibold transition-colors",
                "sticky bottom-0 shadow-sm",
              )}
              title="Развернуть обсуждения"
            >
              <MessageSquare className="h-4 w-4" />
              Обсуждения
              <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
            </button>
          )}
        </div>

        {!chatCollapsed && (
          <div className="min-w-0 xl:h-full">
            <TaskChatPanel
              taskId={task.id}
              currentUserId={currentUserId}
              usersById={usersById}
              onAttachmentUploaded={() => setDocRefreshKey((k) => k + 1)}
              onCollapse={toggleChat}
            />
          </div>
        )}
      </div>

      {/* Выход с несохранёнными правками */}
      <AlertDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(v) => !v && setPendingNavigation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Вы изменили поля задачи и не нажали «Сохранить». Выйти без сохранения?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                const dest = pendingNavigation!
                setPendingNavigation(null)
                router.push(dest)
              }}
              className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
            >
              Не сохранять
            </Button>
            <Button
              onClick={async () => {
                const dest = pendingNavigation!
                setPendingNavigation(null)
                await handleSave()
                router.push(dest)
              }}
              disabled={saving}
              className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Сохранить и выйти
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskAddWatchersDialog
        open={addWatchersOpen}
        onOpenChange={setAddWatchersOpen}
        task={task}
        usersById={usersById}
        onAdded={() => { reload() }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Задача «{task.title}» будет удалена вместе с чек-листами, чатом
              и файлами. Отменить нельзя.
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
    </div>
  )
}

// ============================================================================

function makeDraft(t: TaskFull): Partial<TaskFull> {
  return {
    title: t.title,
    description: t.description,
    priority: t.priority,
    responsible_id: t.responsible_id,
    deal_id: t.deal_id,
    project_id: t.project_id,
    due_at: t.due_at,
  }
}

function userDisplayName(u: Sys): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}
