// Типы для `crm_ingest_source` — совместимы с ответами
// `pospro_new_server/routes/crm_sources.py`.

export type CrmIngestKind = "internal" | "webhook"
export type CrmIngestStrategy =
  | "round_robin"
  | "least_busy"
  | "fixed"
  | "unassigned"
export type CrmIngestClientResolution =
  | "none"
  | "always_create"
  | "find_by_email"
  | "find_by_phone"
export type CrmIngestPriority = "low" | "normal" | "high"

export interface CrmIngestSource {
  id: number
  kind: CrmIngestKind
  source_key: string | null
  /** Полностью раскрытый токен (webhook). Приходит в details/create/rotate/update. Отсутствует в list. */
  token?: string | null
  name: string
  pipeline_id: number
  stage_id: number
  title_template: string
  notes_template: string | null
  priority: CrmIngestPriority
  assignment_strategy: CrmIngestStrategy
  pool_user_ids: number[]
  fixed_user_id: number | null
  client_resolution: CrmIngestClientResolution
  dedupe_by_ref: boolean
  active: boolean
  last_used_at: string | null
  request_count: number
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface CrmSourcesListResponse {
  success: boolean
  sources: CrmIngestSource[]
}

export interface CrmSourceDetailResponse {
  success: boolean
  source: CrmIngestSource
}
