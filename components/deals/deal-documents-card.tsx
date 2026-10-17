"use client"

/**
 * Документы сделки — тонкая обёртка над общим `CrmDocumentsCard`.
 * См. CrmDocumentsCard за подробностями API и превью изображений.
 */

import CrmDocumentsCard from "@/components/crm/crm-documents-card"

interface Props {
  dealId: number
  usersById: Map<number, string>
  /** См. CrmDocumentsCard.refreshKey — внешний триггер refetch. */
  refreshKey?: number
}

export default function DealDocumentsCard({ dealId, usersById, refreshKey }: Props) {
  return (
    <CrmDocumentsCard
      entityType="deal"
      entityId={dealId}
      usersById={usersById}
      refreshKey={refreshKey}
    />
  )
}
