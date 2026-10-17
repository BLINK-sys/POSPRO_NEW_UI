"use client"

/**
 * Правая колонка карточки задачи — встроенный чат. Тонкая обёртка над
 * общим `CrmChatPanel`; endpoint комнаты — `/admin/tasks/<id>/chat-room`
 * (создаётся ленивой инициализацией).
 */

import CrmChatPanel from "@/components/crm/crm-chat-panel"

interface Props {
  taskId: number
  currentUserId: number | null
  usersById: Map<number, string>
  onAttachmentUploaded?: () => void
}

export default function TaskChatPanel({
  taskId, currentUserId, usersById, onAttachmentUploaded,
}: Props) {
  return (
    <CrmChatPanel
      chatRoomEndpoint={`/api/admin/tasks/${taskId}/chat-room`}
      currentUserId={currentUserId}
      usersById={usersById}
      title="Чат задачи"
      subtitle="Виден Постановщику, Исполнителю, Соисполнителям и Наблюдателям"
      emptyText="Чат для этой задачи не создан"
      onAttachmentUploaded={onAttachmentUploaded}
    />
  )
}
