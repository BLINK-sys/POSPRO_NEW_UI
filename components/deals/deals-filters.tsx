"use client"

/**
 * Панель фильтров над канбаном сделок. Фильтры сохраняются per-user
 * в `/api/user-prefs/deals_canvas` — те же настройки видны на любом
 * устройстве того же юзера.
 *
 * Фильтры:
 *   - period: '2w' / '1m' / '2m' / '3m' / 'all' / 'custom' + daysBack|customFrom/customTo
 *   - clientId:  int | null
 *   - companyId: int | null
 *   - responsibleId: int | null
 *
 * Default: period='3m' (при первом заходе).
 */

import { useEffect, useMemo, useState } from "react"
import { CalendarRange, Users, Building2, User as UserIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { crmGet, crmPut } from "@/lib/crm-fetch"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import EntityPickerDialog from "./entity-picker-dialog"
import ClientPickerDialog from "./client-picker-dialog"

export type PeriodKey = "2w" | "1m" | "2m" | "3m" | "all" | "custom"

export interface DealsFilters {
  period: PeriodKey
  /** Для 'custom' — ISO datetime начала периода. */
  customFrom?: string | null
  /** Для 'custom' — ISO datetime конца периода. */
  customTo?: string | null
  clientId?: number | null
  companyId?: number | null
  responsibleId?: number | null
}

const DEFAULTS: DealsFilters = {
  period: "3m",
  clientId: null,
  companyId: null,
  responsibleId: null,
}

const PRESETS: Array<{ key: PeriodKey; label: string; days: number | null }> = [
  { key: "2w", label: "2 недели", days: 14 },
  { key: "1m", label: "1 месяц", days: 30 },
  { key: "2m", label: "2 месяца", days: 60 },
  { key: "3m", label: "3 месяца", days: 90 },
  { key: "all", label: "Все", days: null },
]

/** Переводит фильтры в query-строку для /api/admin/deals. */
export function filtersToQuery(f: DealsFilters): URLSearchParams {
  const p = new URLSearchParams()
  const now = Date.now()
  if (f.period !== "all" && f.period !== "custom") {
    const days = PRESETS.find((x) => x.key === f.period)?.days
    if (days) {
      const since = new Date(now - days * 24 * 3600 * 1000).toISOString()
      p.set("created_after", since)
    }
  }
  if (f.period === "custom") {
    if (f.customFrom) p.set("created_after", f.customFrom)
    if (f.customTo) p.set("created_before", f.customTo)
  }
  if (f.clientId) p.set("client_id", String(f.clientId))
  if (f.companyId) p.set("company_id", String(f.companyId))
  if (f.responsibleId) p.set("responsible_id", String(f.responsibleId))
  return p
}

interface Props {
  value: DealsFilters
  onChange: (next: DealsFilters) => void
  clients: Array<{ id: number; display_name?: string; full_name?: string | null }>
  companies: Array<{ id: number; name: string }>
  users: Array<{ id: number; full_name?: string; email?: string; name?: string }>
}

export default function DealsFilters({
  value,
  onChange,
  clients,
  companies,
  users,
}: Props) {
  const [clientPicker, setClientPicker] = useState(false)
  const [companyPicker, setCompanyPicker] = useState(false)
  const [respPicker, setRespPicker] = useState(false)

  const client = useMemo(
    () => clients.find((c) => c.id === value.clientId) ?? null,
    [clients, value.clientId],
  )
  const company = useMemo(
    () => companies.find((c) => c.id === value.companyId) ?? null,
    [companies, value.companyId],
  )
  const resp = useMemo(
    () => users.find((u) => u.id === value.responsibleId) ?? null,
    [users, value.responsibleId],
  )

  const setPeriod = (key: PeriodKey) => {
    if (key === "custom") {
      onChange({ ...value, period: "custom" })
    } else {
      onChange({ ...value, period: key, customFrom: null, customTo: null })
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap bg-gray-50/60 border border-gray-200 rounded-xl px-3 py-2">
        {/* Период */}
        <div className="inline-flex items-center bg-white rounded-lg border border-gray-200 p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-2.5 h-7 text-xs rounded-md transition-colors",
                value.period === p.key
                  ? "bg-brand-yellow text-black font-medium"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod("custom")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 h-7 text-xs rounded-md transition-colors",
              value.period === "custom"
                ? "bg-brand-yellow text-black font-medium"
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Период
          </button>
        </div>

        {/* Кастомные даты (только когда period='custom') */}
        {value.period === "custom" && (
          <>
            <span className="text-xs text-gray-400">с</span>
            <DateTimePicker
              value={value.customFrom ?? null}
              onChange={(iso) => onChange({ ...value, customFrom: iso })}
              placeholder="…"
            />
            <span className="text-xs text-gray-400">по</span>
            <DateTimePicker
              value={value.customTo ?? null}
              onChange={(iso) => onChange({ ...value, customTo: iso })}
              placeholder="…"
            />
          </>
        )}

        {/* Фильтры-пикеры: клиент / компания / ответственный */}
        <FilterChip
          icon={<Users className="h-3.5 w-3.5" />}
          label="Клиент"
          current={client?.display_name || client?.full_name}
          onPick={() => setClientPicker(true)}
          onClear={value.clientId ? () => onChange({ ...value, clientId: null }) : undefined}
        />
        <FilterChip
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Компания"
          current={company?.name}
          onPick={() => setCompanyPicker(true)}
          onClear={value.companyId ? () => onChange({ ...value, companyId: null }) : undefined}
        />
        <FilterChip
          icon={<UserIcon className="h-3.5 w-3.5" />}
          label="Ответственный"
          current={resp ? (resp.full_name || resp.name || resp.email) : undefined}
          onPick={() => setRespPicker(true)}
          onClear={value.responsibleId ? () => onChange({ ...value, responsibleId: null }) : undefined}
        />

        {(value.clientId || value.companyId || value.responsibleId || value.period !== "3m") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...DEFAULTS })}
            className="h-7 text-xs text-gray-500 hover:text-gray-900 ml-auto"
          >
            Сбросить
          </Button>
        )}
      </div>

      <ClientPickerDialog
        open={clientPicker}
        onOpenChange={setClientPicker}
        clients={clients}
        value={value.clientId ?? null}
        onChange={(id) => onChange({ ...value, clientId: id })}
      />
      <EntityPickerDialog
        open={companyPicker}
        onOpenChange={setCompanyPicker}
        title="Выбрать компанию"
        searchPlaceholder="Поиск по названию"
        emptyText="Компании не найдены"
        value={value.companyId ?? null}
        onChange={(id) => onChange({ ...value, companyId: id })}
        allowClear
        items={companies.map((c) => ({ id: c.id, primary: c.name }))}
      />
      <EntityPickerDialog
        open={respPicker}
        onOpenChange={setRespPicker}
        title="Выбрать ответственного"
        searchPlaceholder="Поиск по имени / email"
        emptyText="Пользователи не найдены"
        value={value.responsibleId ?? null}
        onChange={(id) => onChange({ ...value, responsibleId: id })}
        allowClear
        items={users.map((u) => ({
          id: u.id,
          primary: u.full_name || u.name || u.email || `#${u.id}`,
          secondary: u.email,
        }))}
      />
    </>
  )
}

function FilterChip({
  icon,
  label,
  current,
  onPick,
  onClear,
}: {
  icon: React.ReactNode
  label: string
  current?: string | null | undefined
  onPick: () => void
  onClear?: () => void
}) {
  const isSet = Boolean(current)
  return (
    <div className={cn(
      "inline-flex items-center gap-1 h-7 rounded-md border text-xs",
      isSet ? "border-brand-yellow bg-brand-yellow/15" : "border-gray-200 bg-white",
    )}>
      <button
        type="button"
        onClick={onPick}
        className="inline-flex items-center gap-1 px-2 h-full text-gray-700 hover:text-gray-900"
      >
        {icon}
        {isSet ? (
          <span className="truncate max-w-[160px]" title={current ?? ""}>{current}</span>
        ) : (
          <span className="text-gray-500">{label}</span>
        )}
      </button>
      {isSet && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="h-full w-5 inline-flex items-center justify-center text-gray-400 hover:text-red-500"
          aria-label="Сбросить"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Hook: загрузка/сохранение фильтров в user-prefs с debounce.

const PREFS_KEY = "deals_canvas"

export function useDealsFilters() {
  const [filters, setFilters] = useState<DealsFilters>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  // Загружаем prefs при маунте.
  useEffect(() => {
    let ignore = false
    crmGet<{ value: DealsFilters | null }>(`/api/user-prefs/${PREFS_KEY}`)
      .then((res) => {
        if (ignore) return
        if (res.value && typeof res.value === "object") {
          setFilters({ ...DEFAULTS, ...res.value })
        }
      })
      .catch(() => {
        /* тихо — остаётся default */
      })
      .finally(() => {
        if (!ignore) setLoaded(true)
      })
    return () => { ignore = true }
  }, [])

  // Сохраняем изменения с debounce 500мс (чтобы быстрые клики не
  // спамили PUT'ами).
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      crmPut(`/api/user-prefs/${PREFS_KEY}`, { value: filters }).catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [filters, loaded])

  return { filters, setFilters, loaded }
}
