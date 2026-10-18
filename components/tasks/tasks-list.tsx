"use client"

/**
 * Страница /admin/tasks — таблица задач с фильтрами.
 *
 * Отличается от сделок: не Kanban, а плоская таблица. Задачи имеют
 * 4 роли на юзере (creator/responsible/coworker/observer) — фильтр
 * «Мои задачи в роли» переключает выборку. По статусу/приоритету/
 * проекту/просрочке — отдельные фильтры.
 *
 * Клик по строке → /admin/tasks/[id] с полной карточкой (см. task-detail).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Plus, Search, X, Loader2, ListTodo, CheckCircle2, Clock,
  Circle, PauseCircle, AlertCircle, Briefcase,
  FolderKanban, ChevronDown, CalendarDays,
  ChevronLeft, ChevronRight, Star,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import {
  STATUS_META,
  PRIORITY_META,
  type TaskListItem,
  type TaskStatus,
  type TaskPriority,
  type TaskRoleFilter,
  type TasksListResponse,
} from "@/lib/tasks-types"
import type { Project } from "@/lib/projects-types"

import TaskCreateDialog from "./task-create-dialog"
import TasksCalendarDialog from "./tasks-calendar-dialog"

interface SystemUserLite {
  id: number
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
  name?: string
}

const ROLE_OPTIONS: { value: TaskRoleFilter; label: string }[] = [
  { value: "any",         label: "Все роли" },
  { value: "creator",     label: "Я — постановщик" },
  { value: "responsible", label: "Я — исполнитель" },
  { value: "coworker",    label: "Я — соисполнитель" },
  { value: "observer",    label: "Я — наблюдатель" },
]

const STATUS_ICONS: Record<TaskStatus, any> = {
  pending: Circle,
  in_progress: Clock,
  waiting_check: AlertCircle,
  done: CheckCircle2,
  paused: PauseCircle,
}

export default function TasksList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuth()
  const canManageProjects = Boolean(
    user && (user.is_owner || user.can_manage_projects),
  )

  // Начальные значения фильтров — из URL, чтобы возврат по кнопке
  // назад из карточки задачи восстанавливал выбор.
  const [roleFilter, setRoleFilter] = useState<TaskRoleFilter>(
    (searchParams.get("role") as TaskRoleFilter) || "any",
  )
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all",
  )
  const [priorityFilter, setPriorityFilter] = useState<string>(
    searchParams.get("priority") || "all",
  )
  const [projectFilter, setProjectFilter] = useState<string>(
    searchParams.get("project") || "all",
  )
  // Фильтр «Исполнитель». Работает независимо от `roleFilter`: даже
  // если стоит «Я — постановщик», можно дополнительно выбрать
  // исполнителя, чтобы посмотреть свои задачи-постановки на конкретного
  // сотрудника. `all` = не фильтруем.
  const [responsibleFilter, setResponsibleFilter] = useState<string>(
    searchParams.get("responsible") || "all",
  )
  const [overdue, setOverdue] = useState<boolean>(searchParams.get("overdue") === "1")
  const [q, setQ] = useState<string>(searchParams.get("q") || "")
  // Таб-переключатель «Все задачи / Отслеживаемые». Персональный список
  // избранного (task_watcher), фильтруется на бэке через ?watched=1.
  const [view, setView] = useState<"all" | "watched">(
    searchParams.get("view") === "watched" ? "watched" : "all",
  )

  // Пагинация: страница 1-based, размер страницы 10/25/50.
  // Начальные значения — из URL, чтобы back из карточки возвращал
  // пользователя на ту же страницу списка.
  const PAGE_SIZES = [10, 25, 50] as const
  const parsedPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
  const parsedSize = parseInt(searchParams.get("size") || "25", 10)
  const [page, setPage] = useState<number>(parsedPage)
  const [pageSize, setPageSize] = useState<number>(
    PAGE_SIZES.includes(parsedSize as any) ? parsedSize : 25,
  )

  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<SystemUserLite[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // При смене любого фильтра возвращаемся на первую страницу — иначе
  // юзер меняет статус и видит пустой список (page=4 для 3 строк).
  // pageSize меняет page косвенно (через вторую зависимость ниже).
  useEffect(() => {
    setPage(1)
  }, [roleFilter, statusFilter, priorityFilter, projectFilter, responsibleFilter, overdue, q, view, pageSize])

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, userDisplayName(u)])),
    [users],
  )
  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  )

  // Справочники — один раз при маунте.
  useEffect(() => {
    let ignore = false
    Promise.all([
      crmGet<{ projects: Project[] }>("/api/admin/projects").catch(() => ({ projects: [] })),
      crmGet<SystemUserLite[] | { users: SystemUserLite[] }>("/api/system-users").catch(() => []),
    ]).then(([p, u]) => {
      if (ignore) return
      setProjects(p.projects || [])
      const us = Array.isArray(u) ? u : (u as any).users || []
      setUsers(us)
    })
    return () => { ignore = true }
  }, [])

  // Основной запрос списка задач — debounced на смену любого фильтра.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // «Роль» — mine=1 + role_as ограничивает выборку задач, к
      // которым я причастен как creator/responsible/coworker/observer.
      // «Все роли» без mine — снимает это ограничение, показываем всё
      // что видимо юзеру, и работают отдельные фильтры вроде
      // responsible_id (иначе бэк их игнорит при mine=1 + role_as).
      if (roleFilter !== "any") {
        params.set("mine", "1")
        params.set("role_as", roleFilter)
      }
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (priorityFilter !== "all") params.set("priority", priorityFilter)
      if (projectFilter !== "all") params.set("project_id", projectFilter)
      if (responsibleFilter !== "all") params.set("responsible_id", responsibleFilter)
      if (overdue) params.set("overdue", "1")
      if (view === "watched") params.set("watched", "1")
      if (q.trim()) params.set("q", q.trim())
      params.set("limit", String(pageSize))
      params.set("offset", String((page - 1) * pageSize))

      const res = await crmGet<TasksListResponse>(`/api/admin/tasks?${params.toString()}`)
      setTasks(res.tasks || [])
      setTotal(res.total || 0)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось загрузить задачи",
        description: e?.message,
      })
    } finally {
      setLoading(false)
    }
  }, [roleFilter, statusFilter, priorityFilter, projectFilter, responsibleFilter, overdue, view, q, page, pageSize, toast])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  // Отражаем фильтры в URL (без scroll) — restore при back.
  useEffect(() => {
    const p = new URLSearchParams()
    if (roleFilter !== "any") p.set("role", roleFilter)
    if (statusFilter !== "all") p.set("status", statusFilter)
    if (priorityFilter !== "all") p.set("priority", priorityFilter)
    if (projectFilter !== "all") p.set("project", projectFilter)
    if (responsibleFilter !== "all") p.set("responsible", responsibleFilter)
    if (overdue) p.set("overdue", "1")
    if (view === "watched") p.set("view", "watched")
    if (q.trim()) p.set("q", q.trim())
    if (page !== 1) p.set("page", String(page))
    if (pageSize !== 25) p.set("size", String(pageSize))
    const qs = p.toString()
    router.replace(qs ? `/admin/tasks?${qs}` : "/admin/tasks", { scroll: false })
  }, [roleFilter, statusFilter, priorityFilter, projectFilter, responsibleFilter, overdue, view, q, page, pageSize, router])

  const handleStatusChange = async (task: TaskListItem, status: TaskStatus) => {
    const prev = task.status
    setTasks((list) => list.map((t) => t.id === task.id ? { ...t, status } : t))
    try {
      await crmPost(`/api/admin/tasks/${task.id}/status`, { status })
    } catch (e: any) {
      setTasks((list) => list.map((t) => t.id === task.id ? { ...t, status: prev } : t))
      toast({
        variant: "destructive",
        title: "Не удалось обновить статус",
        description: e?.message,
      })
    }
  }

  const handleToggleWatch = async (task: TaskListItem) => {
    const prev = Boolean(task.is_watched)
    const next = !prev
    // Оптимистично переключаем звёздочку. В режиме «Отслеживаемые» строку
    // убираем сразу — не ждём ответа бэка, иначе пользователь успевает
    // кликнуть снова.
    setTasks((list) => {
      if (view === "watched" && !next) {
        return list.filter((t) => t.id !== task.id)
      }
      return list.map((t) => t.id === task.id ? { ...t, is_watched: next } : t)
    })
    try {
      if (next) {
        await crmPost(`/api/admin/tasks/${task.id}/watch`, {})
      } else {
        await crmDelete(`/api/admin/tasks/${task.id}/watch`)
      }
    } catch (e: any) {
      // Откат.
      setTasks((list) => {
        const already = list.some((t) => t.id === task.id)
        if (!already) return [...list, { ...task, is_watched: prev }]
        return list.map((t) => t.id === task.id ? { ...t, is_watched: prev } : t)
      })
      toast({
        variant: "destructive",
        title: "Не удалось обновить отслеживание",
        description: e?.message,
      })
    }
  }

  const handlePriorityChange = async (task: TaskListItem, priority: TaskPriority) => {
    const prev = task.priority
    setTasks((list) => list.map((t) => t.id === task.id ? { ...t, priority } : t))
    try {
      await crmPut(`/api/admin/tasks/${task.id}`, { priority })
    } catch (e: any) {
      setTasks((list) => list.map((t) => t.id === task.id ? { ...t, priority: prev } : t))
      toast({
        variant: "destructive",
        title: "Не удалось обновить приоритет",
        description: e?.message,
      })
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
            <ListTodo className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Задачи</h1>
            <p className="text-sm text-gray-500">Всего: {total}</p>
          </div>
        </div>
        {/* Табы «Все задачи / Отслеживаемые» — переключают персональный
            фильтр по task_watcher. Положение между заголовком и правыми
            кнопками: читается как часть шапки, не прыгает со сменой. */}
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 self-center">
          <button
            type="button"
            onClick={() => setView("all")}
            className={cn(
              "h-8 px-3 text-sm rounded-md transition-colors",
              view === "all"
                ? "bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-medium"
                : "text-gray-500 hover:text-gray-900",
            )}
          >
            Все задачи
          </button>
          <button
            type="button"
            onClick={() => setView("watched")}
            className={cn(
              "h-8 px-3 text-sm rounded-md transition-colors inline-flex items-center gap-1.5",
              view === "watched"
                ? "bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-medium"
                : "text-gray-500 hover:text-gray-900",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", view === "watched" && "fill-brand-yellow text-brand-yellow")} />
            Отслеживаемые
          </button>
        </div>
        <div className="flex items-center gap-2">
          {canManageProjects && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-lg"
            >
              <Link href="/admin/projects">
                <FolderKanban className="h-4 w-4 mr-1.5" />
                Проекты
              </Link>
            </Button>
          )}
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-brand-yellow text-black hover:bg-yellow-500 rounded-full"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Новая задача
          </Button>
        </div>
      </div>

      {/* Фильтры: поиск слева, остальные — компактной группой справа. */}
      <Card className="rounded-xl border-gray-200 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Кнопка «Календарь» — слева перед поиском. Открывает модалку
              с календарём задач (месяцы с подсвеченными датами due_at). */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCalendarOpen(true)}
            className="rounded-lg h-9 shrink-0"
          >
            <CalendarDays className="h-4 w-4 mr-1.5" />
            Календарь
          </Button>
          {/* Поиск растягивается на всё свободное пространство между
              собой и группой фильтров справа (у той `ml-auto` уже нет —
              за счёт `flex-1` тут поиск сам поедает остаток). */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по заголовку"
              className="h-9 pl-9 pr-8 w-full rounded-lg"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded focus:outline-none"
                aria-label="Очистить"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Группа фильтров — справа, поиск слева `flex-1` толкает их
              к правому краю. Порядок «роль → статус → приоритет →
              проект → исполнитель → просроченные». */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ширина фильтров = «под выбранный элемент». `w-auto` +
                `min-w-[120px]` даёт узкую полосу для «Все роли» / «Все
                статусы» и раздвигается сама если выбрано «Я — соисп.»
                / «Любой приоритет». Popover-меню сохраняет минимальную
                ширину trigger'а (Radix `--radix-select-trigger-width`),
                но может расшириться под самое длинное значение. */}
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as TaskRoleFilter)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-lg">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-lg">
                <SelectValue placeholder="Приоритет" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Любой приоритет</SelectItem>
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] max-w-[320px] rounded-lg">
                <SelectValue placeholder="Проект" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все проекты</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] max-w-[320px] rounded-lg">
                <SelectValue placeholder="Исполнитель" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все исполнители</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {/* Сокращаем «Ф И О» → «Ф И. О.» — иначе SelectValue
                        в trigger'е с max-w-[320px] обрезает длинные
                        ФИО троеточием. Полное имя в title. */}
                    <span title={userDisplayName(u)}>
                      {compactName(userDisplayName(u))}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none pl-1">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => setOverdue(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-yellow focus:ring-brand-yellow"
              />
              Просроченные
            </label>
          </div>
        </div>
      </Card>

      {/* Таблица */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-16">
            Задачи не найдены
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Ширины: остальные колонки — фиксированные пиксели, Название
                и Проект — процентные, забирают остаток и делят его между
                собой. Так «Название» не разъезжается на пол-экрана, а
                колонки с ФИО/статусом/датой не жмутся к правому краю. */}
            <table className="w-full text-sm border-separate border-spacing-0 table-fixed">
              <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-center px-2 py-2.5 font-normal border-b border-gray-100 w-[36px]" aria-label="Отслеживать" />
                  <th className="text-left px-3 py-2.5 font-normal border-b border-gray-100 w-[28%] min-w-[220px]">Название</th>
                  <th className="text-left px-3 py-2.5 font-normal border-b border-gray-100 w-[130px]">Статус</th>
                  <th className="text-left px-3 py-2.5 font-normal border-b border-gray-100 w-[110px]">Приоритет</th>
                  <th className="text-left px-3 py-2.5 font-normal border-b border-gray-100 w-[150px]">Исполнитель</th>
                  <th className="text-left px-3 py-2.5 font-normal border-b border-gray-100 w-[150px]">Постановщик</th>
                  <th className="text-left px-3 py-2.5 font-normal border-b border-gray-100 w-[22%] min-w-[180px]">Проект</th>
                  <th className="text-right px-3 py-2.5 font-normal border-b border-gray-100 w-[130px]">Крайний срок</th>
                </tr>
              </thead>
              <tbody className={cn(loading && "opacity-70")}>
                {tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    responsibleName={
                      t.responsible_id != null
                        ? usersById.get(t.responsible_id) ?? `#${t.responsible_id}`
                        : null
                    }
                    creatorName={
                      t.creator_id != null
                        ? usersById.get(t.creator_id) ?? `#${t.creator_id}`
                        : null
                    }
                    onStatusChange={(s) => handleStatusChange(t, s)}
                    onPriorityChange={(p) => handlePriorityChange(t, p)}
                    onToggleWatch={() => handleToggleWatch(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Пейджер + селектор размера страницы — показываем только если
          есть что пагинировать (total > min(pageSize)). */}
      {total > 0 && (
        <Pager
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sizes={PAGE_SIZES}
        />
      )}

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects}
        users={users}
        onCreated={() => { setCreateOpen(false); load() }}
      />

      <TasksCalendarDialog open={calendarOpen} onOpenChange={setCalendarOpen} />
    </div>
  )
}

// ============================================================================

function TaskRow({
  task,
  responsibleName,
  creatorName,
  onStatusChange,
  onPriorityChange,
  onToggleWatch,
}: {
  task: TaskListItem
  responsibleName: string | null
  creatorName: string | null
  onStatusChange: (s: TaskStatus) => void
  onPriorityChange: (p: TaskPriority) => void
  onToggleWatch: () => void
}) {
  const st = STATUS_META[task.status]
  const pr = PRIORITY_META[task.priority]
  const StatusIcon = STATUS_ICONS[task.status]
  const overdue =
    task.due_at &&
    task.status !== "done" &&
    new Date(task.due_at).getTime() < Date.now()

  const router = useRouter()
  const isWatched = Boolean(task.is_watched)

  return (
    <tr
      className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 cursor-pointer group"
      onClick={() => router.push(`/admin/tasks/${task.id}`)}
    >
      <td
        className="px-2 py-2.5 align-middle text-center border-b border-gray-100"
        onClick={(e) => { e.stopPropagation(); onToggleWatch() }}
      >
        <button
          type="button"
          title={isWatched ? "Убрать из «Отслеживаемые»" : "Добавить в «Отслеживаемые»"}
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors",
            isWatched
              ? "text-brand-yellow hover:bg-brand-yellow/10"
              : "text-gray-300 hover:text-brand-yellow hover:bg-gray-100",
          )}
        >
          <Star className={cn("h-4 w-4", isWatched && "fill-brand-yellow")} />
        </button>
      </td>
      <td className="px-3 py-2.5 align-middle border-b border-gray-100">
        <div className={cn(
          "text-sm truncate max-w-[500px] group-hover:text-brand-yellow-dark",
          task.status === "done" && "line-through text-gray-400",
        )}>
          {task.title}
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle border-b border-gray-100" onClick={(e) => e.stopPropagation()}>
        <Select value={task.status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
          <SelectTrigger className="h-7 text-xs px-2 rounded-md gap-1 bg-white">
            <StatusIcon className="h-3.5 w-3.5 shrink-0" style={{ color: st.color }} />
            <span className="truncate">{st.label}</span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2.5 align-middle border-b border-gray-100" onClick={(e) => e.stopPropagation()}>
        <Select value={task.priority} onValueChange={(v) => onPriorityChange(v as TaskPriority)}>
          {/* Trigger стилизован под тот же бейдж — сохраняем визуал,
              просто добавляем кликабельность и dropdown. */}
          <SelectTrigger
            className={cn(
              "h-6 w-auto text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 gap-1",
              pr.cls,
              // Убираем shadow/focus-ring — бейдж не должен быть похож на инпут.
              "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 data-[state=open]:!ring-0",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
              <SelectItem key={p} value={p} className="text-xs">
                {PRIORITY_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td
        className="px-3 py-2.5 align-middle text-sm text-gray-700 truncate max-w-[150px] border-b border-gray-100"
        title={responsibleName || ""}
      >
        {responsibleName ? compactName(responsibleName) : <span className="text-gray-400 italic">—</span>}
      </td>
      <td
        className="px-3 py-2.5 align-middle text-sm text-gray-700 truncate max-w-[150px] border-b border-gray-100"
        title={creatorName || ""}
      >
        {creatorName ? compactName(creatorName) : <span className="text-gray-400 italic">—</span>}
      </td>
      <td className="px-3 py-2.5 align-middle border-b border-gray-100">
        {(task.deal_ref || task.project_ref) ? (
          <div className="space-y-0.5 max-w-[220px]">
            {task.deal_ref && (
              <div
                className="inline-flex items-center gap-1.5 text-sm text-gray-700 truncate max-w-full"
                title={`Сделка: ${task.deal_ref.name}`}
              >
                <Briefcase className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="truncate">{task.deal_ref.name}</span>
              </div>
            )}
            {task.project_ref && (
              <div
                className="inline-flex items-center gap-1.5 text-sm text-gray-700 truncate max-w-full"
                title={`Проект: ${task.project_ref.name}`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: task.project_ref.color || "#94a3b8" }}
                />
                <span className="truncate">{task.project_ref.name}</span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-400 italic text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 align-middle text-right border-b border-gray-100">
        {task.due_at ? (
          <span className={cn(
            "text-sm tabular-nums",
            overdue && "text-red-600 font-medium",
          )}>
            {formatDate(task.due_at)}
          </span>
        ) : (
          <span className="text-gray-400 italic text-sm">без срока</span>
        )}
      </td>
    </tr>
  )
}

/**
 * Компактная форма ФИО «Ф И. О.» для узких колонок таблицы. Формат
 * ввода в проекте — «Фамилия Имя Отчество» (Ф И О).
 */
function compactName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return full
  const [surname, ...rest] = parts
  return `${surname} ${rest.map((p) => p[0].toUpperCase() + ".").join(" ")}`
}

function userDisplayName(u: SystemUserLite): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

// ============================================================================
// Пейджер: номера страниц с эллипсисом + селектор размера. Показывает
// до 7 номеров: `1 ... 4 5 6 ... 42` — текущая всегда видна, по 1 соседу
// с каждой стороны + первая/последняя как якоря.

function Pager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sizes,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  sizes: readonly number[]
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  const pages = computePageList(current, totalPages)

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <span>Показано {from}–{to} из {total}</span>
        <span className="text-gray-300">·</span>
        <span>На странице:</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(parseInt(v, 10))}
        >
          <SelectTrigger className="h-8 w-[72px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((s) => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-2 text-gray-400 select-none">…</span>
          ) : (
            <Button
              key={p}
              variant={p === current ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 min-w-8 px-2 rounded-lg tabular-nums",
                p === current
                  ? "bg-brand-yellow text-black hover:bg-yellow-500"
                  : "text-gray-700",
              )}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          aria-label="Следующая страница"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function computePageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: (number | "…")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push("…")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push("…")
  items.push(total)
  return items
}
