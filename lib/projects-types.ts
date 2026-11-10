/**
 * Типы модуля «Проекты» с собственным канбаном. Соответствует ответам
 * `pospro_new_server/routes/projects.py`.
 */

export type ProjectStatus = "active" | "archived"
export type TaskStageStatus =
  | "pending"
  | "in_progress"
  | "waiting_check"
  | "done"
  | "paused"

export interface Project {
  id: number
  name: string
  color: string // hex #RRGGBB
  description: string | null
  status: ProjectStatus
  owner_id: number | null
  created_by: number | null
  created_at: string | null
  updated_at: string | null
  task_count?: number
}

export interface ProjectStage {
  id: number
  project_id: number
  name: string
  color: string
  sort_order: number
  maps_to_status: TaskStageStatus
}

/**
 * Элемент computed-списка участников проекта (`GET /projects/<pid>/members`).
 * «Участие» определяется автоматически — наличием задач в проекте
 * (responsible / creator / co-worker / observer). У каждого есть
 * настройка `can_see_all_tasks` — видит ли он все задачи проекта или
 * только свои.
 */
export interface ProjectMember {
  user_id: number
  full_name: string
  email: string | null
  is_owner: boolean
  can_see_all_tasks: boolean
}

export interface ProjectFull extends Project {
  members: ProjectMember[]
  stages: ProjectStage[]
}

export interface ProjectsListResponse {
  success: boolean
  projects: Project[]
}

/** Чип-подсказка «что значит эта колонка» в UI настройки стадий. */
export const STAGE_STATUS_META: Record<
  TaskStageStatus,
  { label: string; color: string }
> = {
  pending:       { label: "Ожидает",     color: "#94a3b8" },
  in_progress:   { label: "В работе",    color: "#60a5fa" },
  waiting_check: { label: "На проверке", color: "#f59e0b" },
  done:          { label: "Готово",      color: "#10b981" },
  paused:        { label: "Пауза",       color: "#8b949e" },
}
