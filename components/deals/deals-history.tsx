"use client"

/**
 * Страница «История сделок» — /admin/deals/history.
 *
 * Структура:
 *   [Табы] + [Статы-плитки: Всего / Сумма open / Сумма won / Средний won]
 *   [Фильтры: период / статус / воронка / клиент / компания / ответственный / сумма / поиск]
 *   [Toggle: Плоский список / По клиенту]
 *   [Таблица + серверная пагинация]
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Briefcase, CalendarRange, Loader2, Search, TrendingUp,
  Users, Building2, User as UserIcon, X, LayoutList, LayoutGrid, ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { crmGet, crmPut } from "@/lib/crm-fetch"
import { TablePager } from "@/components/ui/table-pager"
import DateRangeDialog from "@/components/ui/date-range-dialog"
import ClientPickerDialog from "./client-picker-dialog"
import CompanyPickerDialog from "./company-picker-dialog"
import EntityPickerDialog from "./entity-picker-dialog"
import DealsTabsHeader from "./deals-tabs-header"


const PAGE_SIZES = [25, 50, 100] as const

type PeriodKey = "2w" | "1m" | "3m" | "6m" | "1y" | "all" | "custom"
const PERIOD_PRESETS: Array<{ key: PeriodKey; label: string; days: number | null }> = [
  { key: "2w", label: "2 недели", days: 14 },
  { key: "1m", label: "1 мес", days: 30 },
  { key: "3m", label: "3 мес", days: 90 },
  { key: "6m", label: "6 мес", days: 180 },
  { key: "1y", label: "1 год", days: 365 },
  { key: "all", label: "Все", days: null },
]

type ViewMode = "flat" | "by_client"


interface Filters {
  period: PeriodKey
  customFrom?: string | null
  customTo?: string | null
  status: "all" | "open" | "won" | "lost"
  pipelineId?: number | null
  stageId?: number | null
  clientId?: number | null
  companyId?: number | null
  responsibleId?: number | null
  sourceId?: number | "none" | null
  amountMin?: number | null
  amountMax?: number | null
  q?: string
  viewMode: ViewMode
}

const DEFAULTS: Filters = {
  period: "3m",
  status: "all",
  viewMode: "flat",
}

const PREFS_KEY = "deals_history"


function filtersToQuery(f: Filters, extra?: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams()
  const now = Date.now()
  if (f.period !== "all" && f.period !== "custom") {
    const days = PERIOD_PRESETS.find((x) => x.key === f.period)?.days
    if (days) {
      const since = new Date(now - days * 24 * 3600 * 1000).toISOString()
      p.set("created_after", since)
    }
  }
  if (f.period === "custom") {
    if (f.customFrom) p.set("created_after", f.customFrom)
    if (f.customTo) p.set("created_before", f.customTo)
  }
  if (f.status !== "all") p.set("status", f.status)
  if (f.pipelineId) p.set("pipeline_id", String(f.pipelineId))
  if (f.stageId) p.set("stage_id", String(f.stageId))
  if (f.clientId) p.set("client_id", String(f.clientId))
  if (f.companyId) p.set("company_id", String(f.companyId))
  if (f.responsibleId === 0) p.set("responsible_id", "none")
  else if (f.responsibleId) p.set("responsible_id", String(f.responsibleId))
  if (f.sourceId === "none") p.set("source_id", "none")
  else if (f.sourceId) p.set("source_id", String(f.sourceId))
  if (f.amountMin != null) p.set("amount_min", String(f.amountMin))
  if (f.amountMax != null) p.set("amount_max", String(f.amountMax))
  if (f.q && f.q.trim()) p.set("q", f.q.trim())
  if (extra) for (const [k, v] of Object.entries(extra)) p.set(k, v)
  return p
}


export default function DealsHistory() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuth()
  const canSeeAll = Boolean(user && (user.is_owner || user.can_see_all_deals))

  const [filters, setFilters] = useState<Filters>(DEFAULTS)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  // URL-override вынесен в единый load-эффект prefs ниже — иначе была
  // гонка: отдельный useEffect ставил sourceId из URL, а затем приходили
  // загруженные prefs и затирали его целиком через setFilters({...DEFAULTS,
  // ...prefs}). Теперь prefs и URL-override мерджатся в один setState.
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Справочники для пикеров.
  const [pipelines, setPipelines] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])

  // Данные.
  const [stats, setStats] = useState<any>({ total: 0, sum_open: 0, sum_won: 0, avg_won: 0 })
  const [flatRows, setFlatRows] = useState<any[]>([])
  const [flatTotal, setFlatTotal] = useState(0)
  const [byClientRows, setByClientRows] = useState<any[]>([])
  const [byClientTotal, setByClientTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Пикеры-диалоги
  const [rangeOpen, setRangeOpen] = useState(false)
  const [clientPicker, setClientPicker] = useState(false)
  const [companyPicker, setCompanyPicker] = useState(false)
  const [respPicker, setRespPicker] = useState(false)
  const [expandedClients, setExpandedClients] = useState<Set<number | null>>(new Set())
  const [expandedDeals, setExpandedDeals] = useState<Record<string, any[]>>({})

  // Prefs: load once + URL-override поверх, одним setState (чтобы не было
  // гонки «prefs затирают source/period, пришедшие из /sources-stats»).
  useEffect(() => {
    crmGet<{ value: Filters | null }>(`/api/user-prefs/${PREFS_KEY}`)
      .then((res) => {
        const base: Filters = (res.value && typeof res.value === "object")
          ? { ...DEFAULTS, ...res.value }
          : { ...DEFAULTS }

        // URL-параметры из /sources-stats:
        //   source=<id>|none   — pre-фильтр источника
        //   period=1m|3m|6m|1y|all   — пресет периода
        //   from=<iso>&to=<iso>      — кастомный диапазон
        const src = searchParams.get("source")
        if (src) {
          base.sourceId = src === "none" ? "none" : (Number(src) || null)
        }
        const periodQ = searchParams.get("period")
        if (periodQ && ["2w","1m","3m","6m","1y","all"].includes(periodQ)) {
          base.period = periodQ as any
          base.customFrom = null
          base.customTo = null
        }
        const from = searchParams.get("from")
        const to = searchParams.get("to")
        if (from && to) {
          base.period = "custom"
          base.customFrom = from
          base.customTo = to
        }

        setFilters(base)
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save prefs (debounce 500ms)
  useEffect(() => {
    if (!prefsLoaded) return
    const t = setTimeout(() => {
      crmPut(`/api/user-prefs/${PREFS_KEY}`, { value: filters }).catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [filters, prefsLoaded])

  // Debounce поиск.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q?.trim() || ""), 300)
    return () => clearTimeout(t)
  }, [filters.q])

  // Сброс страницы при смене любого фильтра.
  useEffect(() => {
    setPage(1)
  }, [
    filters.period, filters.customFrom, filters.customTo,
    filters.status, filters.pipelineId, filters.stageId,
    filters.clientId, filters.companyId, filters.responsibleId,
    filters.sourceId, filters.amountMin, filters.amountMax,
    filters.viewMode, debouncedQ, pageSize,
  ])

  // Справочники — один раз
  useEffect(() => {
    Promise.all([
      crmGet<{ pipelines: any[] }>("/api/admin/deal-pipelines?with_stages=1").catch(() => ({ pipelines: [] })),
      crmGet<{ clients: any[] }>("/api/kp-clients?limit=500").catch(() => ({ clients: [] })),
      crmGet<{ companies: any[] }>("/api/admin/kp-companies?limit=500").catch(() => ({ companies: [] })),
      crmGet<any>("/api/system-users").catch(() => []),
      crmGet<{ sources: any[] }>("/api/admin/deal-sources").catch(() => ({ sources: [] })),
    ]).then(([p, c, co, u, s]) => {
      setPipelines(p.pipelines || [])
      setClients(c.clients || [])
      setCompanies(co.companies || [])
      setUsers(Array.isArray(u) ? u : (u?.users || []))
      setSources(s.sources || [])
    })
  }, [])

  // Загрузка данных на фильтр.
  const load = useCallback(async () => {
    if (!prefsLoaded) return
    setLoading(true)
    try {
      const baseQuery = filtersToQuery({ ...filters, q: debouncedQ })
      // Stats — всегда
      const statsPromise = crmGet<any>(`/api/admin/deals/stats?${baseQuery.toString()}`)

      if (filters.viewMode === "flat") {
        const q = new URLSearchParams(baseQuery)
        q.set("limit", String(pageSize))
        q.set("offset", String((page - 1) * pageSize))
        const [st, list] = await Promise.all([
          statsPromise,
          crmGet<any>(`/api/admin/deals?${q.toString()}`),
        ])
        setStats(st)
        setFlatRows(list.deals || [])
        setFlatTotal(list.total || 0)
      } else {
        const q = new URLSearchParams(baseQuery)
        q.set("limit", String(pageSize))
        q.set("offset", String((page - 1) * pageSize))
        const [st, bc] = await Promise.all([
          statsPromise,
          crmGet<any>(`/api/admin/deals/by-client?${q.toString()}`),
        ])
        setStats(st)
        setByClientRows(bc.rows || [])
        setByClientTotal(bc.total || 0)
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось загрузить историю",
        description: e?.message,
      })
    } finally {
      setLoading(false)
    }
  }, [prefsLoaded, filters, debouncedQ, page, pageSize, toast])

  useEffect(() => { load() }, [load])

  const pipelineById = useMemo(
    () => new Map(pipelines.map((p: any) => [p.id, p])),
    [pipelines],
  )
  const clientNameById = useMemo(
    () => new Map(clients.map((c: any) => [c.id, c.display_name])),
    [clients],
  )
  const companyNameById = useMemo(
    () => new Map(companies.map((c: any) => [c.id, c.name])),
    [companies],
  )
  const userNameById = useMemo(
    () => new Map(users.map((u: any) => [u.id, u.full_name || u.email])),
    [users],
  )
  const sourceById = useMemo(
    () => new Map(sources.map((s: any) => [s.id, s])),
    [sources],
  )

  const stagesOfActivePipeline = useMemo(() => {
    if (!filters.pipelineId) return [] as any[]
    const p = pipelineById.get(filters.pipelineId)
    return p?.stages ?? []
  }, [filters.pipelineId, pipelineById])

  const toggleExpandClient = async (clientId: number | null) => {
    const next = new Set(expandedClients)
    const k = clientId ?? "none" as any
    if (next.has(clientId as any)) {
      next.delete(clientId as any)
    } else {
      next.add(clientId as any)
      // Lazy-load deals этого клиента
      if (!expandedDeals[String(k)]) {
        try {
          const q = filtersToQuery({ ...filters, q: debouncedQ })
          if (clientId == null) q.set("client_id", "0")
          else q.set("client_id", String(clientId))
          q.set("limit", "200")
          const res = await crmGet<any>(`/api/admin/deals?${q.toString()}`)
          setExpandedDeals((prev) => ({ ...prev, [String(k)]: res.deals || [] }))
        } catch {}
      }
    }
    setExpandedClients(next)
  }

  const formatMoney = (v: number) =>
    v ? new Intl.NumberFormat("ru-KZ", {
      style: "currency", currency: "KZT", maximumFractionDigits: 0,
    }).format(v) : "—"

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—"
    const d = new Date(iso)
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const activeFiltersCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.pipelineId ? 1 : 0) +
    (filters.stageId ? 1 : 0) +
    (filters.clientId ? 1 : 0) +
    (filters.companyId ? 1 : 0) +
    (filters.responsibleId != null ? 1 : 0) +
    (filters.sourceId ? 1 : 0) +
    (filters.amountMin != null ? 1 : 0) +
    (filters.amountMax != null ? 1 : 0) +
    (debouncedQ ? 1 : 0)

  return (
    <div className="space-y-4 min-w-0">
      {/* Шапка: заголовок + табы сразу после (единое положение на всех
          табах, не прыгают при переключении). */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
          <Briefcase className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold leading-tight">Сделки</h1>
        <DealsTabsHeader />
      </div>

      {/* Статы-плитки — на 5 колонок (не 4) чтобы влезла «Проиграно». */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Всего сделок" value={stats.total || 0} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard label="Сумма открытых" value={formatMoney(stats.sum_open)} icon={<TrendingUp className="h-5 w-5 text-blue-600" />} />
        <StatCard label="Сумма выигранных" value={formatMoney(stats.sum_won)} icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} />
        <StatCard label="Сумма проигранных" value={formatMoney(stats.sum_lost)} icon={<TrendingUp className="h-5 w-5 text-red-600" />} />
        <StatCard label="Средний чек win" value={formatMoney(stats.avg_won)} icon={<TrendingUp className="h-5 w-5 text-yellow-600" />} />
      </div>

      {/* Фильтры */}
      <Card className="rounded-xl border-gray-200 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Период */}
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setFilters({ ...filters, period: p.key, customFrom: null, customTo: null })}
                className={cn(
                  "px-2.5 h-7 text-xs rounded-md transition-colors",
                  filters.period === p.key
                    ? "bg-brand-yellow text-black font-medium"
                    : "text-gray-600 hover:bg-white",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRangeOpen(true)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 h-7 text-xs rounded-md transition-colors",
                filters.period === "custom"
                  ? "bg-brand-yellow text-black font-medium"
                  : "text-gray-600 hover:bg-white",
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              {filters.period === "custom" && filters.customFrom && filters.customTo
                ? `${new Date(filters.customFrom).toLocaleDateString("ru-RU")} — ${new Date(filters.customTo).toLocaleDateString("ru-RU")}`
                : "Период"}
            </button>
          </div>

          {/* Статус */}
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ ...filters, status: v as Filters["status"] })}
          >
            <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="open">Открытые</SelectItem>
              <SelectItem value="won">Выигранные</SelectItem>
              <SelectItem value="lost">Проигранные</SelectItem>
            </SelectContent>
          </Select>

          {/* Воронка */}
          <Select
            value={filters.pipelineId != null ? String(filters.pipelineId) : "all"}
            onValueChange={(v) => setFilters({
              ...filters,
              pipelineId: v === "all" ? null : Number(v),
              stageId: null,
            })}
          >
            <SelectTrigger className="h-8 w-auto min-w-[120px] max-w-[220px] text-xs rounded-md">
              <SelectValue placeholder="Воронка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все воронки</SelectItem>
              {pipelines.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Стадия (только если выбрана воронка) */}
          {filters.pipelineId && (
            <Select
              value={filters.stageId != null ? String(filters.stageId) : "all"}
              onValueChange={(v) => setFilters({ ...filters, stageId: v === "all" ? null : Number(v) })}
            >
              <SelectTrigger className="h-8 w-auto min-w-[120px] max-w-[220px] text-xs rounded-md">
                <SelectValue placeholder="Стадия" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все стадии</SelectItem>
                {stagesOfActivePipeline
                  .filter((s: any) => s.is_active !== false || s.id === filters.stageId)
                  .map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          {/* Источник */}
          <Select
            value={filters.sourceId === "none" ? "none" : (filters.sourceId != null ? String(filters.sourceId) : "all")}
            onValueChange={(v) => setFilters({
              ...filters,
              sourceId: v === "all" ? null : v === "none" ? "none" : Number(v),
            })}
          >
            <SelectTrigger className="h-8 w-auto min-w-[120px] max-w-[220px] text-xs rounded-md">
              <SelectValue placeholder="Источник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все источники</SelectItem>
              <SelectItem value="none">Без источника</SelectItem>
              {sources.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <FilterChip
            icon={<Users className="h-3.5 w-3.5" />}
            label="Клиент"
            current={filters.clientId ? clientNameById.get(filters.clientId) : null}
            onPick={() => setClientPicker(true)}
            onClear={filters.clientId ? () => setFilters({ ...filters, clientId: null }) : undefined}
          />
          <FilterChip
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Компания"
            current={filters.companyId ? companyNameById.get(filters.companyId) : null}
            onPick={() => setCompanyPicker(true)}
            onClear={filters.companyId ? () => setFilters({ ...filters, companyId: null }) : undefined}
          />
          {canSeeAll && (
            <FilterChip
              icon={<UserIcon className="h-3.5 w-3.5" />}
              label="Ответственный"
              current={
                filters.responsibleId === 0
                  ? "Без ответственного"
                  : filters.responsibleId
                  ? userNameById.get(filters.responsibleId)
                  : null
              }
              onPick={() => setRespPicker(true)}
              onClear={
                filters.responsibleId != null
                  ? () => setFilters({ ...filters, responsibleId: null })
                  : undefined
              }
            />
          )}

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ ...DEFAULTS, viewMode: filters.viewMode })}
              className="h-7 text-xs text-gray-500 ml-auto"
            >
              Сбросить
            </Button>
          )}
        </div>

        {/* Поиск + Сумма + Вид */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={filters.q ?? ""}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Поиск по названию"
              className="h-8 pl-9 pr-8 rounded-md text-xs"
            />
          </div>
          <Input
            type="number"
            value={filters.amountMin ?? ""}
            onChange={(e) => setFilters({ ...filters, amountMin: e.target.value ? Number(e.target.value) : null })}
            placeholder="Сумма от"
            className="h-8 w-32 rounded-md text-xs"
          />
          <Input
            type="number"
            value={filters.amountMax ?? ""}
            onChange={(e) => setFilters({ ...filters, amountMax: e.target.value ? Number(e.target.value) : null })}
            placeholder="до"
            className="h-8 w-32 rounded-md text-xs"
          />
          <div className="inline-flex items-center bg-gray-100 rounded-md p-0.5 ml-auto">
            <button
              onClick={() => setFilters({ ...filters, viewMode: "flat" })}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 h-7 text-xs rounded-md",
                filters.viewMode === "flat" ? "bg-white font-medium shadow-sm" : "text-gray-600",
              )}
              title="Плоский список сделок"
            >
              <LayoutList className="h-3.5 w-3.5" /> Список
            </button>
            <button
              onClick={() => setFilters({ ...filters, viewMode: "by_client" })}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 h-7 text-xs rounded-md",
                filters.viewMode === "by_client" ? "bg-white font-medium shadow-sm" : "text-gray-600",
              )}
              title="Группировка по клиенту"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> По клиенту
            </button>
          </div>
        </div>
      </Card>

      {/* Таблица */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filters.viewMode === "flat" ? (
          <FlatTable
            rows={flatRows}
            pipelineById={pipelineById}
            clientNameById={clientNameById}
            companyNameById={companyNameById}
            userNameById={userNameById}
            onOpen={(id) => router.push(`/admin/deals/${id}`)}
            formatMoney={formatMoney}
            formatDate={formatDate}
          />
        ) : (
          <ByClientTable
            rows={byClientRows}
            expandedClients={expandedClients}
            expandedDeals={expandedDeals}
            onToggle={toggleExpandClient}
            pipelineById={pipelineById}
            userNameById={userNameById}
            formatMoney={formatMoney}
            formatDate={formatDate}
            onOpen={(id) => router.push(`/admin/deals/${id}`)}
          />
        )}
      </Card>

      {((filters.viewMode === "flat" ? flatTotal : byClientTotal) > 0) && (
        <TablePager
          page={page}
          pageSize={pageSize}
          total={filters.viewMode === "flat" ? flatTotal : byClientTotal}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sizes={PAGE_SIZES}
        />
      )}

      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        from={filters.customFrom ?? null}
        to={filters.customTo ?? null}
        onApply={(fromIso, toIso) =>
          setFilters({ ...filters, period: "custom", customFrom: fromIso, customTo: toIso })
        }
      />
      <ClientPickerDialog
        open={clientPicker}
        onOpenChange={setClientPicker}
        clients={clients}
        value={filters.clientId ?? null}
        onChange={(id) => setFilters({ ...filters, clientId: id })}
      />
      <CompanyPickerDialog
        open={companyPicker}
        onOpenChange={setCompanyPicker}
        title="Выбрать компанию"
        value={filters.companyId ?? null}
        onChange={(id) => setFilters({ ...filters, companyId: id })}
        allowClear
      />
      <EntityPickerDialog
        open={respPicker}
        onOpenChange={setRespPicker}
        title="Выбрать ответственного"
        searchPlaceholder="Поиск по имени / email"
        emptyText="Пользователи не найдены"
        value={filters.responsibleId ?? null}
        onChange={(id) => setFilters({ ...filters, responsibleId: id })}
        allowClear
        nullOption={{
          id: 0,
          primary: "Без ответственного",
          secondary: "Сделки где ответственный не назначен",
        }}
        items={users.map((u: any) => ({
          id: u.id,
          primary: u.full_name || u.name || u.email || `#${u.id}`,
          secondary: u.email,
        }))}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <Card className="rounded-xl border-gray-200 p-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase text-gray-500 tracking-wider">{label}</div>
        <div className="text-base font-semibold tabular-nums truncate">{value}</div>
      </div>
    </Card>
  )
}

function FilterChip({
  icon, label, current, onPick, onClear,
}: {
  icon: React.ReactNode
  label: string
  current?: string | null
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

function FlatTable({
  rows, pipelineById, clientNameById, companyNameById, userNameById,
  onOpen, formatMoney, formatDate,
}: any) {
  if (rows.length === 0) {
    return <div className="text-sm text-gray-500 text-center py-16">Сделок не найдено</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2 font-normal w-16">#</th>
            <th className="text-left px-3 py-2 font-normal">Название</th>
            <th className="text-left px-3 py-2 font-normal">Клиент</th>
            <th className="text-left px-3 py-2 font-normal">Компания</th>
            <th className="text-left px-3 py-2 font-normal">Воронка / стадия</th>
            <th className="text-left px-3 py-2 font-normal w-24">Статус</th>
            <th className="text-right px-3 py-2 font-normal w-28">Сумма</th>
            <th className="text-left px-3 py-2 font-normal w-24">Создана</th>
            <th className="text-left px-3 py-2 font-normal w-32">Ответственный</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d: any) => {
            const pipeline = pipelineById.get(d.pipeline_id)
            const stage = pipeline?.stages?.find((s: any) => s.id === d.stage_id)
            return (
              <tr
                key={d.id}
                onClick={() => onOpen(d.id)}
                className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
              >
                <td className="px-3 py-2 tabular-nums text-gray-400">{d.id}</td>
                <td className="px-3 py-2 font-medium">{d.name}</td>
                <td className="px-3 py-2 text-gray-700">{d.client_id ? clientNameById.get(d.client_id) || `#${d.client_id}` : "—"}</td>
                <td className="px-3 py-2 text-gray-700">{d.company_id ? companyNameById.get(d.company_id) || `#${d.company_id}` : "—"}</td>
                <td className="px-3 py-2 text-gray-700 text-xs">
                  {pipeline?.name}
                  {stage && (
                    <span className="ml-1 inline-flex items-center gap-1 text-gray-500">
                      · <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(d.amount || 0)}</td>
                <td className="px-3 py-2 text-xs text-gray-500 tabular-nums">{formatDate(d.created_at)}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{d.responsible_user_id ? userNameById.get(d.responsible_user_id) : "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ByClientTable({
  rows, expandedClients, expandedDeals, onToggle,
  pipelineById, userNameById, formatMoney, formatDate, onOpen,
}: any) {
  if (rows.length === 0) {
    return <div className="text-sm text-gray-500 text-center py-16">Клиентов не найдено</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase tracking-wider">
          <tr>
            <th className="w-8"></th>
            <th className="text-left px-3 py-2 font-normal">Клиент</th>
            <th className="text-right px-3 py-2 font-normal w-20">Сделок</th>
            <th className="text-right px-3 py-2 font-normal w-24">Открытых</th>
            <th className="text-right px-3 py-2 font-normal w-24">Выиграно</th>
            <th className="text-right px-3 py-2 font-normal w-24">Проиграно</th>
            <th className="text-right px-3 py-2 font-normal w-40">Сумма won</th>
            <th className="text-left px-3 py-2 font-normal w-28">Последняя</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => {
            const key = r.client_id ?? "none"
            const expanded = expandedClients.has(r.client_id as any) ||
                             (r.client_id == null && expandedClients.has(null as any))
            const dealsHere = expandedDeals[String(key)] || []
            return (
              <>
                <tr
                  key={`c-${key}`}
                  onClick={() => onToggle(r.client_id)}
                  className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                >
                  <td className="px-2 text-gray-400">
                    <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
                  </td>
                  <td className="px-3 py-2 font-medium">{r.client_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-600">{r.open}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{r.won}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.lost}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(r.sum_won)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 tabular-nums">{formatDate(r.last_at)}</td>
                </tr>
                {expanded && dealsHere.length > 0 && (
                  <tr key={`c-${key}-exp`}>
                    <td colSpan={8} className="bg-gray-50/40 px-6 py-2">
                      <table className="w-full text-xs">
                        <tbody>
                          {dealsHere.map((d: any) => {
                            const pipeline = pipelineById.get(d.pipeline_id)
                            const stage = pipeline?.stages?.find((s: any) => s.id === d.stage_id)
                            return (
                              <tr
                                key={d.id}
                                onClick={() => onOpen(d.id)}
                                className="border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer"
                              >
                                <td className="px-2 py-1.5 tabular-nums text-gray-400 w-16">#{d.id}</td>
                                <td className="px-2 py-1.5 font-medium">{d.name}</td>
                                <td className="px-2 py-1.5 text-gray-500">
                                  {pipeline?.name}
                                  {stage && ` · ${stage.name}`}
                                </td>
                                <td className="px-2 py-1.5 w-24"><StatusBadge status={d.status} /></td>
                                <td className="px-2 py-1.5 text-right tabular-nums w-28">{formatMoney(d.amount || 0)}</td>
                                <td className="px-2 py-1.5 text-gray-500 w-24 tabular-nums">{formatDate(d.created_at)}</td>
                                <td className="px-2 py-1.5 text-gray-600 w-32">{d.responsible_user_id ? userNameById.get(d.responsible_user_id) : "—"}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: "open" | "won" | "lost" }) {
  const meta = {
    open: { label: "открыта", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    won: { label: "выиграна", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    lost: { label: "проиграна", cls: "bg-red-50 text-red-700 border-red-200" },
  }[status] || { label: status, cls: "bg-gray-50 text-gray-700 border-gray-200" }
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase rounded border tracking-wider", meta.cls)}>
      {meta.label}
    </span>
  )
}
