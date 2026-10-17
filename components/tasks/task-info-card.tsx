"use client"

/**
 * Левая колонка карточки задачи — редактируемая информация.
 * Заголовок / описание / приоритет / срок / исполнитель / привязка.
 *
 * Привязка (проект/сделка) взаимоисключается на уровне UI: показываем
 * тумблер из трёх положений (без / сделка / проект), при переключении
 * второе поле сбрасывается.
 */

import { useMemo, useState } from "react"
import { Loader2, Save, Briefcase, FolderKanban, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PRIORITY_META, type TaskFull, type TaskPriority } from "@/lib/tasks-types"
import type { Project } from "@/lib/projects-types"

import TaskMembersCard from "./task-members-card"
import DealCreateDialog from "@/components/deals/deal-create-dialog"
import ProjectCreateDialog from "@/components/projects/project-create-dialog"
import EntityPickerDialog from "@/components/deals/entity-picker-dialog"

interface Sys {
  id: number
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
}

interface DealLite {
  id: number
  name: string
}

interface Props {
  task: TaskFull
  draft: Partial<TaskFull>
  onDraft: (patch: Partial<TaskFull>) => void
  onSave: () => Promise<void> | void
  saving: boolean
  isDirty: boolean
  users: Sys[]
  projects: Project[]
  deals: DealLite[]
  usersById: Map<number, string>
  /**
   * Синк ролей (соисп./наблюдатели) идёт своим потоком через
   * TaskMembersCard, но родитель должен перезапросить задачу когда
   * оттуда пришёл change — прокидываем тот же reload что и у
   * documents/checklist.
   */
  onRolesChange: () => void
  /**
   * После создания «на лету» новой сделки/проекта из блока «Привязка»
   * родитель должен добавить сущность в свои списки, чтобы select
   * тут же смог её показать выбранной.
   */
  onDealCreated: (deal: DealLite) => void
  onProjectCreated: (project: Project) => void
}

const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 " +
  "focus-visible:!ring-offset-0 focus:!outline-none " +
  "focus-visible:!outline-none data-[state=open]:!ring-0 " +
  "data-[state=open]:!ring-offset-0"

export default function TaskInfoCard({
  task, draft, onDraft, onSave, saving, isDirty,
  users, projects, deals, usersById, onRolesChange,
  onDealCreated, onProjectCreated,
}: Props) {
  const [dealCreateOpen, setDealCreateOpen] = useState(false)
  const [projectCreateOpen, setProjectCreateOpen] = useState(false)
  const [dealPickerOpen, setDealPickerOpen] = useState(false)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)

  // Задача может быть привязана и к сделке, И к проекту одновременно —
  // два независимых блока «Привязка» без тумблера.
  const selectedDealName = useMemo(
    () => deals.find((d) => d.id === draft.deal_id)?.name ?? null,
    [deals, draft.deal_id],
  )
  const selectedProjectName = useMemo(
    () => projects.find((p) => p.id === draft.project_id)?.name ?? null,
    [projects, draft.project_id],
  )
  return (
    <Card className="rounded-xl border-gray-200 p-3 space-y-2.5">
      {/* Кнопка «Сохранить» перенесена в шапку страницы (task-detail
          header), чтобы быть на уровне «Завершить» / статуса. */}
      <FieldRow label="Заголовок">
        <Input
          className={`${NO_RING} h-8 text-sm`}
          value={draft.title ?? ""}
          onChange={(e) => onDraft({ title: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Описание">
        <Textarea
          className={`${NO_RING} text-sm`}
          rows={4}
          value={draft.description ?? ""}
          onChange={(e) => onDraft({ description: e.target.value })}
          placeholder="Что нужно сделать, контекст, детали…"
        />
      </FieldRow>

      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Приоритет">
          <Select
            value={draft.priority ?? "normal"}
            onValueChange={(v) => onDraft({ priority: v as TaskPriority })}
          >
            <SelectTrigger className={`${NO_RING} h-8 text-sm`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Крайний срок">
          <DateTimePicker
            value={draft.due_at ?? null}
            onChange={(iso) => onDraft({ due_at: iso })}
            withTime
            placeholder="Не задан"
          />
        </FieldRow>
      </div>

      <FieldRow label="Исполнитель">
        <Select
          value={draft.responsible_id ? String(draft.responsible_id) : "none"}
          onValueChange={(v) => onDraft({ responsible_id: v === "none" ? null : Number(v) })}
        >
          <SelectTrigger className={`${NO_RING} h-8 text-sm`}>
            <SelectValue placeholder="Не назначен" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Не назначен —</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>{userName(u)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      {/* Роли: Постановщик readonly, Соисполнители, Наблюдатели —
          встроены в карточку информации между Исполнителем и Привязкой
          по запросу UX. Компонент TaskMembersCard в bare-режиме без
          собственной обёртки и заголовка. */}
      <div className="pt-2 border-t border-gray-100">
        <TaskMembersCard
          bare
          taskId={task.id}
          creatorId={task.creator_id ?? null}
          responsibleId={task.responsible_id ?? null}
          members={task.members ?? []}
          users={users}
          usersById={usersById}
          onChange={onRolesChange}
        />
      </div>

      {/* Привязка: сделка И проект — независимы. Можно поставить оба
          сразу, оба, ни одного. Каждый блок — pick + create + clear. */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <BindingRow
          icon={Briefcase}
          label="Сделка"
          selectedName={selectedDealName}
          pickPlaceholder="Выберите сделку"
          onPick={() => setDealPickerOpen(true)}
          onCreate={() => setDealCreateOpen(true)}
          onClear={draft.deal_id != null ? () => onDraft({ deal_id: null }) : undefined}
          createTitle="Создать новую сделку"
        />
        <BindingRow
          icon={FolderKanban}
          label="Проект"
          selectedName={selectedProjectName}
          pickPlaceholder="Выберите проект"
          onPick={() => setProjectPickerOpen(true)}
          onCreate={() => setProjectCreateOpen(true)}
          onClear={draft.project_id != null ? () => onDraft({ project_id: null }) : undefined}
          createTitle="Создать новый проект"
        />
      </div>

      {/* Пикеры и модалки создания. Оставляем отрисовку вне
          основного дерева `<Card>`, чтобы Portal не влиял на layout. */}
      <EntityPickerDialog
        open={dealPickerOpen}
        onOpenChange={setDealPickerOpen}
        title="Выбрать сделку"
        searchPlaceholder="Поиск по названию"
        emptyText="Сделок не найдено"
        value={draft.deal_id ?? null}
        onChange={(id) => onDraft({ deal_id: id })}
        allowClear
        items={deals.map((d) => ({ id: d.id, primary: d.name }))}
      />
      <EntityPickerDialog
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        title="Выбрать проект"
        searchPlaceholder="Поиск по названию"
        emptyText="Проектов не найдено"
        value={draft.project_id ?? null}
        onChange={(id) => onDraft({ project_id: id })}
        allowClear
        items={projects.map((p) => ({
          id: p.id,
          primary: p.name,
          secondary: p.description || undefined,
        }))}
      />
      <DealCreateDialog
        open={dealCreateOpen}
        onOpenChange={setDealCreateOpen}
        onCreated={(deal) => {
          onDealCreated({ id: deal.id, name: deal.name })
          onDraft({ deal_id: deal.id })
          setDealCreateOpen(false)
        }}
      />
      <ProjectCreateDialog
        open={projectCreateOpen}
        onOpenChange={setProjectCreateOpen}
        onCreated={(p) => {
          onProjectCreated(p)
          onDraft({ project_id: p.id })
          setProjectCreateOpen(false)
        }}
      />

      <div className="text-[11px] text-gray-400 pt-1 border-t border-gray-100">
        Создана: {task.created_at ? new Date(task.created_at).toLocaleString("ru-RU") : "—"}
      </div>
    </Card>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-normal">
        {label}
      </Label>
      {children}
    </div>
  )
}

/**
 * Одна строка блока «Привязка»: иконка + label, кнопка выбора сущности
 * (с текущим именем или placeholder'ом), «+» для быстрого создания,
 * «×» для сброса. Используется дважды — для сделки и для проекта,
 * они независимы друг от друга.
 */
function BindingRow({
  icon: Icon,
  label,
  selectedName,
  pickPlaceholder,
  onPick,
  onCreate,
  onClear,
  createTitle,
}: {
  icon: any
  label: string
  selectedName: string | null
  pickPlaceholder: string
  onPick: () => void
  onCreate: () => void
  onClear?: () => void
  createTitle: string
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-normal inline-flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPick}
          className="flex-1 h-8 rounded-md border border-gray-200 bg-white px-3 text-sm text-left truncate min-w-0"
        >
          {selectedName || <span className="text-gray-400">{pickPlaceholder}</span>}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="h-8 w-8 rounded-md border border-gray-200 bg-white text-gray-400 hover:text-red-500 inline-flex items-center justify-center shrink-0"
            title="Убрать привязку"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCreate}
          className="h-8 px-2 shrink-0"
          title={createTitle}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
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

/**
 * ISO 8601 (UTC) → `YYYY-MM-DDTHH:mm` для `<input type=datetime-local>`.
 * Учитываем локальную tz — input показывает локальное время.
 */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60 * 1000)
  return local.toISOString().slice(0, 16)
}
