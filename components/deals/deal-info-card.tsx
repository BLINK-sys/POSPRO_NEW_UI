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

import React, { useState } from "react"
import { ExternalLink, Loader2, Plus, Save, User, X } from "lucide-react"

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
import { useAuth } from "@/context/auth-context"
import EntityPickerDialog from "./entity-picker-dialog"
import ClientPickerDialog from "./client-picker-dialog"
import CompanyPickerDialog from "./company-picker-dialog"
import DealSourceQuickCreateDialog from "./deal-source-quick-create"
import KpCompanyQuickCreateDialog from "./kp-company-quick-create"
import KpClientQuickCreateDialog from "./kp-client-quick-create"
import { cn } from "@/lib/utils"
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

interface DealSourceLite {
  id: number
  name: string
  color: string | null
  is_active: boolean
}

interface CompanyLite {
  id: number
  name: string
  bin?: string | null
}

interface Props {
  deal: Deal
  draft: Partial<Deal>
  onDraft: (patch: Partial<Deal>) => void
  // onSave / saving / isDirty — теперь у шапки страницы (deal-detail header),
  // в самой карточке кнопки «Сохранить» нет. Оставляем в Props как hint
  // deal-detail на то что dirty-state здесь обрабатывается.
  saving: boolean
  isDirty: boolean

  clients: Client[]
  users: Sys[]
  sources: DealSourceLite[]
  companies: CompanyLite[]
  onSourceCreated?: (source: DealSourceLite) => void
  onCompanyCreated?: (company: CompanyLite) => void
  onClientCreated?: (client: Client) => void
  clientsById: Map<number, string>
  usersById: Map<number, string>
  creatorId: number | null
  // Доп. контакты сделки (primary + остальные). Приходят из бэка в
  // `deal.contacts[]`. Передаём отдельно, т.к. deal_detail держит эти
  // данные синхронизированными с текущим состоянием сервера.
  extraContactIds: number[]
  onExtraContactsChange: (ids: number[]) => void
}

const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 " +
  "focus-visible:!ring-offset-0 focus:!outline-none " +
  "focus-visible:!outline-none data-[state=open]:!ring-0 " +
  "data-[state=open]:!ring-offset-0"

export default function DealInfoCard({
  deal, draft, onDraft,
  clients, users, sources, companies,
  onSourceCreated, onCompanyCreated, onClientCreated,
  clientsById, usersById,
  extraContactIds, onExtraContactsChange,
}: Props) {
  const [clientPicker, setClientPicker] = useState(false)
  const [respPicker, setRespPicker] = useState(false)
  const [sourcePicker, setSourcePicker] = useState(false)
  const [sourceCreateOpen, setSourceCreateOpen] = useState(false)
  const [companyPicker, setCompanyPicker] = useState(false)
  const [companyCreateOpen, setCompanyCreateOpen] = useState(false)
  const [extraContactPicker, setExtraContactPicker] = useState(false)
  const [clientCreateOpen, setClientCreateOpen] = useState(false)
  // Для кого открываем create-клиент диалог: 'primary' → основной контакт,
  // 'extra' → добавить в доп. список. Разделяем, чтобы onCreated понял куда
  // привязать нового клиента.
  const [clientCreateTarget, setClientCreateTarget] = useState<"primary" | "extra">("primary")
  const { user } = useAuth()
  // Квик-плюсик для создания источника — только owner/can_manage_pipelines,
  // чтобы обычный менеджер не ловил 403 и не видел бесполезную кнопку.
  const canCreateSource = Boolean(user && (user.is_owner || user.can_manage_pipelines))

  const clientName = draft.client_id != null
    ? clientsById.get(draft.client_id) ?? `Клиент #${draft.client_id}`
    : null
  const respName = draft.responsible_user_id != null
    ? usersById.get(draft.responsible_user_id) ?? `#${draft.responsible_user_id}`
    : null
  const companyObj = (draft as any).company_id != null
    ? companies.find((c) => c.id === (draft as any).company_id)
    : null

  return (
    <>
      <Card className="rounded-xl border-gray-200 p-3 space-y-2.5">
        <FieldRow label="Название">
          <Input
            className={`${NO_RING} h-8 text-sm`}
            value={draft.name ?? ""}
            onChange={(e) => onDraft({ name: e.target.value })}
          />
        </FieldRow>

        {/* Компания — первой. Квик-создание — внутри модалки «Выбрать
            компанию» (жёлтая кнопка «Создать» справа от поиска). */}
        <FieldRow label="Компания">
          <PickerControl
            value={companyObj?.name ?? null}
            placeholder="Не указана"
            onOpen={() => setCompanyPicker(true)}
            onClear={(draft as any).company_id != null
              ? () => onDraft({ company_id: null } as any)
              : undefined}
          />
        </FieldRow>

        {/* Контакты в 2 колонки: слева основной, справа доп. Квик-создание
            контакта — внутри модалки «Выбрать клиента». */}
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Основной контакт">
            <PickerControl
              value={clientName}
              placeholder="Не выбран"
              onOpen={() => setClientPicker(true)}
              onClear={draft.client_id != null ? () => onDraft({ client_id: null }) : undefined}
            />
          </FieldRow>

          <FieldRow label="Доп. контакты">
            <div className="flex flex-wrap items-center gap-1 min-h-8">
              {extraContactIds.length === 0 && (
                <span className="text-xs text-gray-400 self-center">—</span>
              )}
              {extraContactIds.map((cid) => {
                const n = clientsById.get(cid) ?? `#${cid}`
                return (
                  <span
                    key={cid}
                    className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-full pl-2 pr-1 py-0.5 text-xs"
                  >
                    <span className="truncate max-w-[120px]" title={n}>{n}</span>
                    <button
                      type="button"
                      onClick={() => onExtraContactsChange(extraContactIds.filter((x) => x !== cid))}
                      className="h-4 w-4 inline-flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full"
                      aria-label="Убрать"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExtraContactPicker(true)}
                className="h-6 px-2 text-xs rounded-full"
              >
                <Plus className="h-3 w-3 mr-0.5" />
                Выбрать
              </Button>
            </div>
          </FieldRow>
        </div>

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

        {/* Источник + дата закрытия — в одну строку, 2 колонки. */}
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Источник сделки">
            {(() => {
              const current = sources.find((s) => s.id === draft.source_id)
              return (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSourcePicker(true)}
                    className={cn(
                      "flex-1 min-w-0 h-8 px-3 text-sm text-left rounded-md border border-input bg-background",
                      "flex items-center gap-2 hover:bg-gray-50 transition-colors",
                      NO_RING,
                    )}
                  >
                    {current ? (
                      <>
                        {current.color && (
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-gray-200 shrink-0"
                            style={{ backgroundColor: current.color }}
                          />
                        )}
                        <span className="truncate">{current.name}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">Не указан</span>
                    )}
                  </button>
                  {canCreateSource && (
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => setSourceCreateOpen(true)}
                      className="h-8 w-8 shrink-0 bg-brand-yellow text-black hover:bg-yellow-500"
                      title="Создать источник"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })()}
          </FieldRow>

          <FieldRow label="Дата закрытия">
            <DateTimePicker
              value={draft.expected_close_at ?? null}
              onChange={(iso) => onDraft({ expected_close_at: iso })}
              placeholder="Не задана"
            />
          </FieldRow>
        </div>

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
          <NotesLinks text={draft.notes ?? ""} />
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
        onCreateNew={() => {
          setClientCreateTarget("primary")
          setClientCreateOpen(true)
        }}
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

      <KpCompanyQuickCreateDialog
        open={companyCreateOpen}
        onOpenChange={setCompanyCreateOpen}
        onCreated={(co) => {
          onCompanyCreated?.(co)
          onDraft({ company_id: co.id } as any)
        }}
      />

      <KpClientQuickCreateDialog
        open={clientCreateOpen}
        onOpenChange={setClientCreateOpen}
        onCreated={(cl) => {
          onClientCreated?.(cl as any)
          if (clientCreateTarget === "primary") {
            onDraft({ client_id: cl.id })
          } else {
            if (!extraContactIds.includes(cl.id)) {
              onExtraContactsChange([...extraContactIds, cl.id])
            }
          }
        }}
      />

      {/* Пикер компании — серверный поиск по /api/admin/kp-companies
          с бесконечным скроллом (у user'а 3k+ компаний). */}
      <CompanyPickerDialog
        open={companyPicker}
        onOpenChange={setCompanyPicker}
        title="Выбрать компанию"
        value={(draft as any).company_id ?? null}
        onChange={(id) => onDraft({ company_id: id } as any)}
        allowClear
        onCreateNew={() => setCompanyCreateOpen(true)}
      />

      {/* Пикер доп. контакта — тот же ClientPicker, но на выбор исключаем
          primary (draft.client_id) и уже выбранные доп. контакты. */}
      <ClientPickerDialog
        open={extraContactPicker}
        onOpenChange={setExtraContactPicker}
        clients={clients.filter(
          (c) =>
            c.id !== draft.client_id &&
            !extraContactIds.includes(c.id),
        )}
        value={null}
        onChange={(id) => {
          if (id != null) onExtraContactsChange([...extraContactIds, id])
        }}
        onCreateNew={() => {
          setClientCreateTarget("extra")
          setClientCreateOpen(true)
        }}
      />

      <EntityPickerDialog
        open={sourcePicker}
        onOpenChange={setSourcePicker}
        title="Источник сделки"
        searchPlaceholder="Поиск по названию"
        emptyText="Источники не найдены"
        clearText="Не указан"
        value={draft.source_id ?? null}
        onChange={(id) => onDraft({ source_id: id } as any)}
        allowClear
        items={sources
          .filter(
            (s) =>
              s.is_active ||
              (draft.source_id != null && s.id === draft.source_id),
          )
          .map((s) => ({
            id: s.id,
            primary: s.name,
            colorDot: s.color,
            badge: s.is_active ? undefined : "выкл.",
          }))}
      />

      <DealSourceQuickCreateDialog
        open={sourceCreateOpen}
        onOpenChange={setSourceCreateOpen}
        onCreated={(s) => {
          onSourceCreated?.(s)
          onDraft({ source_id: s.id } as any)
        }}
      />
    </>
  )
}

/**
 * Парсит URL в тексте заметок и показывает их отдельно как
 * кликабельные ссылки, открывающиеся в новом окне. Textarea остаётся
 * обычной — редактируемый plain-text, а снизу удобный клик по ссылке.
 * Если ссылок нет — ничего не рендерится.
 */
function NotesLinks({ text }: { text: string }) {
  const urls = React.useMemo(() => {
    if (!text) return [] as string[]
    const re = /(https?:\/\/[^\s<>"']+)/gi
    const found = Array.from(text.matchAll(re)).map((m) => m[1])
    // dedup с сохранением порядка
    const seen = new Set<string>()
    const out: string[] = []
    for (const u of found) {
      if (!seen.has(u)) {
        seen.add(u)
        out.push(u)
      }
    }
    return out
  }, [text])
  if (urls.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
      <span className="text-gray-400">ссылки:</span>
      {urls.map((u) => (
        <a
          key={u}
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 max-w-[280px]"
          title={u}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{u.replace(/^https?:\/\//, "")}</span>
        </a>
      ))}
    </div>
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
