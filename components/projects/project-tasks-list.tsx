"use client"

/**
 * Простой список задач проекта. Используется как alternative-view
 * к канбану. Клик по строке → переход на карточку задачи.
 */

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { AlertTriangle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  type ProjectStage, type TaskStageStatus, STAGE_STATUS_META,
} from "@/lib/projects-types"

interface TaskLite {
  id: number
  title: string
  status: TaskStageStatus
  priority: string
  responsible_id: number | null
  project_stage_id: number | null
  due_at: string | null
  completed_at: string | null
}

export default function ProjectTasksList({
  tasks, stages, usersById,
}: {
  tasks: TaskLite[]
  stages: ProjectStage[]
  usersById: Map<number, string>
}) {
  const stagesById = new Map(stages.map((s) => [s.id, s]))

  if (tasks.length === 0) {
    return (
      <Card className="rounded-xl border-gray-200 p-6 text-center text-sm text-gray-500">
        В проекте пока нет задач. Создай задачу и выбери этот проект в
        её поле «Проект».
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2">Задача</th>
            <th className="text-left px-3 py-2">Колонка</th>
            <th className="text-left px-3 py-2">Исполнитель</th>
            <th className="text-left px-3 py-2">Срок</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((t) => {
            const stage = t.project_stage_id ? stagesById.get(t.project_stage_id) : null
            const statusMeta = STAGE_STATUS_META[t.status]
            const overdue =
              t.due_at &&
              t.status !== "done" &&
              new Date(t.due_at).getTime() < Date.now()
            return (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/tasks/${t.id}`}
                    className="font-medium text-gray-900 hover:text-brand-yellow"
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {stage ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: stage.color + "22", color: stage.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-2">
                    ({statusMeta.label})
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {t.responsible_id ? (usersById.get(t.responsible_id) ?? `#${t.responsible_id}`) : "—"}
                </td>
                <td className={cn(
                  "px-3 py-2 text-gray-700",
                  overdue && "text-red-600 font-medium",
                )}>
                  {t.due_at ? (
                    <span className="inline-flex items-center gap-1">
                      {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {new Date(t.due_at).toLocaleDateString("ru-RU")}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
