"use client"

/**
 * Карточка проекта /admin/projects/[id].
 *
 * Шапка: имя, цвет, описание, статус, владелец + быстрые действия
 * (В архив / Удалить).
 *
 * Табы:
 *   - Задачи: канбан (по умолчанию) и список. DnD задач между
 *     колонками канбана автоматически меняет глобальный status задачи
 *     через POST /move (см. project_stage.maps_to_status на бэке).
 *   - Участники: owner / member / observer.
 *   - Документы: EntityAttachment для entity_type='project'.
 *   - Обсуждения: ChatRoom с kind='project' (lazy-create).
 *
 * Гейт: owner / can_manage_projects → полный доступ. Участник проекта
 * (member/observer) → только чтение (бэк сам разруливает).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, Archive, Trash2, Settings2, ListTodo, Users, FileText,
  MessageSquare, Maximize2, Minimize2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { crmGet, crmPost, crmDelete } from "@/lib/crm-fetch"
import type {
  ProjectFull, ProjectStage, ProjectMember, TaskStageStatus,
} from "@/lib/projects-types"

import ProjectKanban, { ManagerFilter } from "./project-kanban"
import ProjectTasksList from "./project-tasks-list"
import ProjectMembersCard from "./project-members-card"
import ProjectStagesDialog from "./project-stages-dialog"

interface Sys {
  id: number
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
}

interface TaskLite {
  id: number
  title: string
  status: TaskStageStatus
  priority: string
  responsible_id: number | null
  project_stage_id: number | null
  due_at: string | null
  completed_at: string | null
}

export default function ProjectDetail({ projectId }: { projectId: number }) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [project, setProject] = useState<ProjectFull | null>(null)
  const [tasks, setTasks] = useState<TaskLite[]>([])
  const [users, setUsers] = useState<Sys[]>([])
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [stagesOpen, setStagesOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Фильтр по ответственным — null = «все». Применяется для юзеров с
  // can_see_all_tasks/can_manage на бэке; остальным сервер и так
  // ограничит выдачу только их задачами.
  const [managerFilter, setManagerFilter] = useState<number[] | null>(null)
  // Controlled Tabs — чтобы тулбар справа (переключатель Канбан/Список +
  // «На весь экран») мог жить в ОДНОЙ строке с TabsList, но знать,
  // активен ли сейчас таб «Задачи», и прятать себя на остальных.
  const [activeTab, setActiveTab] = useState<string>("tasks")
  // Fullscreen канбана держим на уровне project-detail, чтобы кнопка
  // «На весь экран» могла стоять в той же строке что переключатель вид
  // Канбан/Список. Канбан просто получает prop + callback.
  const [kanbanFullscreen, setKanbanFullscreen] = useState<boolean>(false)
  useEffect(() => {
    try {
      if (localStorage.getItem("project_kanban_fullscreen") === "1") {
        setKanbanFullscreen(true)
      }
    } catch { /* noop */ }
  }, [])
  const toggleKanbanFullscreen = useCallback(() => {
    setKanbanFullscreen((v) => {
      const next = !v
      try {
        localStorage.setItem("project_kanban_fullscreen", next ? "1" : "0")
      } catch { /* noop */ }
      return next
    })
  }, [])

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, userName(u)])),
    [users],
  )

  const canManage = useMemo(() => {
    if (!user || !project) return false
    if (user.is_owner || user.can_manage_projects) return true
    return project.owner_id === user.id
  }, [user, project])

  // Юзер может использовать фильтр «Менеджер», если он может настраивать
  // проект (видит всё) ИЛИ ему явно в участниках включили can_see_all_tasks.
  const canFilterByManager = useMemo(() => {
    if (canManage) return true
    if (!user || !project) return false
    const me = project.members.find((m) => m.user_id === user.id)
    return !!(me && me.can_see_all_tasks)
  }, [canManage, user, project])

  const reload = useCallback(async () => {
    try {
      const qp = managerFilter && managerFilter.length
        ? `?responsible_ids=${managerFilter.join(",")}`
        : ""
      const [proj, tasksRes, usersRes] = await Promise.all([
        crmGet<{ project: ProjectFull }>(`/api/admin/projects/${projectId}`),
        crmGet<{ tasks: TaskLite[] }>(`/api/admin/projects/${projectId}/tasks${qp}`),
        crmGet<Sys[] | { users: Sys[] }>("/api/system-users").catch(() => []),
      ])
      setProject(proj.project)
      setTasks(tasksRes.tasks || [])
      const us = Array.isArray(usersRes) ? usersRes : (usersRes as any).users || []
      setUsers(us)
    } catch (e: any) {
      if (String(e?.message).includes("403")) setForbidden(true)
      else toast({ variant: "destructive", title: "Не удалось загрузить", description: e?.message })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, managerFilter])

  useEffect(() => { reload() }, [reload])

  // Если юзер потерял доступ к табу «Участники» (нет прав настраивать),
  // а был на нём — переключимся на «Задачи», чтобы не показывать пустоту.
  useEffect(() => {
    if (activeTab === "members" && project && user) {
      const canMng = user.is_owner || user.can_manage_projects || project.owner_id === user.id
      if (!canMng) setActiveTab("tasks")
    }
  }, [activeTab, project, user])

  useEffect(() => {
    if (forbidden) router.replace("/admin/projects")
  }, [forbidden, router])

  const handleArchive = async () => {
    if (!project) return
    const endpoint = project.status === "active" ? "archive" : "unarchive"
    try {
      await crmPost(`/api/admin/projects/${project.id}/${endpoint}`, {})
      toast({ title: project.status === "active" ? "В архиве" : "Активирован" })
      reload()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message })
    }
  }

  const handleDelete = async () => {
    try {
      await crmDelete(`/api/admin/projects/${projectId}`)
      toast({ title: "Проект удалён" })
      router.push("/admin/projects")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Не удалось удалить", description: e?.message })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!project) {
    return <div className="text-center py-24 text-gray-500">Проект не найден</div>
  }

  const ownerName = project.owner_id != null
    ? (usersById.get(project.owner_id) ?? `#${project.owner_id}`)
    : "—"

  return (
    // Root без max-w: канбан внутри таба «Задачи» должен раскатываться
    // на всю ширину (-mr-4 md:-mr-6 → до края экрана). Остальные табы
    // ограничиваем через локальный mx-auto max-w-7xl прямо в их контенте.
    // Шапку и табы тоже оставляем на всю ширину — так заголовок проекта
    // не выглядит зажатым посреди пустого места при широком экране.
    <div className="space-y-4">
      <Card className="rounded-xl border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/projects")}
            className="rounded-full h-8 px-2.5"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            К списку
          </Button>

          <span
            className="h-4 w-4 rounded-full shrink-0 ml-1"
            style={{ backgroundColor: project.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-semibold leading-tight truncate">
                {project.name}
              </h1>
              {project.status === "archived" && (
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-gray-300 bg-gray-100 text-gray-600 font-medium shrink-0">
                  <Archive className="h-3 w-3" /> архив
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
              <span>Владелец: {ownerName}</span>
              <span>·</span>
              <span>{tasks.length} задач</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStagesOpen(true)}
                  className="rounded-lg h-8"
                >
                  <Settings2 className="h-4 w-4 mr-1.5" />
                  Колонки
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  className="rounded-lg h-8"
                >
                  <Archive className="h-4 w-4 mr-1.5" />
                  {project.status === "active" ? "В архив" : "Из архива"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteOpen(true)}
                  className="text-red-500 hover:bg-red-50 h-8 w-8"
                  title="Удалить проект"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {project.description && (
          <div className="px-4 pb-3 pt-0 text-sm text-gray-600 whitespace-pre-wrap">
            {project.description}
          </div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* ОДНА СТРОКА: слева табы (Задачи/Участники/Документы/Обсуждения),
            справа — переключатель Канбан/Список и «На весь экран»
            (только пока активен таб «Задачи» + режим канбана). */}
        <div className="flex items-center gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="tasks">
              <ListTodo className="h-4 w-4 mr-1.5" />
              Задачи
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-1.5" />
                Участники
              </TabsTrigger>
            )}
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-1.5" />
              Документы
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Обсуждения
            </TabsTrigger>
          </TabsList>

          {activeTab === "tasks" && (
            <div className="flex items-center gap-2 ml-auto">
              {/* Фильтр «Менеджер» — компактно слева, перед переключателем
                  вид. Показываем только если юзер имеет право видеть
                  все задачи проекта (canManage или can_see_all). */}
              {view === "kanban" && canFilterByManager && (
                <ManagerFilter
                  members={project.members}
                  value={managerFilter}
                  onChange={setManagerFilter}
                />
              )}
              <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setView("kanban")}
                  className={`rounded-full px-3 h-7 ${
                    view === "kanban" ? "bg-brand-yellow text-black font-medium" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Канбан
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={`rounded-full px-3 h-7 ${
                    view === "list" ? "bg-brand-yellow text-black font-medium" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Список
                </button>
              </div>
              {view === "kanban" && (
                <button
                  type="button"
                  onClick={toggleKanbanFullscreen}
                  className="h-7 inline-flex items-center gap-1.5 px-2 rounded-md border border-gray-200 bg-white text-xs text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors shrink-0"
                  title={kanbanFullscreen ? "Свернуть" : "Развернуть на весь экран"}
                >
                  {kanbanFullscreen ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      <span>Свернуть</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>На весь экран</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <TabsContent value="tasks" className="mt-3">
          {view === "kanban" ? (
            <ProjectKanban
              projectId={project.id}
              stages={project.stages}
              tasks={tasks}
              usersById={usersById}
              canManage={canManage}
              onTasksChange={reload}
              isFullscreen={kanbanFullscreen}
              onToggleFullscreen={toggleKanbanFullscreen}
              members={project.members}
              managerFilter={managerFilter}
              onManagerFilterChange={setManagerFilter}
            />
          ) : (
            <ProjectTasksList
              tasks={tasks}
              stages={project.stages}
              usersById={usersById}
            />
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="members">
            <ProjectMembersCard
              projectId={project.id}
              members={project.members}
              canManage={canManage}
              onChange={reload}
            />
          </TabsContent>
        )}

        <TabsContent value="documents">
          <Card className="rounded-xl border-gray-200 p-6 text-center text-sm text-gray-500">
            Загрузка документов проекта появится после включения в бэке
            (EntityAttachment entity_type=&apos;project&apos;).
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card className="rounded-xl border-gray-200 p-6 text-center text-sm text-gray-500">
            Чат проекта появится после включения lazy-create ChatRoom
            kind=&apos;project&apos; в бэке.
          </Card>
        </TabsContent>
      </Tabs>

      {canManage && stagesOpen && (
        <ProjectStagesDialog
          projectId={project.id}
          stages={project.stages}
          open={stagesOpen}
          onOpenChange={setStagesOpen}
          onChanged={reload}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Проект «{project.name}» будет удалён вместе со стадиями,
              участниками, его документами и чатом. Задачи проекта
              останутся, просто потеряют привязку (project_id = NULL).
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

function userName(u: Sys): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}
