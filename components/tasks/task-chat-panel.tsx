"use client"

/**
 * Правая колонка карточки задачи — встроенный чат. Тонкая обёртка над
 * общим `CrmChatPanel`; endpoint комнаты — `/admin/tasks/<id>/chat-room`.
 *
 * «Свёрнутое» состояние чата рисует не этот компонент, а родительский
 * TaskDetail — там выводится горизонтальная плашка «Обсуждения» под
 * основным гридом (вместо третьей колонки). Этот компонент знает
 * только про полный, развёрнутый вид.
 */

import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"

import CrmChatPanel from "@/components/crm/crm-chat-panel"

interface Props {
  taskId: number
  currentUserId: number | null
  usersById: Map<number, string>
  onAttachmentUploaded?: () => void
  onCollapse?: () => void
}

export default function TaskChatPanel({
  taskId, currentUserId, usersById, onAttachmentUploaded, onCollapse,
}: Props) {
  return (
    <div className="relative h-full">
      {onCollapse && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          className="absolute top-2 right-2 z-10 rounded-full h-8 w-8 bg-brand-yellow hover:bg-yellow-500 text-black shadow-sm"
          title="Свернуть обсуждения"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
      <CrmChatPanel
        chatRoomEndpoint={`/api/admin/tasks/${taskId}/chat-room`}
        currentUserId={currentUserId}
        usersById={usersById}
        title="Чат задачи"
        subtitle="Виден Постановщику, Исполнителю, Соисполнителям и Наблюдателям"
        emptyText="Чат для этой задачи не создан"
        onAttachmentUploaded={onAttachmentUploaded}
      />
    </div>
  )
}
