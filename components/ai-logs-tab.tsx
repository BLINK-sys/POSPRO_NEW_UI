"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ChevronLeft, ChevronRight, MessageSquare, Wand2, ChevronDown, Search, X, Check, AlertCircle, Package } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  listImportLogs,
  listChatSessions,
  getChatSession,
  listLoggedSystemUsers,
  type AIImportLog,
  type AIChatSession,
  type LoggedSystemUser,
  type UserRole,
  type ImportLogStatus,
} from "@/app/actions/ai-logs"


// ───────────────────────────── helpers ─────────────────────────────

// Роль 'admin' (владелец) фактически — частный случай системного юзера,
// в фильтре отдельно не показывается. В сохранённых записях лога роль
// может быть 'admin' (если писали под владельцем) — для отображения
// схлопываем в «Системный» через roleDisplayLabel().
const ROLE_LABELS: Record<Exclude<UserRole, "admin"> | "all", string> = {
  all: "Все типы",
  guest: "Гость",
  client: "Зарегистрированный",
  wholesale: "Оптовик",
  system: "Системный",
}

function roleDisplayLabel(role: string | null | undefined): string {
  if (role === "admin") return ROLE_LABELS.system
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role || "—"
}

const STATUS_LABELS: Record<ImportLogStatus | "all", string> = {
  all: "Все статусы",
  saved: "Добавлен в магазин",
  imported: "Импортирован, но не сохранён",
  error: "Ошибка импорта",
}

const STATUS_BADGE: Record<ImportLogStatus, { label: string; className: string; icon: any }> = {
  saved: { label: "Добавлен в магазин", className: "bg-green-100 text-green-800 border-green-200", icon: Check },
  imported: { label: "Импортирован, но не сохранён", className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Package },
  error: { label: "Ошибка импорта", className: "bg-red-100 text-red-800 border-red-200", icon: AlertCircle },
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("ru", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return iso
  }
}

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"

const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-shadow"


// ───────────────────────────── shared filter bar ─────────────────────

type FilterRole = Exclude<UserRole, "admin"> | "all"

interface FilterBarProps {
  userRole: FilterRole
  setUserRole: (r: FilterRole) => void
  userId: number | "all"
  setUserId: (id: number | "all") => void
  systemUsers: LoggedSystemUser[]
  search: string
  setSearch: (s: string) => void
  dateFrom: string
  setDateFrom: (s: string) => void
  dateTo: string
  setDateTo: (s: string) => void
  // optional extra filter (status — для импорта)
  extraSlot?: React.ReactNode
  total: number
  loading: boolean
  onReset: () => void
}

function FilterBar({
  userRole, setUserRole, userId, setUserId, systemUsers,
  search, setSearch, dateFrom, setDateFrom, dateTo, setDateTo,
  extraSlot, total, loading, onReset,
}: FilterBarProps) {
  // Owner ('admin') считается частью «Системный» — отдельного варианта в селекте нет
  const showUserPicker = userRole === "system"
  return (
    <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Тип пользователя */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs text-gray-500">Тип пользователя</label>
            <Select value={userRole} onValueChange={(v) => { setUserRole(v as FilterRole); setUserId("all") }}>
              <SelectTrigger className={SOFT_CONTROL}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as FilterRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Конкретный системный пользователь */}
          {showUserPicker && (
            <div className="flex flex-col gap-1 min-w-[220px]">
              <label className="text-xs text-gray-500">Пользователь</label>
              <Select value={String(userId)} onValueChange={(v) => setUserId(v === "all" ? "all" : Number(v))}>
                <SelectTrigger className={SOFT_CONTROL}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все пользователи</SelectItem>
                  {systemUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Период */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">С</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`${SOFT_CONTROL} w-[150px]`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">По</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`${SOFT_CONTROL} w-[150px]`}
            />
          </div>

          {extraSlot}

          {/* Поиск */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="URL / товар / email / текст..."
                className={`${SOFT_CONTROL} pl-9`}
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={onReset}
            className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
          >
            <X className="h-4 w-4 mr-1.5" />
            Сбросить
          </Button>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            {loading ? "Загрузка..." : `Найдено: ${total.toLocaleString("ru-RU")}`}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}


// ───────────────────────────── pagination footer ─────────────────────

function Pagination({ page, perPage, total, onPageChange }: {
  page: number
  perPage: number
  total: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded-lg"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-gray-600">
        Стр. {page} из {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded-lg"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}


// ───────────────────────────── Imports tab ───────────────────────────

function ImportLogsView({ systemUsers }: { systemUsers: LoggedSystemUser[] }) {
  const [items, setItems] = useState<AIImportLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [page, setPage] = useState(1)
  const perPage = 25

  const [userRole, setUserRole] = useState<FilterRole>("all")
  const [userId, setUserId] = useState<number | "all">("all")
  const [status, setStatus] = useState<ImportLogStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")

  // Дебаунс поиска — 400мс, чтобы не дёргать сервер на каждый ввод символа
  const [searchDebounced, setSearchDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listImportLogs({
      status: status === "all" ? undefined : status,
      user_role: userRole === "all" ? undefined : userRole,
      user_id: userId === "all" ? undefined : userId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: searchDebounced || undefined,
      page,
      per_page: perPage,
    })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [status, userRole, userId, dateFrom, dateTo, searchDebounced, page])

  // При изменении любого фильтра — сбрасываем на первую страницу
  useEffect(() => { setPage(1) }, [status, userRole, userId, dateFrom, dateTo, searchDebounced])

  const handleReset = () => {
    setUserRole("all")
    setUserId("all")
    setStatus("all")
    setDateFrom("")
    setDateTo("")
    setSearch("")
  }

  const statusFilter = (
    <div className="flex flex-col gap-1 min-w-[220px]">
      <label className="text-xs text-gray-500">Статус</label>
      <Select value={status} onValueChange={(v) => setStatus(v as any)}>
        <SelectTrigger className={SOFT_CONTROL}><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(STATUS_LABELS) as Array<ImportLogStatus | "all">).map((s) => (
            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="space-y-4">
      <FilterBar
        userRole={userRole} setUserRole={setUserRole}
        userId={userId} setUserId={setUserId}
        systemUsers={systemUsers}
        search={search} setSearch={setSearch}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        extraSlot={statusFilter}
        total={total}
        loading={loading}
        onReset={handleReset}
      />

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardContent className="py-12 text-center text-gray-400">
            Логов импорта не найдено по текущим фильтрам
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((log) => {
            const sb = STATUS_BADGE[log.status]
            const Icon = sb.icon
            return (
              <Card
                key={log.id}
                className="rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={`${sb.className} gap-1`}>
                          <Icon className="h-3 w-3" />
                          {sb.label}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <a
                        href={log.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {log.source_url}
                      </a>
                    </div>
                    <div className="text-right text-xs text-gray-500 shrink-0">
                      <div>{log.user_email}</div>
                      <div className="text-gray-400">{roleDisplayLabel(log.user_role)}</div>
                    </div>
                  </div>

                  {log.imported_data && (
                    <div className="text-xs text-gray-600 bg-gray-50 rounded-md p-2 flex flex-wrap gap-x-4 gap-y-1">
                      {log.imported_data.name && <span><b>Название:</b> {log.imported_data.name}</span>}
                      {log.imported_data.characteristics_count != null && (
                        <span><b>Характ.:</b> {log.imported_data.characteristics_count}</span>
                      )}
                      {log.imported_data.images_count != null && (
                        <span><b>Фото:</b> {log.imported_data.images_count}</span>
                      )}
                      {log.imported_data.description_length != null && (
                        <span><b>Описание:</b> {log.imported_data.description_length} симв.</span>
                      )}
                    </div>
                  )}

                  {log.product_id && log.product_name && (
                    <div className="text-xs text-green-700 bg-green-50 rounded-md p-2">
                      ✓ Сохранён как товар <b>«{log.product_name}»</b> (ID {log.product_id})
                    </div>
                  )}

                  {log.error_message && (
                    <div className="text-xs text-red-700 bg-red-50 rounded-md p-2 break-words">
                      <b>Ошибка:</b> {log.error_message}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />
    </div>
  )
}


// ───────────────────────────── Chat tab ──────────────────────────────

function ChatLogsView({ systemUsers }: { systemUsers: LoggedSystemUser[] }) {
  const [items, setItems] = useState<AIChatSession[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [page, setPage] = useState(1)
  const perPage = 25

  const [userRole, setUserRole] = useState<FilterRole>("all")
  const [userId, setUserId] = useState<number | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")

  const [searchDebounced, setSearchDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Открытая сессия для просмотра полного диалога
  const [openSession, setOpenSession] = useState<AIChatSession | null>(null)
  const [openSessionLoading, setOpenSessionLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listChatSessions({
      user_role: userRole === "all" ? undefined : userRole,
      user_id: userId === "all" ? undefined : userId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: searchDebounced || undefined,
      page,
      per_page: perPage,
    })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userRole, userId, dateFrom, dateTo, searchDebounced, page])

  useEffect(() => { setPage(1) }, [userRole, userId, dateFrom, dateTo, searchDebounced])

  const openSessionMessages = async (session: AIChatSession) => {
    setOpenSessionLoading(true)
    setOpenSession(session)
    try {
      const full = await getChatSession(session.id)
      if (full) setOpenSession(full)
    } finally {
      setOpenSessionLoading(false)
    }
  }

  const handleReset = () => {
    setUserRole("all")
    setUserId("all")
    setDateFrom("")
    setDateTo("")
    setSearch("")
  }

  return (
    <div className="space-y-4">
      <FilterBar
        userRole={userRole} setUserRole={setUserRole}
        userId={userId} setUserId={setUserId}
        systemUsers={systemUsers}
        search={search} setSearch={setSearch}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        total={total}
        loading={loading}
        onReset={handleReset}
      />

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardContent className="py-12 text-center text-gray-400">
            Чат-сессий не найдено по текущим фильтрам
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((s) => {
            const userLabel = s.user_name || s.user_email || "Гость"
            return (
              <Card
                key={s.id}
                className="rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-all cursor-pointer"
                onClick={() => openSessionMessages(s)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-yellow/15 shrink-0">
                    <MessageSquare className="h-5 w-5 text-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium text-sm">{userLabel}</span>
                      <Badge variant="outline" className="text-xs">
                        {roleDisplayLabel(s.user_role)}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        · {s.message_count} сообщ.
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Начало: {formatDate(s.started_at)} · Последнее: {formatDate(s.last_message_at)}
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-400 -rotate-90 shrink-0" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />

      {/* Modal: full chat transcript */}
      <Dialog open={!!openSession} onOpenChange={(o) => !o && setOpenSession(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 flex-shrink-0">
            <DialogTitle>Диалог с AI Консультантом</DialogTitle>
            {openSession && (
              <div className="text-xs text-gray-500 mt-1">
                {openSession.user_name || openSession.user_email || "Гость"} ·{" "}
                {roleDisplayLabel(openSession.user_role)} ·{" "}
                {formatDate(openSession.started_at)}
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
            {openSessionLoading && !openSession?.messages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : openSession?.messages?.length ? (
              openSession.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-3 max-w-[85%] ${
                    m.role === "user"
                      ? "bg-brand-yellow/15 ml-auto"
                      : "bg-gray-100 mr-auto"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                    {m.role === "user" ? "Пользователь" : "AI"} · {formatDate(m.created_at)}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">
                В сессии нет сообщений
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


// ───────────────────────────── main tab ──────────────────────────────

export function AILogsTab() {
  const [systemUsers, setSystemUsers] = useState<LoggedSystemUser[]>([])

  // Грузим один раз — список юзеров для фильтра не меняется так часто
  useEffect(() => {
    let cancelled = false
    listLoggedSystemUsers().then((users) => {
      if (!cancelled) setSystemUsers(users)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <Tabs defaultValue="imports">
        <TabsList className="rounded-lg bg-gray-100 p-1">
          <TabsTrigger
            value="imports"
            className="gap-2 rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            <Wand2 className="h-4 w-4" />
            Импорт товаров
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="gap-2 rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            Чат-консультант
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imports" className="mt-4">
          <ImportLogsView systemUsers={systemUsers} />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <ChatLogsView systemUsers={systemUsers} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
