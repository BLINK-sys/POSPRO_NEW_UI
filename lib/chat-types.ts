/**
 * Типы CRM-мессенджера. Соответствуют ответам `pospro_new_server`
 * routes/chat.py.
 */

export type ChatRoomKind = "general" | "direct" | "group" | "deal" | "task"

export interface ChatAttachment {
  id: number
  file_url: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
}

export interface ChatReactionGroup {
  emoji: string
  user_ids: number[]
}

export interface ChatMessage {
  id: number
  room_id: number
  author_id: number | null
  text: string | null
  reply_to_id: number | null
  created_at: string | null
  edited_at: string | null
  deleted_at: string | null
  pinned_at?: string | null
  pinned_by?: number | null
  reactions?: ChatReactionGroup[]
  attachments?: ChatAttachment[]
}

/** Компактная сводка комнаты для списка в сайдбаре. */
export interface ChatRoomSummary {
  id: number
  kind: ChatRoomKind
  name: string | null
  related_deal_id: number | null
  related_task_id: number | null
  /** Чат сохранил историю удалённой сделки/задачи — read-only. */
  is_archived: boolean
  archived_at: string | null
  created_at: string | null
  updated_at: string | null
  last_message: ChatMessage | null
  unread: number
}

export interface ChatMember {
  id: number
  user_id: number
  role?: string
  joined_at: string | null
  last_read_at: string | null
}

/**
 * Стандартный набор эмодзи для реакций. Бэк ограничивает 16 символами
 * (`chat_reaction.emoji VARCHAR 16`), UI держит фикс-6, чтобы не
 * плодить весь юникод.
 */
export const REACTION_EMOJI = ["👍", "❤️", "🎉", "😄", "😢", "👎"] as const

export type ReactionEmoji = (typeof REACTION_EMOJI)[number]
