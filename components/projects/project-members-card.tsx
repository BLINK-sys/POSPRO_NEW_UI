"use client"

/**
 * Участники проекта — это computed-список на бэке: все, у кого в проекте
 * есть хотя бы одна задача (как responsible / creator / co-worker /
 * observer), плюс сам owner проекта. Ручного добавления больше нет —
 * стал участником тот, кому выдали задачу в проекте.
 *
 * Для каждого — один переключатель видимости:
 *   «Только свои задачи»      (default) — видит только свои карточки
 *                              на канбане проекта, без фильтра.
 *   «Все задачи проекта»       — видит все карточки + получает фильтр
 *                              «Менеджер» на канбане (в самом канбане).
 *
 * Карточка видна только тем, кто может настраивать проект (owner /
 * can_manage_projects / project.owner — см. `canManage`).
 */

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Crown, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { crmPut } from "@/lib/crm-fetch"
import { type ProjectMember } from "@/lib/projects-types"

export default function ProjectMembersCard({
  projectId, members, canManage, onChange,
}: {
  projectId: number
  members: ProjectMember[]
  canManage: boolean
  onChange: () => void
}) {
  const { toast } = useToast()
  // Оптимистичный «in-flight» id, чтобы не мигать выключателем.
  const [savingId, setSavingId] = useState<number | null>(null)

  const handleToggle = async (m: ProjectMember, next: boolean) => {
    setSavingId(m.user_id)
    try {
      await crmPut(`/api/admin/projects/${projectId}/members/${m.user_id}`, {
        can_see_all_tasks: next,
      })
      onChange()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card className="rounded-xl border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            Участники · {members.length}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Автосписок: кто участвует в задачах проекта. Удалять/добавлять
            не нужно — всё по задачам.
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="text-xs text-gray-400 italic text-center py-8">
          В проекте пока нет задач — и, соответственно, нет участников.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {members.map((m) => {
            const seesAll = !!m.can_see_all_tasks
            const disabled = !canManage || savingId === m.user_id
            // Owner и так всегда видит всё — переключатель не трогаем,
            // показываем короной + явной подписью «видит всё».
            const ownerLock = m.is_owner
            return (
              <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                <div className="h-7 w-7 rounded-full bg-brand-yellow/60 text-[11px] font-semibold flex items-center justify-center shrink-0 text-black">
                  {(m.full_name[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {m.full_name}
                    {m.is_owner && (
                      <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" title="Владелец проекта" />
                    )}
                  </div>
                  {m.email && (
                    <div className="text-[11px] text-gray-500 truncate">{m.email}</div>
                  )}
                </div>

                {ownerLock ? (
                  <span className="text-[11px] text-gray-500 italic">
                    видит все задачи
                  </span>
                ) : (
                  // Простой пилл-свитч: два варианта в одной капсуле.
                  // Активный — brand-yellow, неактивный — ghost.
                  <div
                    className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 text-xs shrink-0"
                    title={seesAll
                      ? "Видит все задачи проекта + фильтр менеджеров"
                      : "Видит только свои задачи"
                    }
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => !seesAll ? null : handleToggle(m, false)}
                      className={`rounded-full px-2.5 h-7 inline-flex items-center gap-1 transition-colors ${
                        !seesAll
                          ? "bg-brand-yellow text-black font-medium"
                          : "text-gray-600 hover:text-gray-900"
                      } ${disabled ? "opacity-70" : ""}`}
                    >
                      <EyeOff className="h-3 w-3" />
                      Только свои
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => seesAll ? null : handleToggle(m, true)}
                      className={`rounded-full px-2.5 h-7 inline-flex items-center gap-1 transition-colors ${
                        seesAll
                          ? "bg-brand-yellow text-black font-medium"
                          : "text-gray-600 hover:text-gray-900"
                      } ${disabled ? "opacity-70" : ""}`}
                    >
                      <Eye className="h-3 w-3" />
                      Все задачи
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
