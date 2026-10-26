"use client"

/**
 * Правая колонка карточки сделки — встроенный чат. Тонкая обёртка над
 * общим `CrmChatPanel`: разница со задачей — только endpoint комнаты и
 * тексты в шапке.
 *
 * «Свёрнутое» состояние чата рисует не этот компонент, а родительский
 * DealDetail — там на место чата подставляется карточка Информация,
 * а под средней колонкой выводится маленькая кнопка «Обсуждения».
 */

import CrmChatPanel from "@/components/crm/crm-chat-panel"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"

interface Props {
  dealId: number
  currentUserId: number | null
  usersById: Map<number, string>
  onAttachmentUploaded?: () => void
  onCollapse?: () => void
}

export default function DealChatPanel({
  dealId, currentUserId, usersById, onAttachmentUploaded, onCollapse,
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
        chatRoomEndpoint={`/api/admin/deals/${dealId}/chat-room`}
        currentUserId={currentUserId}
        usersById={usersById}
        title="Чат сделки"
        subtitle="Виден Ответственному, Постановщику, Соисполнителям и Наблюдателям"
        emptyText="Чат для этой сделки не создан"
        onAttachmentUploaded={onAttachmentUploaded}
      />
    </div>
  )
}
