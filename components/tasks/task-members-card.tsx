"use client"

/**
 * Роли в задаче. Постановщик (creator_id, readonly), Исполнитель
 * (responsible_id — в info-карточке, тут не дублируем), Соисполнители
 * (TaskMember.role='co-worker'), Наблюдатели (TaskMember.role='observer').
 *
 * Бэк:
 *   POST /api/admin/tasks/<id>/members         {user_id, role}
 *   DELETE /api/admin/tasks/<id>/members/<uid>
 */

import { useMemo, useState } from "react"
import { UserPlus, X, UserRound, Users, Eye } from "lucide-react"

import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { crmPost, crmDelete } from "@/lib/crm-fetch"

import EntityPickerDialog from "@/components/deals/entity-picker-dialog"

interface TaskMember {
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
  taskId: number
  creatorId: number | null
  responsibleId: number | null
  members: TaskMember[]
  users: Sys[]
  usersById: Map<number, string>
  onChange: () => void
  /**
   * true = отрисовать только содержимое, без внешней `<Card>` обёртки
   * и без заголовка. Нужен для встраивания секции ролей в другую
   * карточку (напр. TaskInfoCard).
   */
  bare?: boolean
}

export default function TaskMembersCard({
  taskId, creatorId, responsibleId, members, users, usersById, onChange, bare,
}: Props) {
  const { toast } = useToast()
  const [addingRole, setAddingRole] = useState<null | "co-worker" | "observer">(null)

  const coworkers = members.filter((m) => m.role === "co-worker")
  const observers = members.filter((m) => m.role === "observer")

  // Юзеры уже задействованные в задаче — их нет смысла добавлять
  // повторно ни в какую роль (UI-уровень; бэк ловит через unique
  // constraint (task_id, user_id)).
  const takenIds = useMemo(() => {
    const s = new Set<number>()
    if (creatorId) s.add(creatorId)
    if (responsibleId) s.add(responsibleId)
    for (const m of members) s.add(m.user_id)
    return s
  }, [creatorId, responsibleId, members])

  const handleAdd = async (uid: number | null) => {
    if (uid == null || !addingRole) return
    try {
      await crmPost(`/api/admin/tasks/${taskId}/members`, {
        user_id: uid,
        role: addingRole,
      })
      toast({
        title: addingRole === "co-worker"
          ? "Соисполнитель добавлен"
          : "Наблюдатель добавлен",
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

  const handleRemove = async (m: TaskMember) => {
    try {
      await crmDelete(`/api/admin/tasks/${taskId}/members/${m.user_id}`)
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось убрать",
        description: e?.message,
      })
    }
  }

  const sections = (
    <>
      <Section icon={UserRound} title="Постановщик">
          {creatorId ? (
            <Chip name={usersById.get(creatorId) ?? `#${creatorId}`} readOnly />
          ) : (
            <div className="text-xs text-gray-400 italic">— система —</div>
          )}
        </Section>

        <Section
          icon={Users}
          title="Соисполнители"
          action={
            <button
              onClick={() => setAddingRole("co-worker")}
              title="Добавить соисполнителя"
              className="h-5 w-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 inline-flex items-center justify-center focus:outline-none"
            >
              <UserPlus className="h-3 w-3" />
            </button>
          }
        >
          {coworkers.length === 0 ? (
            <div className="text-xs text-gray-400 italic">никого</div>
          ) : (
            <div className="space-y-1">
              {coworkers.map((m) => (
                <Chip
                  key={m.id}
                  name={usersById.get(m.user_id) ?? `#${m.user_id}`}
                  onRemove={() => handleRemove(m)}
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          icon={Eye}
          title="Наблюдатели"
          action={
            <button
              onClick={() => setAddingRole("observer")}
              title="Добавить наблюдателя"
              className="h-5 w-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 inline-flex items-center justify-center focus:outline-none"
            >
              <UserPlus className="h-3 w-3" />
            </button>
          }
        >
          {observers.length === 0 ? (
            <div className="text-xs text-gray-400 italic">никого</div>
          ) : (
            <div className="space-y-1">
              {observers.map((m) => (
                <Chip
                  key={m.id}
                  name={usersById.get(m.user_id) ?? `#${m.user_id}`}
                  onRemove={() => handleRemove(m)}
                />
              ))}
            </div>
          )}
        </Section>
    </>
  )

  return (
    <>
      {bare ? (
        // 3 колонки внутри «Информации о задаче» — так секции ролей
        // не растягивают карточку вертикально. На узких экранах
        // (< md) откатываемся в одну колонку.
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sections}
        </div>
      ) : (
        <Card className="rounded-xl border-gray-200 p-3 space-y-2.5">
          <h2 className="text-sm font-semibold text-gray-700">Роли в задаче</h2>
          {sections}
        </Card>
      )}

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
            primary: userName(u),
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
    <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-2 space-y-1.5 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium truncate">
          {title}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Chip({
  name,
  onRemove,
  readOnly,
}: {
  name: string
  onRemove?: () => void
  readOnly?: boolean
}) {
  // Показываем короткую форму «Голохвастов А.» — «фамилия + инициал»,
  // а полное имя оставляем в tooltip. Так в узкой колонке (min-w
  // ~120-140px) ФИО не режется до неузнаваемых «Ва…». Если имя одно
  // слово — оставляем как есть.
  const shortName = compactName(name)
  return (
    <div
      title={name}
      className={`flex w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
        readOnly ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <UserRound className="h-2.5 w-2.5 text-gray-500 shrink-0" />
      <span className="truncate min-w-0 flex-1">{shortName}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 focus:outline-none shrink-0"
          title="Убрать"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

/**
 * Компактная форма ФИО для узких чипов. Формат ввода в проекте —
 * «Фамилия Имя Отчество» (Ф И О):
 *   «Боцан Антон Олегович»           → «Боцан А. О.»
 *   «Голохвастов Алексей Валерьевич» → «Голохвастов А. В.»
 *   «Боцан Антон»                    → «Боцан А.»
 *   «Боцан»                          → «Боцан»
 */
function compactName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return full
  const [surname, ...rest] = parts
  const initials = rest
    .map((p) => p[0].toUpperCase() + ".")
    .join(" ")
  return `${surname} ${initials}`
}

function userName(u: Sys): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}
