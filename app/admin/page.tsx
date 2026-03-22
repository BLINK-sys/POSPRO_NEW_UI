"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
} from "lucide-react"
import { format } from "date-fns"
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
  recent_requests: {
    id: number
    request_type: string
    customer_name: string | null
    customer_phone: string | null
    product_name: string | null
    total_amount: number | null
    created_at: string | null
  }[]
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

  const formatNumber = (n: number) => n.toLocaleString("ru-RU")

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
        <StatCard
          title="Посетители WEB"
          value={stats?.visitors.web}
          icon={<Monitor className="h-4 w-4 text-muted-foreground" />}
          subtitle="Уникальные по IP"
          loading={loading}
        />
        <StatCard
          title="Посетители Mobile"
          value={stats?.visitors.mobile}
          icon={<Smartphone className="h-4 w-4 text-muted-foreground" />}
          subtitle="Уникальные по IP"
          loading={loading}
        />
        <Card>
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
                        {r.customer_name || r.customer_phone || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.request_type === "order" ? "Заказ" : "Уточнение цены"}
                        {r.product_name && ` · ${r.product_name}`}
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
