// Типы данных CRM-сделок, совместимые с ответами `pospro_new_server`:
//   GET /api/admin/deal-pipelines?with_stages=1
//   GET /api/admin/deals
//   POST /api/admin/deals/<id>/move
// Держим здесь чтобы не размазывать по компонентам.

export type DealStageType = "normal" | "won" | "lost"
export type DealStatus = "open" | "won" | "lost"
export type DealPriority = "low" | "normal" | "high"

export interface DealStage {
  id: number
  pipeline_id: number
  name: string
  color: string
  order: number
  type: DealStageType
  /** Если false — стадия скрыта в канбане и в большинстве селектов,
   *  но сделки остаются привязаны. */
  is_active?: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface DealPipeline {
  id: number
  name: string
  order: number
  active: boolean
  created_at?: string | null
  updated_at?: string | null
  stages?: DealStage[]
}

export interface Deal {
  id: number
  name: string
  client_id: number | null
  /** Опциональная привязка к компании (`kp_company.id`). */
  company_id?: number | null
  /** Основная + доп. контакты сделки. Приходит с бэка в развёрнутом
   *  виде на GET /admin/deals/<id>; на list — только client_id. */
  contacts?: Array<{
    client_id: number
    name: string
    is_primary: boolean
    company_id?: number | null
  }>
  company?: { id: number; name: string; bin?: string | null } | null
  responsible_user_id: number | null
  creator_id: number | null
  pipeline_id: number
  stage_id: number
  amount: number | null
  currency: string
  expected_close_at: string | null
  priority: DealPriority
  source: string | null
  source_id: number | null
  deal_source?: { id: number; name: string; color: string | null } | null
  /** Дочерний «вариант» источника — «Дополнительно об источнике». */
  source_variant_id: number | null
  source_variant?: { id: number; parent_source_id: number; name: string } | null
  status: DealStatus
  tags: string[]
  notes: string | null
  source_ref_type: string | null
  source_ref_id: string | null
  /**
   * Название правила источника (CrmIngestSource.name), если сделка
   * пришла через ingest. `null` если правило удалено или сделка не
   * из источника. Денормализовано на бэке при list/get.
   */
  source_name?: string | null
  created_at: string
  updated_at: string
}

export interface DealsListResponse {
  success: boolean
  deals: Deal[]
  total: number
  limit: number
  offset: number
}

export interface PipelinesListResponse {
  success: boolean
  pipelines: DealPipeline[]
}
