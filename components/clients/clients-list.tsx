"use client"

/**
 * CRM-справочник клиентов (/admin/clients). Shared-пул: используется в
 * КП (`kp_history.client_id`), сделках (`deal.client_id`), задачах
 * (`task.client_id`). Удаление разрешено, но бэк возвращает 409 если
 * клиент используется хотя бы в одном КП / сделке / задаче — чтобы не
 * осиротить документы. Текст ошибки показываем как есть в toast.
 *
 * Бэк: /api/kp-clients.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2, Loader2, Pencil, Phone, Plus, Search, Trash2, Users, X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import { cn, formatPhone } from "@/lib/utils"
import CompanyPickerDialog from "@/components/deals/company-picker-dialog"
import KpCompanyQuickCreateDialog from "@/components/deals/kp-company-quick-create"
import { TablePager } from "@/components/ui/table-pager"

interface Contact {
  phone: string
  note?: string
}

interface Creator {
  id: number
  name: string
  email: string
}

interface Client {
  id: number
  full_name: string | null
  object: string | null
  contacts: Contact[]
  display_name: string
  company_id: number | null
  kp_count?: number
  deal_count?: number
  task_count?: number
  created_by: number | null
  creator: Creator | null
  created_at: string | null
  updated_at: string | null
}

interface CompanyLite {
  id: number
  name: string
}

interface FormState {
  id: number | null
  full_name: string
  object: string
  company_id: number | null
  contacts: Contact[]
}

const EMPTY_FORM: FormState = {
  id: null,
  full_name: "",
  object: "",
  company_id: null,
  contacts: [{ phone: "", note: "" }],
}

export default function ClientsList() {
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [companies, setCompanies] = useState<CompanyLite[]>([])
  const [creatorOptions, setCreatorOptions] = useState<Creator[]>([])
  const [hasNullCreator, setHasNullCreator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [creatorFilter, setCreatorFilter] = useState<string>("all")
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Пикер и квик-создание компании — внутри модалки клиента.
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false)
  const [companyCreateOpen, setCompanyCreateOpen] = useState(false)

  // Пагинация. Серверная — иначе на 29k контактах фронт умрёт на парсе.
  const PAGE_SIZES = [25, 50, 100] as const
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Debounce query — иначе каждый keystroke дёргает бэк.
  const [debouncedQuery, setDebouncedQuery] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Любая смена фильтра/поиска/размера → возвращаемся на страницу 1.
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, creatorFilter, pageSize])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("with_counts", "1")
    if (debouncedQuery) params.set("q", debouncedQuery)
    if (creatorFilter === "none") params.set("creator_id", "none")
    else if (creatorFilter !== "all") params.set("creator_id", creatorFilter)
    params.set("limit", String(pageSize))
    params.set("offset", String((page - 1) * pageSize))

    crmGet<{ clients: Client[]; total?: number }>(`/api/kp-clients?${params.toString()}`)
      .then((res) => {
        setClients(res.clients || [])
        setTotal(res.total || (res.clients || []).length)
      })
      .catch((e) =>
        toast({
          variant: "destructive",
          title: "Не удалось загрузить клиентов",
          description: e?.message,
        }),
      )
      .finally(() => setLoading(false))
  }, [toast, debouncedQuery, creatorFilter, page, pageSize])

  const loadCompanies = useCallback(() => {
    // Для dropdown-пикера компании — грузим только названия (без контента).
    // 500 имён — максимум что отдаст бэк в одной странице, этого достаточно
    // для MVP (при >500 придётся переходить на серверный поиск внутри пикера).
    crmGet<{ companies: CompanyLite[] }>("/api/admin/kp-companies?limit=500")
      .then((res) =>
        setCompanies(
          (res.companies || []).map((c) => ({ id: c.id, name: c.name })),
        ),
      )
      .catch(() => {
        /* тихо — выпадашка просто окажется пустой */
      })
  }, [])

  const loadCreators = useCallback(() => {
    crmGet<{ creators: Creator[]; has_null: boolean }>(
      "/api/kp-clients/creators",
    )
      .then((res) => {
        setCreatorOptions(res.creators || [])
        setHasNullCreator(Boolean(res.has_null))
      })
      .catch(() => {
        setCreatorOptions([])
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadCompanies()
    loadCreators()
  }, [loadCompanies, loadCreators])

  const companiesById = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  )

  // Серверная фильтрация + пагинация → показываем всё что пришло.
  const filtered = clients

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—"
    try {
      const d = new Date(iso)
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    } catch {
      return "—"
    }
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }
  const openEdit = (c: Client) => {
    setForm({
      id: c.id,
      full_name: c.full_name || "",
      object: c.object || "",
      company_id: c.company_id ?? null,
      contacts:
        c.contacts && c.contacts.length > 0
          ? c.contacts.map((ct) => ({
              phone: ct.phone ? formatPhone(ct.phone) : "",
              note: ct.note || "",
            }))
          : [{ phone: "", note: "" }],
    })
    setEditorOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await crmDelete(`/api/kp-clients/${deleteTarget.id}`)
      toast({ title: "Клиент удалён" })
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      // Бэк отдаёт 409 с осмысленным текстом когда клиент используется
      // в КП / сделках / задачах — показываем как есть.
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    } finally {
      setDeleting(false)
    }
  }

  const addContactRow = () =>
    setForm((f) => ({ ...f, contacts: [...f.contacts, { phone: "", note: "" }] }))
  const removeContactRow = (idx: number) =>
    setForm((f) => ({
      ...f,
      contacts:
        f.contacts.length === 1
          ? [{ phone: "", note: "" }]
          : f.contacts.filter((_, i) => i !== idx),
    }))
  const updateContact = (idx: number, patch: Partial<Contact>) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((ct, i) => (i === idx ? { ...ct, ...patch } : ct)),
    }))

  const handleSubmit = async () => {
    const full_name = form.full_name.trim()
    if (!full_name) {
      toast({ variant: "destructive", title: "ФИО обязательно" })
      return
    }
    const cleanedContacts = form.contacts
      .map((c) => ({ phone: (c.phone || "").trim(), note: (c.note || "").trim() }))
      .filter((c) => c.phone)
    const payload = {
      full_name,
      object: form.object.trim() || null,
      company_id: form.company_id,
      contacts: cleanedContacts,
    }
    setSaving(true)
    try {
      if (form.id == null) {
        await crmPost("/api/kp-clients", payload)
        toast({ title: "Клиент создан" })
      } else {
        await crmPut(`/api/kp-clients/${form.id}`, payload)
        toast({ title: "Клиент обновлён" })
      }
      setEditorOpen(false)
      load()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось сохранить",
        description: e?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Клиенты</h1>
            <p className="text-sm text-gray-500">
              Общий справочник для КП, сделок и задач
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-brand-yellow text-black hover:bg-yellow-500 rounded-full"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Новый клиент
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск по ФИО, объекту, телефону"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-64 shrink-0">
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Чей клиент" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все пользователи</SelectItem>
              {hasNullCreator && (
                <SelectItem value="none">— без автора —</SelectItem>
              )}
              {creatorOptions.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-xl border-gray-200 p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-16">
            {query ? "Ничего не найдено" : "Клиентов пока нет"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-56">ФИО</th>
                <th className="text-left px-3 py-2 font-medium">Объект</th>
                <th className="text-left px-3 py-2 font-medium">Контакты</th>
                <th className="text-left px-3 py-2 font-medium">Заметка</th>
                <th className="text-center px-3 py-2 font-medium w-16">КП</th>
                <th className="text-center px-3 py-2 font-medium w-16">Сделки</th>
                <th className="text-center px-3 py-2 font-medium w-16">Задачи</th>
                <th className="text-left px-3 py-2 font-medium w-56">Кем создан</th>
                <th className="text-left px-3 py-2 font-medium w-28">Дата</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const used = (c.kp_count || 0) + (c.deal_count || 0) + (c.task_count || 0)
                return (
                  <tr
                    key={c.id}
                    className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium">
                      {c.full_name || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate">
                      {c.object || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {c.contacts && c.contacts.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.contacts.map((ct, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5 whitespace-nowrap"
                            >
                              <Phone className="h-3 w-3 text-gray-500" />
                              {ct.phone ? formatPhone(ct.phone) : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-xs">
                      {c.contacts && c.contacts.some((ct) => ct.note) ? (
                        <div className="flex flex-col gap-0.5">
                          {c.contacts
                            .filter((ct) => ct.note)
                            .map((ct, i) => (
                              <span key={i} className="truncate">
                                {ct.note}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className={cn("text-center tabular-nums", !c.kp_count && "text-gray-300")}>
                      {c.kp_count ?? 0}
                    </td>
                    <td className={cn("text-center tabular-nums", !c.deal_count && "text-gray-300")}>
                      {c.deal_count ?? 0}
                    </td>
                    <td className={cn("text-center tabular-nums", !c.task_count && "text-gray-300")}>
                      {c.task_count ?? 0}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {c.creator ? c.creator.name : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(c.created_at)}
                    </td>
                    <td className="px-2">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                          className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-900"
                          title={used > 0 ? `Используется в ${used} местах` : "Редактировать"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(c)}
                          className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
                          title={used > 0
                            ? `Нельзя удалить — используется в ${used} местах`
                            : "Удалить"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {total > 0 && (
        <TablePager
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sizes={PAGE_SIZES}
        />
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {form.id == null ? "Новый клиент" : "Клиент"}
            </DialogTitle>
          </DialogHeader>
          {/* Две колонки:
                [1] основные поля клиента (ФИО / Компания / Объект)
                [2] массив контактов (телефон + заметка) + «Добавить»
              На узких экранах — одна колонка (стакаем). Правая колонка
              со своим overflow-y-auto и max-height — если контактов много,
              она скроллится независимо от левой. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ─────────── Левая колонка ─────────── */}
            <div className="space-y-3 min-w-0">
              <div className="space-y-1">
                <Label>ФИО *</Label>
                <Input
                  autoFocus
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Например: Иванов Иван"
                />
              </div>
              <div className="space-y-1">
                <Label>Компания</Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCompanyPickerOpen(true)}
                    className={cn(
                      "flex-1 min-w-0 h-10 px-3 text-sm text-left rounded-md border border-input bg-background",
                      "flex items-center gap-2 hover:bg-gray-50 transition-colors",
                    )}
                  >
                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                    {form.company_id != null ? (
                      <span className="truncate text-gray-800">
                        {companiesById.get(form.company_id) ?? `Компания #${form.company_id}`}
                      </span>
                    ) : (
                      <span className="text-gray-400">— без компании —</span>
                    )}
                    {form.company_id != null && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setForm({ ...form, company_id: null })
                        }}
                        className="ml-auto h-6 w-6 inline-flex items-center justify-center text-gray-400 hover:text-red-500 rounded cursor-pointer"
                        aria-label="Очистить"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Объект</Label>
                <Textarea
                  rows={3}
                  value={form.object}
                  onChange={(e) => setForm({ ...form, object: e.target.value })}
                  placeholder="Название компании, адрес объекта…"
                />
              </div>
            </div>

            {/* ─────────── Правая колонка: контакты ─────────── */}
            <div className="flex flex-col min-w-0">
              <Label className="mb-1 shrink-0">Контакты</Label>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 flex-1">
                {form.contacts.map((ct, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50/40"
                  >
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={ct.phone}
                        onFocus={() => {
                          if (!ct.phone) updateContact(i, { phone: "+7 (" })
                        }}
                        onChange={(e) =>
                          updateContact(i, { phone: formatPhone(e.target.value) })
                        }
                        placeholder="+7 (___) ___-__-__"
                        className="w-56 shrink-0"
                        inputMode="tel"
                      />
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContactRow(i)}
                        className="h-10 w-10 shrink-0 text-gray-400 hover:text-red-500"
                        title="Убрать"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={ct.note || ""}
                      onChange={(e) => updateContact(i, { note: e.target.value })}
                      placeholder="заметка (например «WhatsApp», «после 18:00»)"
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addContactRow}
                className="w-full mt-2 shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить телефон
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Серверный пикер компании (бесконечный скролл по /api/admin/kp-companies). */}
      <CompanyPickerDialog
        open={companyPickerOpen}
        onOpenChange={setCompanyPickerOpen}
        title="Выбрать компанию"
        value={form.company_id ?? null}
        onChange={(id) => setForm({ ...form, company_id: id })}
        allowClear
        onCreateNew={() => setCompanyCreateOpen(true)}
      />

      <KpCompanyQuickCreateDialog
        open={companyCreateOpen}
        onOpenChange={setCompanyCreateOpen}
        onCreated={(co) => {
          // Добавляем в локальный список компаний (чтобы пикер её сразу
          // увидел при следующем открытии) и выставляем на форме.
          setCompanies((prev) =>
            prev.some((x) => x.id === co.id)
              ? prev
              : [...prev, { id: co.id, name: co.name }],
          )
          setForm((p) => ({ ...p, company_id: co.id }))
        }}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Клиент <strong>«{deleteTarget.full_name || "—"}»</strong> будет
                  удалён. Если на него есть ссылки в КП, сделках или задачах —
                  бэк вернёт ошибку и удаление не произойдёт.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Удаляю…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
