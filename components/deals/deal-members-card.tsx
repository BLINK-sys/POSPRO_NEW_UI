"use client"

/**
 * Роли участников сделки. Ответственный (Исполнитель) — показывается в
 * DealInfoCard, тут не дублируем. Тут — три раздела:
 *
 *  • Постановщик — deal.creator_id (readonly). Один человек.
 *  • Соисполнители — DealMember.role = 'participant'. Много.
 *  • Наблюдатели — DealMember.role = 'observer'. Много.
 *
 * Бэк:
 *   POST /api/admin/deals/<id>/members            {user_id, role}
 *   DELETE /api/admin/deals/<id>/members/<uid>
 *
 * Оптимистично добавляем/убираем в родителе через onChange (refetch deal).
 */

import { useMemo, useState } from "react"
import { UserPlus, X, UserRound, Users, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { crmPost, crmDelete } from "@/lib/crm-fetch"

import EntityPickerDialog from "./entity-picker-dialog"

interface DealMember {
  id: number
  user_id: number
  role: string
  added_at: string | null
}

interface Sys {
  id: number
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
}

interface Props {
  dealId: number
  creatorId: number | null
  members: DealMember[]
  users: Sys[]
  usersById: Map<number, string>
  onChange: () => void
}

export default function DealMembersCard({
  dealId, creatorId, members, users, usersById, onChange,
}: Props) {
  const { toast } = useToast()
  const [addingRole, setAddingRole] = useState<null | "participant" | "observer">(null)

  const executors = members.filter((m) => m.role === "participant")
  const observers = members.filter((m) => m.role === "observer")

  const takenIds = useMemo(
    () => new Set(members.map((m) => m.user_id).concat(creatorId ? [creatorId] : [])),
    [members, creatorId],
  )

  const handleAdd = async (uid: number | null) => {
    if (uid == null || !addingRole) return
    try {
      await crmPost(`/api/admin/deals/${dealId}/members`, {
        user_id: uid,
        role: addingRole,
      })
      toast({
        title: addingRole === "participant" ? "Соисполнитель добавлен" : "Наблюдатель добавлен",
      })
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось добавить",
        description: e?.message,
      })
    } finally {
      setAddingRole(null)
    }
  }

  const handleRemove = async (m: DealMember) => {
    try {
      await crmDelete(`/api/admin/deals/${dealId}/members/${m.user_id}`)
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось убрать",
        description: e?.message,
      })
    }
  }

  return (
    <>
      <Card className="rounded-xl border-gray-200 p-3 space-y-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Роли в сделке</h2>

        {/* Постановщик — readonly. */}
        <Section icon={UserRound} title="Постановщик">
          {creatorId ? (
            <MemberChip
              name={usersById.get(creatorId) ?? `#${creatorId}`}
              readOnly
            />
          ) : (
            <div className="text-xs text-gray-400 italic">— система —</div>
          )}
        </Section>

        {/* Соисполнители — many. */}
        <Section
          icon={Users}
          title="Соисполнители"
          action={
            <button
              onClick={() => setAddingRole("participant")}
              className="text-[11px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-0.5 focus:outline-none"
            >
              <UserPlus className="h-3 w-3" /> добавить
            </button>
          }
        >
          {executors.length === 0 ? (
            <div className="text-xs text-gray-400 italic">никого</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {executors.map((m) => (
                <MemberChip
                  key={m.id}
                  name={usersById.get(m.user_id) ?? `#${m.user_id}`}
                  onRemove={() => handleRemove(m)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Наблюдатели — many. */}
        <Section
          icon={Eye}
          title="Наблюдатели"
          action={
            <button
              onClick={() => setAddingRole("observer")}
              className="text-[11px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-0.5 focus:outline-none"
            >
              <UserPlus className="h-3 w-3" /> добавить
            </button>
          }
        >
          {observers.length === 0 ? (
            <div className="text-xs text-gray-400 italic">никого</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {observers.map((m) => (
                <MemberChip
                  key={m.id}
                  name={usersById.get(m.user_id) ?? `#${m.user_id}`}
                  onRemove={() => handleRemove(m)}
                />
              ))}
            </div>
          )}
        </Section>
      </Card>

      <EntityPickerDialog
        open={addingRole !== null}
        onOpenChange={(v) => !v && setAddingRole(null)}
        title={addingRole === "observer" ? "Добавить наблюдателя" : "Добавить соисполнителя"}
        searchPlaceholder="Поиск по имени / email"
        emptyText="Нет свободных пользователей"
        allowClear={false}
        value={null}
        onChange={handleAdd}
        items={users
          .filter((u) => !takenIds.has(u.id))
          .map((u) => ({
            id: u.id,
            primary: userDisplayName(u),
            secondary: u.email,
          }))}
      />
    </>
  )
}

// ============================================================================

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: any
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-normal">
          {title}
        </div>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  )
}

function MemberChip({
  name,
  onRemove,
  readOnly,
}: {
  name: string
  onRemove?: () => void
  readOnly?: boolean
}) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
      readOnly ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
    }`}>
      <UserRound className="h-2.5 w-2.5 text-gray-500" />
      <span className="truncate max-w-[160px]">{name}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 focus:outline-none"
          title="Убрать"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function userDisplayName(u: Sys): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}
