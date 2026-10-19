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
import { CalendarRange, Users, Building2, User as UserIcon, X, Tag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { crmGet, crmPut } from "@/lib/crm-fetch"
import DateRangeDialog from "@/components/ui/date-range-dialog"
import EntityPickerDialog from "./entity-picker-dialog"
import ClientPickerDialog from "./client-picker-dialog"
import CompanyPickerDialog from "./company-picker-dialog"

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
  /** Источник сделки. 0 = «Без источника», число > 0 = конкретный DealSource. */
  sourceId?: number | null
  /** Доп. источник (DealSourceVariant). 0 = «Без варианта», число > 0 = конкретный.
   *  Применяется только когда выбран sourceId (у варианта есть parent). */
  sourceVariantId?: number | null
}

const DEFAULTS: DealsFilters = {
  period: "3m",
  clientId: null,
  companyId: null,
  responsibleId: null,
  sourceId: null,
  sourceVariantId: null,
}

const PRESETS: Array<{ key: PeriodKey; label: string; days: number | null }> = [
  { key: "2w", label: "2 недели", days: 14 },
  { key: "1m", label: "1 месяц", days: 30 },
  { key: "2m", label: "2 месяца", days: 60 },
  { key: "3m", label: "3 месяца", days: 90 },
  { key: "all", label: "Все", days: null },
]

/** Sentinel-id для пункта «Без ответственного» (responsibleId=0 ↔ бэк вернёт
 *  сделки где responsible_user_id IS NULL). Такой же паттерн — для источника. */
export const RESPONSIBLE_NONE = 0
export const SOURCE_NONE = 0
export const SOURCE_VARIANT_NONE = 0

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
  if (f.responsibleId === RESPONSIBLE_NONE) p.set("responsible_id", "none")
  else if (f.responsibleId) p.set("responsible_id", String(f.responsibleId))
  if (f.sourceId === SOURCE_NONE) p.set("source_id", "none")
  else if (f.sourceId) p.set("source_id", String(f.sourceId))
  // Доп. источник применяется только при выбранном основном (sourceId > 0),
  // иначе теряет смысл (variant привязан к parent).
  if (f.sourceId && f.sourceId > 0) {
    if (f.sourceVariantId === SOURCE_VARIANT_NONE) p.set("source_variant_id", "none")
    else if (f.sourceVariantId) p.set("source_variant_id", String(f.sourceVariantId))
  }
  return p
}

interface Props {
  value: DealsFilters
  onChange: (next: DealsFilters) => void
  clients: Array<{ id: number; display_name?: string; full_name?: string | null }>
  companies: Array<{ id: number; name: string }>
  users: Array<{ id: number; full_name?: string; email?: string; name?: string }>
  canChooseResponsible?: boolean
  /** Опциональная кнопка-слот в правом углу панели фильтров
   *  (напр. toggle «во весь экран»). */
  rightAction?: React.ReactNode
}

export default function DealsFilters({
  value,
  onChange,
  clients,
  companies,
  users,
  canChooseResponsible = false,
  rightAction,
}: Props) {
  const [clientPicker, setClientPicker] = useState(false)
  const [companyPicker, setCompanyPicker] = useState(false)
  const [respPicker, setRespPicker] = useState(false)
  const [sourcePicker, setSourcePicker] = useState(false)
  const [variantPicker, setVariantPicker] = useState(false)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [sources, setSources] = useState<Array<{ id: number; name: string; color?: string | null }>>([])
  const [variants, setVariants] = useState<Array<{ id: number; name: string }>>([])

  // Справочник источников — один раз при монтировании (небольшой список).
  useEffect(() => {
    crmGet<{ sources: Array<{ id: number; name: string; color?: string | null }> }>(
      "/api/admin/deal-sources",
    )
      .then((r) => setSources(r.sources || []))
      .catch(() => setSources([]))
  }, [])

  // Варианты для текущего основного источника. При смене source — сбрасываем
  // sourceVariantId (он был от другого parent), и подгружаем новый список.
  useEffect(() => {
    const sid = value.sourceId
    if (!sid || sid === SOURCE_NONE) {
      setVariants([])
      if (value.sourceVariantId != null) {
        onChange({ ...value, sourceVariantId: null })
      }
      return
    }
    let ignore = false
    crmGet<{ variants: Array<{ id: number; name: string }> }>(
      `/api/admin/deal-sources/${sid}/variants`,
    )
      .then((r) => {
        if (ignore) return
        const list = r.variants || []
        setVariants(list)
        if (value.sourceVariantId && value.sourceVariantId !== SOURCE_VARIANT_NONE
            && !list.some((v) => v.id === value.sourceVariantId)) {
          onChange({ ...value, sourceVariantId: null })
        }
      })
      .catch(() => { if (!ignore) setVariants([]) })
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.sourceId])

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
  const respIsNone = value.responsibleId === RESPONSIBLE_NONE
  const source = useMemo(
    () => sources.find((s) => s.id === value.sourceId) ?? null,
    [sources, value.sourceId],
  )
  const sourceIsNone = value.sourceId === SOURCE_NONE
  const variant = useMemo(
    () => variants.find((v) => v.id === value.sourceVariantId) ?? null,
    [variants, value.sourceVariantId],
  )
  const variantIsNone = value.sourceVariantId === SOURCE_VARIANT_NONE

  const setPeriod = (key: PeriodKey) => {
    if (key === "custom") {
      // Открываем модалку диапазона — применится после двух кликов.
      setRangeOpen(true)
    } else {
      onChange({ ...value, period: key, customFrom: null, customTo: null })
    }
  }

  const formatRange = (fromIso?: string | null, toIso?: string | null) => {
    if (!fromIso || !toIso) return null
    const a = new Date(fromIso).toLocaleDateString("ru-RU")
    const b = new Date(toIso).toLocaleDateString("ru-RU")
    return `${a} — ${b}`
  }
  const rangeLabel = formatRange(value.customFrom, value.customTo)

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
            {value.period === "custom" && rangeLabel ? rangeLabel : "Период"}
          </button>
        </div>

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
        {canChooseResponsible && (
          <FilterChip
            icon={<UserIcon className="h-3.5 w-3.5" />}
            label="Ответственный"
            current={
              respIsNone
                ? "Без ответственного"
                : resp ? (resp.full_name || resp.name || resp.email) : undefined
            }
            onPick={() => setRespPicker(true)}
            onClear={
              value.responsibleId != null
                ? () => onChange({ ...value, responsibleId: null })
                : undefined
            }
          />
        )}

        <FilterChip
          icon={<Tag className="h-3.5 w-3.5" />}
          label="Источник"
          current={
            sourceIsNone
              ? "Без источника"
              : source?.name
          }
          onPick={() => setSourcePicker(true)}
          onClear={
            value.sourceId != null
              ? () => onChange({ ...value, sourceId: null, sourceVariantId: null })
              : undefined
          }
        />

        {/* Доп. источник — виден только когда выбран основной (конкретный, не «без»). */}
        {value.sourceId != null && value.sourceId !== SOURCE_NONE && (
          <FilterChip
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Доп. источник"
            current={
              variantIsNone
                ? "Без варианта"
                : variant?.name
            }
            onPick={() => setVariantPicker(true)}
            onClear={
              value.sourceVariantId != null
                ? () => onChange({ ...value, sourceVariantId: null })
                : undefined
            }
          />
        )}

        {(value.clientId || value.companyId || value.responsibleId != null || value.sourceId != null || value.sourceVariantId != null || value.period !== "3m") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...DEFAULTS })}
            className="h-7 text-xs text-gray-500 hover:text-gray-900 ml-auto"
          >
            Сбросить
          </Button>
        )}
        {rightAction && (
          <div className={cn(
            // Если нет кнопки «Сбросить» выше — прижимаем rightAction вправо.
            !(value.clientId || value.companyId || value.responsibleId != null || value.sourceId != null || value.sourceVariantId != null || value.period !== "3m") && "ml-auto",
          )}>
            {rightAction}
          </div>
        )}
      </div>

      <ClientPickerDialog
        open={clientPicker}
        onOpenChange={setClientPicker}
        clients={clients}
        value={value.clientId ?? null}
        onChange={(id) => onChange({ ...value, clientId: id })}
      />
      <CompanyPickerDialog
        open={companyPicker}
        onOpenChange={setCompanyPicker}
        title="Выбрать компанию"
        value={value.companyId ?? null}
        onChange={(id) => onChange({ ...value, companyId: id })}
        allowClear
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
        nullOption={{
          id: RESPONSIBLE_NONE,
          primary: "Без ответственного",
          secondary: "Сделки где ответственный не назначен",
        }}
        items={users.map((u) => ({
          id: u.id,
          primary: u.full_name || u.name || u.email || `#${u.id}`,
          secondary: u.email,
        }))}
      />

      <EntityPickerDialog
        open={sourcePicker}
        onOpenChange={setSourcePicker}
        title="Выбрать источник"
        searchPlaceholder="Поиск источника"
        emptyText="Источники не найдены"
        value={value.sourceId ?? null}
        onChange={(id) => onChange({ ...value, sourceId: id, sourceVariantId: null })}
        allowClear
        nullOption={{
          id: SOURCE_NONE,
          primary: "Без источника",
          secondary: "Сделки без указания источника",
        }}
        items={sources.map((s) => ({
          id: s.id,
          primary: s.name,
          colorDot: s.color ?? null,
        }))}
      />

      <EntityPickerDialog
        open={variantPicker}
        onOpenChange={setVariantPicker}
        title="Доп. об источнике"
        searchPlaceholder="Поиск"
        emptyText="У источника пока нет вариантов"
        value={value.sourceVariantId ?? null}
        onChange={(id) => onChange({ ...value, sourceVariantId: id })}
        allowClear
        nullOption={{
          id: SOURCE_VARIANT_NONE,
          primary: "Без варианта",
          secondary: "Сделки с источником, но без доп. варианта",
        }}
        items={variants.map((v) => ({ id: v.id, primary: v.name }))}
      />

      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        from={value.customFrom ?? null}
        to={value.customTo ?? null}
        onApply={(fromIso, toIso) =>
          onChange({
            ...value,
            period: "custom",
            customFrom: fromIso,
            customTo: toIso,
          })
        }
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
