"use client"

/**
 * Правая колонка карточки сделки — встроенный чат. Тонкая обёртка над
 * общим `CrmChatPanel`: разница со задачей — только endpoint комнаты и
 * тексты в шапке.
 */

import CrmChatPanel from "@/components/crm/crm-chat-panel"

interface Props {
  dealId: number
  currentUserId: number | null
  usersById: Map<number, string>
  onAttachmentUploaded?: () => void
}

export default function DealChatPanel({
  dealId, currentUserId, usersById, onAttachmentUploaded,
}: Props) {
  return (
    <CrmChatPanel
      chatRoomEndpoint={`/api/admin/deals/${dealId}/chat-room`}
      currentUserId={currentUserId}
      usersById={usersById}
      title="Чат сделки"
      subtitle="Виден Ответственному, Постановщику, Соисполнителям и Наблюдателям"
      emptyText="Чат для этой сделки не создан"
      onAttachmentUploaded={onAttachmentUploaded}
    />
  )
}
