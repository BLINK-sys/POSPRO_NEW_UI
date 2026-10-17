"use client"

/**
 * Документы задачи — тонкая обёртка над общим `CrmDocumentsCard`.
 * Вся логика (загрузка, delete, rename, превью изображений)
 * централизована в общем компоненте, чтобы правки применялись
 * одновременно к сделкам и задачам.
 */

import CrmDocumentsCard from "@/components/crm/crm-documents-card"

interface Props {
  taskId: number
  usersById: Map<number, string>
  /** См. CrmDocumentsCard.refreshKey — внешний триггер refetch. */
  refreshKey?: number
}

export default function TaskDocumentsCard({ taskId, usersById, refreshKey }: Props) {
  return (
    <CrmDocumentsCard
      entityType="task"
      entityId={taskId}
      usersById={usersById}
      refreshKey={refreshKey}
    />
  )
}
