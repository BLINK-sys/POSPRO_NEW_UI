"use client"

/**
 * Карточка «Полная информация о сделке» в левой колонке /admin/deals/[id].
 *
 * Показывает и позволяет редактировать: название, клиента (через
 * EntityPickerDialog), ответственного (тоже пикер, отдельная кнопка
 * «Назначить» если пусто), сумму + валюту, приоритет, дату закрытия
 * и заметки. Стадия и статус — в шапке страницы, тут не дублируем.
 *
 * Управление dirty-состоянием — снаружи (deal-detail), сюда прилетает
 * `draft` + `setDraft`. Так родитель может собирать общий «Сохранить»
 * или сохранять по blur — пока делаем кнопкой в углу карточки, как
 * было раньше в «Обзоре».
 */

import { useState } from "react"
import { Loader2, Save, User, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import EntityPickerDialog from "./entity-picker-dialog"
import ClientPickerDialog from "./client-picker-dialog"
import type { Deal } from "@/lib/deals-types"

interface Client {
  id: number
  display_name: string
  full_name?: string | null
  object?: string | null
  contacts?: { phone?: string; note?: string }[]
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
  deal: Deal
  draft: Partial<Deal>
  onDraft: (patch: Partial<Deal>) => void
  onSave: () => Promise<void> | void
  saving: boolean
  isDirty: boolean

  clients: Client[]
  users: Sys[]
  clientsById: Map<number, string>
  usersById: Map<number, string>
  creatorId: number | null
}

const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 " +
  "focus-visible:!ring-offset-0 focus:!outline-none " +
  "focus-visible:!outline-none data-[state=open]:!ring-0 " +
  "data-[state=open]:!ring-offset-0"

export default function DealInfoCard({
  deal, draft, onDraft, onSave, saving, isDirty,
  clients, users, clientsById, usersById,
}: Props) {
  const [clientPicker, setClientPicker] = useState(false)
  const [respPicker, setRespPicker] = useState(false)

  const clientName = draft.client_id != null
    ? clientsById.get(draft.client_id) ?? `Клиент #${draft.client_id}`
    : null
  const respName = draft.responsible_user_id != null
    ? usersById.get(draft.responsible_user_id) ?? `#${draft.responsible_user_id}`
    : null

  return (
    <>
      <Card className="rounded-xl border-gray-200 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Информация о сделке</h2>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!isDirty || saving}
            className="bg-brand-yellow text-black hover:bg-yellow-500 h-7 px-2.5 text-xs"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            <Save className="h-3.5 w-3.5 mr-1" />
            Сохранить
          </Button>
        </div>

        <FieldRow label="Название">
          <Input
            className={`${NO_RING} h-8 text-sm`}
            value={draft.name ?? ""}
            onChange={(e) => onDraft({ name: e.target.value })}
          />
        </FieldRow>

        <FieldRow label="Клиент">
          <PickerControl
            value={clientName}
            placeholder="Не выбран"
            onOpen={() => setClientPicker(true)}
            onClear={draft.client_id != null ? () => onDraft({ client_id: null }) : undefined}
          />
        </FieldRow>

        <FieldRow label="Ответственный">
          <PickerControl
            value={respName}
            placeholder="Не назначен"
            onOpen={() => setRespPicker(true)}
            onClear={draft.responsible_user_id != null ? () => onDraft({ responsible_user_id: null }) : undefined}
            ctaWhenEmpty="Назначить"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Сумма">
            <div className="flex gap-1">
              <Input
                className={`${NO_RING} h-8 text-sm`}
                type="number"
                inputMode="decimal"
                value={draft.amount ?? ""}
                onChange={(e) => onDraft({
                  amount: e.target.value ? Number(e.target.value) : null,
                })}
              />
              <Input
                className={`${NO_RING} h-8 w-14 text-center text-sm`}
                value={draft.currency ?? "KZT"}
                onChange={(e) => onDraft({ currency: e.target.value.toUpperCase() })}
                maxLength={4}
              />
            </div>
          </FieldRow>
          <FieldRow label="Приоритет">
            <Select
              value={draft.priority ?? "normal"}
              onValueChange={(v) => onDraft({ priority: v as any })}
            >
              <SelectTrigger className={`${NO_RING} h-8 text-sm`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Низкий</SelectItem>
                <SelectItem value="normal">Обычный</SelectItem>
                <SelectItem value="high">Высокий</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        <FieldRow label="Ожидаемая дата закрытия">
          <Input
            className={`${NO_RING} h-8 text-sm`}
            type="date"
            value={
              draft.expected_close_at
                ? String(draft.expected_close_at).slice(0, 10)
                : ""
            }
            onChange={(e) => onDraft({
              expected_close_at: e.target.value
                ? new Date(e.target.value).toISOString()
                : null,
            })}
          />
        </FieldRow>

        <div className="text-[11px] text-gray-400 -mt-1">
          Создана: {new Date(deal.created_at).toLocaleString("ru-RU")}
        </div>

        <FieldRow label="Заметки">
          <Textarea
            className={`${NO_RING} text-sm`}
            rows={3}
            value={draft.notes ?? ""}
            onChange={(e) => onDraft({ notes: e.target.value })}
            placeholder="Контекст, договорённости, важные детали…"
          />
        </FieldRow>

        {deal.source_ref_type && (
          <div className="text-[11px] text-gray-500 border-t pt-2">
            Из источника{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded">
              {deal.source_ref_type}
            </code>
            {deal.source_ref_id && (
              <>
                {" · "}
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  {deal.source_ref_id}
                </code>
              </>
            )}
          </div>
        )}
      </Card>

      <ClientPickerDialog
        open={clientPicker}
        onOpenChange={setClientPicker}
        clients={clients}
        value={draft.client_id ?? null}
        onChange={(id) => onDraft({ client_id: id })}
        allowClear
      />

      <EntityPickerDialog
        open={respPicker}
        onOpenChange={setRespPicker}
        title="Выбрать ответственного"
        searchPlaceholder="Поиск по имени / email"
        emptyText="Пользователи не найдены"
        value={draft.responsible_user_id ?? null}
        onChange={(id) => onDraft({ responsible_user_id: id })}
        allowClear
        items={users.map((u) => ({
          id: u.id,
          primary: userDisplayName(u),
          secondary: u.email,
        }))}
      />
    </>
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

function PickerControl({
  value,
  placeholder,
  onOpen,
  onClear,
  ctaWhenEmpty,
}: {
  value: string | null
  placeholder: string
  onOpen: () => void
  onClear?: () => void
  ctaWhenEmpty?: string
}) {
  if (value) {
    return (
      <div className="flex items-center gap-1 border border-gray-200 rounded-md px-2 py-1 bg-white h-8">
        <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <div className="text-sm flex-1 min-w-0 truncate">{value}</div>
        <button
          onClick={onOpen}
          className="text-[11px] text-gray-500 hover:text-gray-900 px-1 focus:outline-none"
        >
          сменить
        </button>
        {onClear && (
          <button
            onClick={onClear}
            className="text-gray-400 hover:text-red-500 focus:outline-none"
            title="Убрать"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
  return (
    <Button
      variant="outline"
      onClick={onOpen}
      className="w-full justify-start text-gray-500 font-normal h-8 text-sm"
    >
      <User className="h-3.5 w-3.5 mr-1.5" />
      {ctaWhenEmpty || placeholder}
    </Button>
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
