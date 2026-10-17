/**
 * Типы CRM-задач для фронта. Соответствуют ответам
 * `pospro_new_server` — routes/tasks.py.
 */

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "waiting_check"
  | "done"
  | "paused"

export type TaskPriority = "low" | "normal" | "high" | "urgent"

/** Роль в задаче (для фильтра «Все роли»). */
export type TaskRoleFilter =
  | "any"          // creator OR responsible OR member
  | "creator"      // постановщик
  | "responsible"  // исполнитель
  | "coworker"     // соисполнитель (member.role='co-worker')
  | "observer"     // наблюдатель (member.role='observer')

/** Ссылка на сделку в колонке «Проект». */
export interface TaskDealRef {
  id: number
  name: string
}
/** Ссылка на запись справочника «Проект». */
export interface TaskProjectRef {
  id: number
  name: string
  color: string | null
}

export interface TaskListItem {
  id: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  creator_id: number | null
  responsible_id: number | null
  deal_id: number | null
  client_id: number | null
  project_id: number | null
  started_at: string | null
  due_at: string | null
  completed_at: string | null
  tags: string[]
  created_at: string | null
  updated_at: string | null
  /** Денормализовано на бэке — привязанная сделка (если есть). */
  deal_ref: TaskDealRef | null
  /** Денормализовано на бэке — привязанный проект (если есть). */
  project_ref: TaskProjectRef | null
}

export interface TaskMember {
  id: number
  user_id: number
  role: "co-worker" | "observer"
  added_at: string | null
}

export interface TaskChecklistItem {
  id: number
  text: string
  done: boolean
  order: number
  group_name: string | null
  /**
   * Имя группы (group_name), от которой зависит эта — пока та не
   * завершена, эта заблокирована в UI. NULL = независимо.
   * Хранится у каждого пункта, но у всех пунктов одной группы значение
   * одинаковое (UI гарантирует).
   */
  depends_on_group: string | null
}

export interface TaskFull extends TaskListItem {
  members: TaskMember[]
  checklist: TaskChecklistItem[]
}

export interface TasksListResponse {
  success: boolean
  tasks: TaskListItem[]
  total: number
  limit: number
  offset: number
}

export const STATUS_META: Record<
  TaskStatus,
  { label: string; color: string }
> = {
  pending:       { label: "Ожидает",     color: "#94a3b8" },
  in_progress:   { label: "В работе",    color: "#3b82f6" },
  waiting_check: { label: "На проверке", color: "#f59e0b" },
  done:          { label: "Готово",      color: "#10b981" },
  paused:        { label: "Пауза",       color: "#78716c" },
}

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; cls: string }
> = {
  low:    { label: "низкий",  cls: "bg-gray-50 text-gray-600 border-gray-200" },
  normal: { label: "обычный", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  high:   { label: "высокий", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  urgent: { label: "срочный", cls: "bg-red-50 text-red-700 border-red-200" },
}
