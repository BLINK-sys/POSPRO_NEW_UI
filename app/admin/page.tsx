"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Users,
  UserCheck,
  Shield,
  Monitor,
  Smartphone,
  ShoppingCart,
  CircleDollarSign,
  CalendarIcon,
  Loader2,
  Bot,
  Eye,
  Trash2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { API_BASE_URL } from "@/lib/api-address"
import Image from "next/image"
import { ru } from "date-fns/locale"

type Period = "today" | "week" | "month" | "3months" | "custom"

interface DashboardStats {
  users: {
    total_clients: number
    total_wholesale: number
    total_system_users: number
  }
  visitors: {
    web: number
    mobile: number
    bots: number
    bots_total: number
  }
  requests: {
    orders: number
    price_inquiries: number
  }
  product_views: number
  recent_requests: {
    id: number
    request_type: string
    customer_name: string | null
    customer_phone: string | null
    product_name: string | null
    total_amount: number | null
    assigned_to: string | null
    created_at: string | null
  }[]
}

interface TopProduct {
  product_id: number
  product_name: string
  product_slug: string
  image_url: string | null
  views: number
  unique_views: number
}

interface VisitorDetail {
  ip: string
  user_agent: string | null
  visited_at: string | null
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  "3months": "3 месяца",
  custom: "Период",
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>("today")
  const [dateFrom, setDateFrom] = useState<Date | undefined>()
  const [dateTo, setDateTo] = useState<Date | undefined>()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [tempFrom, setTempFrom] = useState<Date | undefined>()
  const [tempTo, setTempTo] = useState<Date | undefined>()

  // Диалог детализации
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTitle, setDetailTitle] = useState("")
  const [detailData, setDetailData] = useState<VisitorDetail[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  // Для ботов — 2 вкладки
  const [detailType, setDetailType] = useState<"web" | "mobile" | "bot">("web")
  const [botTab, setBotTab] = useState<"period" | "all">("period")
  const [botAllData, setBotAllData] = useState<VisitorDetail[]>([])
  const [botAllLoading, setBotAllLoading] = useState(false)

  // Диалог топ товаров
  const [topProductsOpen, setTopProductsOpen] = useState(false)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [topProductsLoading, setTopProductsLoading] = useState(false)
  const [topLimit, setTopLimit] = useState(20)
  const [customLimit, setCustomLimit] = useState("")

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/admin/dashboard-stats?period=${period}`
      if (period === "custom" && dateFrom && dateTo) {
        url += `&date_from=${format(dateFrom, "yyyy-MM-dd")}&date_to=${format(dateTo, "yyyy-MM-dd")}`
      }

      const res = await fetch(url, { cache: "no-store" })
      const json = await res.json()

      if (json.success && json.data) {
        setStats(json.data)
      }
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error)
    } finally {
      setLoading(false)
    }
  }, [period, dateFrom, dateTo])

  useEffect(() => {
    if (period !== "custom" || (dateFrom && dateTo)) {
      fetchStats()
    }
  }, [fetchStats, period, dateFrom, dateTo])

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === "custom") {
      setPeriod("custom")
      setTempFrom(dateFrom)
      setTempTo(dateTo)
      setCalendarOpen(true)
    } else {
      setPeriod(newPeriod)
      setDateFrom(undefined)
      setDateTo(undefined)
      setTempFrom(undefined)
      setTempTo(undefined)
      setCalendarOpen(false)
    }
  }

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    setTempFrom(range?.from)
    setTempTo(range?.to)
  }

  const handleDateConfirm = () => {
    if (tempFrom && tempTo) {
      setDateFrom(tempFrom)
      setDateTo(tempTo)
      setCalendarOpen(false)
    }
  }

  const fetchVisitorDetails = async (deviceType: string, showAll = false) => {
    let url = `/api/admin/visitor-details?device_type=${deviceType}&period=${period}`
    if (showAll) {
      url = `/api/admin/visitor-details?device_type=${deviceType}&all=true`
    } else if (period === "custom" && dateFrom && dateTo) {
      url += `&date_from=${format(dateFrom, "yyyy-MM-dd")}&date_to=${format(dateTo, "yyyy-MM-dd")}`
    }

    const res = await fetch(url, { cache: "no-store" })
    const json = await res.json()
    return json.success ? json.data : []
  }

  const openDetail = async (type: "web" | "mobile" | "bot") => {
    setDetailType(type)
    setBotTab("period")
    setDetailOpen(true)
    setDetailLoading(true)
    setBotAllData([])

    const titles = { web: "Посетители WEB", mobile: "Посетители Mobile", bot: "Боты" }
    setDetailTitle(titles[type])

    try {
      const data = await fetchVisitorDetails(type)
      setDetailData(data)
    } catch {
      setDetailData([])
    } finally {
      setDetailLoading(false)
    }
  }

  const loadBotAll = async () => {
    setBotTab("all")
    if (botAllData.length > 0) return
    setBotAllLoading(true)
    try {
      const data = await fetchVisitorDetails("bot", true)
      setBotAllData(data)
    } catch {
      setBotAllData([])
    } finally {
      setBotAllLoading(false)
    }
  }

  const fetchTopProducts = async (limit: number) => {
    setTopProductsLoading(true)
    try {
      let url = `/api/admin/top-products?period=${period}&limit=${limit}`
      if (period === "custom" && dateFrom && dateTo) {
        url += `&date_from=${format(dateFrom, "yyyy-MM-dd")}&date_to=${format(dateTo, "yyyy-MM-dd")}`
      }
      const res = await fetch(url, { cache: "no-store" })
      const json = await res.json()
      if (json.success && json.data) {
        setTopProducts(json.data.products)
      }
    } catch {
      setTopProducts([])
    } finally {
      setTopProductsLoading(false)
    }
  }

  const openTopProducts = async () => {
    setTopProductsOpen(true)
    fetchTopProducts(topLimit)
  }

  const handleLimitChange = (limit: number) => {
    setTopLimit(limit)
    setCustomLimit("")
    fetchTopProducts(limit)
  }

  const handleCustomLimit = () => {
    const num = parseInt(customLimit)
    if (num > 0) {
      setTopLimit(num)
      fetchTopProducts(num)
    }
  }

  const handleClearViews = async () => {
    if (!confirm("Очистить все данные просмотров товаров?")) return
    try {
      await fetch("/api/admin/clear-product-views", { method: "DELETE" })
      setTopProducts([])
      fetchStats()
    } catch {}
  }

  const formatNumber = (n: number) => n.toLocaleString("ru-RU")

  const currentDetailRows = detailType === "bot" && botTab === "all" ? botAllData : detailData
  const currentDetailLoading = detailType === "bot" && botTab === "all" ? botAllLoading : detailLoading

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {/* Фильтр по периоду */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => {
          if (p === "custom") {
            return (
              <Popover key={p} open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={period === "custom" ? "default" : "outline"}
                    size="sm"
                    className="gap-1"
                    onClick={() => handlePeriodChange("custom")}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {period === "custom" && dateFrom && dateTo
                      ? `${format(dateFrom, "dd.MM.yy")} – ${format(dateTo, "dd.MM.yy")}`
                      : "Период"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={tempFrom ? { from: tempFrom, to: tempTo } : undefined}
                    onSelect={handleDateSelect as any}
                    numberOfMonths={2}
                    locale={ru}
                  />
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      {tempFrom && tempTo
                        ? `${format(tempFrom, "dd.MM.yy")} – ${format(tempTo, "dd.MM.yy")}`
                        : tempFrom
                          ? `${format(tempFrom, "dd.MM.yy")} – ...`
                          : "Выберите даты"}
                    </p>
                    <Button
                      size="sm"
                      disabled={!tempFrom || !tempTo}
                      onClick={handleDateConfirm}
                    >
                      ОК
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )
          }
          return (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => handlePeriodChange(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          )
        })}
      </div>

      {/* Карточки: Пользователи */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Клиенты"
          value={stats?.users.total_clients}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          subtitle="Всего зарегистрированных"
          loading={loading}
        />
        <StatCard
          title="Оптовые клиенты"
          value={stats?.users.total_wholesale}
          icon={<UserCheck className="h-4 w-4 text-muted-foreground" />}
          subtitle="С оптовым доступом"
          loading={loading}
        />
        <StatCard
          title="Системные пользователи"
          value={stats?.users.total_system_users}
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          subtitle="Администраторы"
          loading={loading}
        />
      </div>

      {/* Карточки: Посетители и заявки */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => openDetail("web")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Посетители WEB</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : stats?.visitors.web?.toLocaleString("ru-RU") ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Уникальные по IP</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => openDetail("mobile")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Посетители Mobile</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : stats?.visitors.mobile?.toLocaleString("ru-RU") ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Уникальные по IP</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => openDetail("bot")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Боты</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : stats?.visitors.bots?.toLocaleString("ru-RU") ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              За период · всего {loading ? "—" : stats?.visitors.bots_total?.toLocaleString("ru-RU") ?? 0}
            </p>
          </CardContent>
        </Card>
        <StatCard
          title="Оформление заказа"
          value={stats?.requests.orders}
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
          subtitle="Заявок за период"
          loading={loading}
        />
        <StatCard
          title="Уточнение цены"
          value={stats?.requests.price_inquiries}
          icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
          subtitle="Запросов за период"
          loading={loading}
        />
      </div>

      {/* Топ просматриваемых товаров */}
      <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={openTopProducts}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Просмотры товаров</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? "—" : stats?.product_views?.toLocaleString("ru-RU") ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">Просмотров за период · нажмите для топа товаров</p>
        </CardContent>
      </Card>

      {/* Последние заявки */}
      <Card>
        <CardHeader>
          <CardTitle>Последние заявки</CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.recent_requests?.length ? (
            <p className="text-sm text-muted-foreground">Заявок пока нет.</p>
          ) : (
            <div className="space-y-3">
              {stats.recent_requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {r.request_type === "order" ? (
                      <ShoppingCart className="h-4 w-4 text-green-600" />
                    ) : (
                      <CircleDollarSign className="h-4 w-4 text-blue-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {r.customer_name || "—"}
                        {r.customer_phone && (
                          <span className="ml-2 font-normal text-muted-foreground">{r.customer_phone}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.request_type === "order" ? "Заказ" : "Уточнение цены"}
                        {r.product_name && ` · ${r.product_name}`}
                        {r.assigned_to && ` → ${r.assigned_to}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {r.total_amount != null && (
                      <p className="text-sm font-medium">
                        {formatNumber(r.total_amount)} ₸
                      </p>
                    )}
                    {r.created_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "dd.MM.yy HH:mm", { locale: ru })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог детализации посетителей */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>

          {/* Вкладки для ботов */}
          {detailType === "bot" && (
            <div className="flex gap-2">
              <Button
                variant={botTab === "period" ? "default" : "outline"}
                size="sm"
                onClick={() => setBotTab("period")}
              >
                За период
              </Button>
              <Button
                variant={botTab === "all" ? "default" : "outline"}
                size="sm"
                onClick={loadBotAll}
              >
                Все
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {currentDetailLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentDetailRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">IP</th>
                    <th className="pb-2 pr-4">User-Agent</th>
                    <th className="pb-2">Время</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDetailRows.map((v, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{v.ip}</td>
                      <td className="max-w-md truncate py-2 pr-4 text-xs text-muted-foreground">
                        {v.user_agent || "—"}
                      </td>
                      <td className="py-2 text-xs whitespace-nowrap">
                        {v.visited_at
                          ? format(new Date(v.visited_at), "dd.MM.yy HH:mm", { locale: ru })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t pt-2 text-xs text-muted-foreground">
            Записей: {currentDetailRows.length}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог топ товаров */}
      <Dialog open={topProductsOpen} onOpenChange={setTopProductsOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Топ просматриваемых товаров</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            {[5, 10, 20, 50].map((n) => (
              <Button
                key={n}
                variant={topLimit === n && !customLimit ? "default" : "outline"}
                size="sm"
                onClick={() => handleLimitChange(n)}
              >
                {n}
              </Button>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Своё"
                className="h-8 w-20"
                value={customLimit}
                onChange={(e) => setCustomLimit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomLimit()}
              />
              <Button size="sm" variant="outline" onClick={handleCustomLimit} disabled={!customLimit}>
                ОК
              </Button>
            </div>
            <div className="ml-auto">
              <Button size="sm" variant="destructive" className="gap-1" onClick={handleClearViews}>
                <Trash2 className="h-3 w-3" />
                Очистить
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {topProductsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topProducts.map((p, i) => (
                  <a
                    key={p.product_id}
                    href={`/product/${p.product_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      {p.image_url ? (
                        <img
                          src={p.image_url.startsWith("http") ? p.image_url : `${API_BASE_URL}${p.image_url}`}
                          alt={p.product_name}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          Нет фото
                        </div>
                      )}
                      <div className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-br-md bg-black/60 text-[10px] font-bold text-white">
                        {i + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.product_name || `ID ${p.product_id}`}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span className="font-semibold text-foreground">{p.views}</span> просм.
                        </span>
                        <span>
                          <span className="font-semibold text-foreground">{p.unique_views}</span> уник.
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-2 text-xs text-muted-foreground">
            Товаров: {topProducts.length}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
  loading,
}: {
  title: string
  value: number | undefined
  icon: React.ReactNode
  subtitle: string
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? "—" : value?.toLocaleString("ru-RU") ?? 0}
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
