"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Search as SearchIcon, Layers, Tag, MousePointer, ArrowUpRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  getCustomerActivity,
  getCustomerActivitySummary,
  type CustomerActivityRow,
  type CustomerActivitySummary,
} from "@/app/actions/customer-activity"

const PERIODS = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "3months", label: "3 месяца" },
  { value: "all", label: "Всё время" },
] as const

const PER_PAGE = 50

// Убираем focus-обводку у Input/Select фильтров.
const NO_RING =
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"

type TabKey = "search" | "category_view" | "brand_view"

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function buildPageList(current: number, total: number, neighbours = 2): (number | "...")[] {
  if (total <= 1) return [1]
  const pages = new Set<number>()
  pages.add(1); pages.add(total)
  for (let i = current - neighbours; i <= current + neighbours; i++) {
    if (i >= 1 && i <= total) pages.add(i)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | "...")[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("...")
    out.push(sorted[i])
  }
  return out
}

export default function CustomerActivityPage() {
  const [tab, setTab] = useState<TabKey>("search")
  const [period, setPeriod] = useState<"today" | "week" | "month" | "3months" | "all">("month")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<CustomerActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [summary, setSummary] = useState<CustomerActivitySummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // debounce поиска
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // При смене таба/периода/поиска — сбрасываем на 1-ю страницу.
  useEffect(() => { setPage(1) }, [tab, period, debouncedSearch])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCustomerActivity({
        type: tab,
        period,
        search: debouncedSearch || undefined,
        page,
        per_page: PER_PAGE,
      })
      setRows(res.data || [])
      setTotal(res.pagination?.total ?? 0)
      setTotalPages(res.pagination?.total_pages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [tab, period, debouncedSearch, page])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await getCustomerActivitySummary({ period, limit: 20 })
      setSummary(res)
    } finally {
      setSummaryLoading(false)
    }
  }, [period])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadSummary() }, [loadSummary])

  const pageList = useMemo(() => buildPageList(page, totalPages, 2), [page, totalPages])

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle>Поисковые запросы клиентов</CardTitle>
          <CardDescription>
            Что искали, какие категории и бренды смотрели незалогиненные и клиентские пользователи.
            Админы и system-юзеры в статистику не попадают.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Верхняя полоса — период (общий для сводки и таблицы) */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="text-sm text-muted-foreground">Период:</div>
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger className={cn("sm:w-56", NO_RING)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Сводка: карточки-цифры + топы */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<SearchIcon className="h-4 w-4" />}
              label="Поисковых запросов"
              value={summary?.totals.search ?? 0}
              loading={summaryLoading}
            />
            <SummaryCard
              icon={<Layers className="h-4 w-4" />}
              label="Просмотров категорий"
              value={summary?.totals.category_view ?? 0}
              loading={summaryLoading}
            />
            <SummaryCard
              icon={<Tag className="h-4 w-4" />}
              label="Просмотров брендов"
              value={summary?.totals.brand_view ?? 0}
              loading={summaryLoading}
            />
          </div>

          {/* Табы: список событий с фильтром */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-lg bg-gray-100 p-1">
              <TabsTrigger value="search" className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black transition-all">
                Поиск
              </TabsTrigger>
              <TabsTrigger value="category_view" className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black transition-all">
                Категории
              </TabsTrigger>
              <TabsTrigger value="brand_view" className="rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black transition-all">
                Бренды
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              <Input
                placeholder="Поиск по запросу / названию категории или бренда…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={NO_RING}
              />

              <TabsContent value="search" className="m-0">
                <EventsTable
                  tab="search"
                  rows={rows}
                  loading={loading}
                  total={total}
                />
              </TabsContent>
              <TabsContent value="category_view" className="m-0">
                <EventsTable
                  tab="category_view"
                  rows={rows}
                  loading={loading}
                  total={total}
                />
              </TabsContent>
              <TabsContent value="brand_view" className="m-0">
                <EventsTable
                  tab="brand_view"
                  rows={rows}
                  loading={loading}
                  total={total}
                />
              </TabsContent>

              {totalPages > 1 && (
                <nav className="flex justify-center items-center gap-1 flex-wrap">
                  <Button
                    variant="outline"
                    className={NO_RING}
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Назад
                  </Button>
                  {pageList.map((p, i) =>
                    p === "..." ? (
                      <span key={`e-${i}`} className="px-2 text-muted-foreground select-none">…</span>
                    ) : (
                      <Button
                        key={p}
                        size="sm"
                        variant={p === page ? "default" : "outline"}
                        disabled={loading}
                        onClick={() => setPage(p)}
                        className={cn(
                          "min-w-9 px-3",
                          NO_RING,
                          p === page && "bg-brand-yellow text-black hover:bg-yellow-500",
                        )}
                      >
                        {p}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    className={NO_RING}
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Вперёд
                  </Button>
                </nav>
              )}
            </div>
          </Tabs>

          {/* Топ-N для текущего таба (по периоду) */}
          <TopList tab={tab} summary={summary} loading={summaryLoading} />
        </CardContent>
      </Card>
    </div>
  )
}

// ── Внутренние ────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, loading }: {
  icon: React.ReactNode
  label: string
  value: number
  loading: boolean
}) {
  return (
    <Card className="rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          {icon} {label}
        </div>
        <div className="text-2xl font-semibold">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value.toLocaleString("ru-RU")}
        </div>
      </CardContent>
    </Card>
  )
}

function EventsTable({ tab, rows, loading, total }: {
  tab: TabKey
  rows: CustomerActivityRow[]
  loading: boolean
  total: number
}) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-gray-50">
        Найдено: <Badge variant="outline">{total.toLocaleString("ru-RU")}</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Дата и время</TableHead>
            {tab === "search" && (
              <>
                <TableHead>Запрос</TableHead>
                <TableHead className="w-32">Найдено</TableHead>
              </>
            )}
            {tab === "category_view" && (
              <TableHead>Категория</TableHead>
            )}
            {tab === "brand_view" && (
              <TableHead>Бренд</TableHead>
            )}
            <TableHead className="w-32">Пользователь</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={4} className="text-center py-10">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Загрузка…
            </TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
              Событий пока нет
            </TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
              {tab === "search" && (
                <>
                  <TableCell className="font-medium">{r.query ?? "—"}</TableCell>
                  <TableCell>{r.results_count ?? "—"}</TableCell>
                </>
              )}
              {tab === "category_view" && (
                <TableCell>
                  {r.category_slug ? (
                    <Link
                      href={`/category/${r.category_slug}`}
                      target="_blank"
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {r.category_name ?? `#${r.category_id}`}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ) : (r.category_name ?? "—")}
                </TableCell>
              )}
              {tab === "brand_view" && (
                <TableCell>
                  {r.brand_name ? (
                    <Link
                      href={`/brand/${encodeURIComponent(r.brand_name)}`}
                      target="_blank"
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {r.brand_name}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ) : "—"}
                </TableCell>
              )}
              <TableCell className="text-xs">
                {r.user_id ? <Badge variant="outline">ID {r.user_id}</Badge> : <span className="text-muted-foreground">аноним</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TopList({ tab, summary, loading }: {
  tab: TabKey
  summary: CustomerActivitySummary | null
  loading: boolean
}) {
  if (loading || !summary) {
    return (
      <Card className="rounded-xl border border-gray-200">
        <CardContent className="p-4 text-sm text-muted-foreground">Загрузка топа…</CardContent>
      </Card>
    )
  }

  const items: Array<{ label: string; sublabel?: string; href?: string; count: number }> =
    tab === "search"
      ? summary.top_searches.map((s) => ({
          label: s.query,
          sublabel: s.last_results !== null ? `последний ответ: ${s.last_results} шт.` : undefined,
          count: s.count,
        }))
      : tab === "category_view"
      ? summary.top_categories.map((c) => ({
          label: c.name ?? (c.category_id ? `Категория #${c.category_id}` : "Удалено"),
          sublabel: c.slug ?? undefined,
          href: c.slug ? `/category/${c.slug}` : undefined,
          count: c.count,
        }))
      : summary.top_brands.map((b) => ({
          label: b.name ?? (b.brand_id ? `Бренд #${b.brand_id}` : "Удалено"),
          href: b.name ? `/brand/${encodeURIComponent(b.name)}` : undefined,
          count: b.count,
        }))

  if (items.length === 0) {
    return (
      <Card className="rounded-xl border border-gray-200">
        <CardContent className="p-4 text-sm text-muted-foreground text-center">
          За выбранный период пусто.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MousePointer className="h-4 w-4" />
          Топ-{items.length}: {tab === "search" ? "поисковые запросы" : tab === "category_view" ? "категории" : "бренды"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((it, i) => (
            <div key={`${it.label}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-gray-50">
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate font-medium">
                  {it.href ? (
                    <Link href={it.href} target="_blank" className="inline-flex items-center gap-1 hover:underline">
                      {it.label}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    it.label
                  )}
                </div>
                {it.sublabel && (
                  <div className="text-xs text-muted-foreground truncate">{it.sublabel}</div>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0">{it.count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
