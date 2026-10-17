/**
 * Типы справочника проектов (для задач CRM). Соответствует ответам
 * `pospro_new_server`:
 *   GET  /api/admin/projects        → { projects: Project[] }
 *   POST /api/admin/projects
 *   PUT  /api/admin/projects/<id>
 *   DELETE /api/admin/projects/<id>
 *
 * Проект — верхнеуровневый контейнер для задач, не связанных со сделкой.
 * `task_count` денормализуется на бэке в GET.
 */

export interface Project {
  id: number
  name: string
  color: string // hex #RRGGBB
  description: string | null
  created_by: number | null
  created_at: string | null
  updated_at: string | null
  task_count?: number
}

export interface ProjectsListResponse {
  success: boolean
  projects: Project[]
}
