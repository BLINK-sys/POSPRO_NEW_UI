"use client"

/**
 * CRM-справочник компаний (/admin/clients?tab=companies). Shared-пул.
 * Удаление доступно — связанные контакты получат company_id=NULL,
 * сделки — company_id=NULL (SET NULL на уровне FK). Если позже решим
 * запрещать удаление с ссылками — поднимем 409 на бэке.
 *
 * Бэк: /api/admin/kp-companies.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Building2, Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import { formatPhone } from "@/lib/utils"
import { TablePager } from "@/components/ui/table-pager"

interface Creator { id: number; name: string; email: string }

export interface Company {
  id: number
  name: string
  bin: string | null
  address: string | null
  website: string | null
  phone: string | null
  email: string | null
  note: string | null
  clients_count?: number
  created_by: number | null
  creator: { id: number; name: string; email: string } | null
  created_at: string | null
  updated_at: string | null
}

interface FormState {
  id: number | null
  name: string
  bin: string
  address: string
  website: string
  phone: string
  email: string
  note: string
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  bin: "",
  address: "",
  website: "",
  phone: "",
  email: "",
  note: "",
}

export default function CompaniesList() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)

  // Серверная пагинация. Бэк умеет q/limit/offset/total — используем.
  const PAGE_SIZES = [25, 50, 100] as const
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Фильтр «Кем создана». "all" — не фильтруем, "none" — без автора,
  // "<id>" — конкретный пользователь. Опции тянем раз при монтировании
  // с `/api/admin/kp-companies/creators`.
  const [creatorFilter, setCreatorFilter] = useState<string>("all")
  const [creatorOptions, setCreatorOptions] = useState<Creator[]>([])
  const [hasNullCreator, setHasNullCreator] = useState(false)

  const [debouncedQuery, setDebouncedQuery] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, creatorFilter, pageSize])

  useEffect(() => {
    crmGet<{ creators: Creator[]; has_null: boolean }>(
      "/api/admin/kp-companies/creators",
    )
      .then((res) => {
        setCreatorOptions(res.creators || [])
        setHasNullCreator(Boolean(res.has_null))
      })
      .catch(() => {
        setCreatorOptions([])
        setHasNullCreator(false)
      })
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedQuery) params.set("q", debouncedQuery)
    if (creatorFilter === "none") params.set("creator_id", "none")
    else if (creatorFilter !== "all") params.set("creator_id", creatorFilter)
    params.set("limit", String(pageSize))
    params.set("offset", String((page - 1) * pageSize))
    crmGet<{ companies: Company[]; total?: number }>(
      `/api/admin/kp-companies?${params.toString()}`,
    )
      .then((res) => {
        setCompanies(res.companies || [])
        setTotal(res.total || (res.companies || []).length)
      })
      .catch((e) =>
        toast({
          variant: "destructive",
          title: "Не удалось загрузить компании",
          description: e?.message,
        }),
      )
      .finally(() => setLoading(false))
  }, [toast, debouncedQuery, creatorFilter, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  // Серверный поиск → показываем всё что пришло.
  const filtered = companies

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const openEdit = (c: Company) => {
    setForm({
      id: c.id,
      name: c.name,
      bin: c.bin || "",
      address: c.address || "",
      website: c.website || "",
      phone: c.phone || "",
      email: c.email || "",
      note: c.note || "",
    })
    setEditorOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Укажите название компании" })
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        bin: form.bin.trim() || null,
        address: form.address.trim() || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        note: form.note.trim() || null,
      }
      if (form.id) {
        await crmPut(`/api/admin/kp-companies/${form.id}`, body)
      } else {
        await crmPost("/api/admin/kp-companies", body)
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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await crmDelete(`/api/admin/kp-companies/${deleteTarget.id}`)
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Компании</h1>
            <p className="text-sm text-gray-500">Всего: {total}</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-brand-yellow text-black hover:bg-yellow-500 rounded-full"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Новая компания
        </Button>
      </div>

      {/* Поиск + фильтр «Кем создана» */}
      <Card className="rounded-xl border-gray-200 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название / БИН / телефон / email"
              className="h-9 pl-9 rounded-lg"
            />
          </div>
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger className="h-9 w-[220px] rounded-lg">
              <SelectValue placeholder="Все пользователи" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все пользователи</SelectItem>
              {hasNullCreator && (
                <SelectItem value="none">— без автора —</SelectItem>
              )}
              {creatorOptions.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Таблица */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-16">
            {query ? "Ничего не найдено" : "Компаний пока нет"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2.5 font-normal">Название</th>
                  <th className="text-left px-3 py-2.5 font-normal w-[140px]">БИН/ИНН</th>
                  <th className="text-left px-3 py-2.5 font-normal w-[180px]">Телефон</th>
                  <th className="text-left px-3 py-2.5 font-normal w-[200px]">Email</th>
                  <th className="text-left px-3 py-2.5 font-normal w-[120px]">Сотрудников</th>
                  <th className="text-left px-3 py-2.5 font-normal w-[180px]">Кем создан</th>
                  <th className="text-right px-3 py-2.5 font-normal w-[100px]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/70">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/clients/companies/${c.id}`}
                        className="font-medium text-gray-900 hover:text-brand-yellow-dark"
                      >
                        {c.name}
                      </Link>
                      {c.address && (
                        <div className="text-xs text-gray-500 truncate max-w-[320px]">{c.address}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-gray-700">{c.bin || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-700 tabular-nums">
                      {c.phone ? formatPhone(c.phone) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 truncate max-w-[220px]">{c.email || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-700">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        {c.clients_count ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 truncate max-w-[220px]">
                      {c.creator?.name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(c)}
                          title="Редактировать"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:bg-red-50"
                          onClick={() => setDeleteTarget(c)}
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Модалка создания/редактирования */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Редактировать компанию" : "Новая компания"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Название *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder='ТОО "Ромашка"'
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>БИН / ИНН</Label>
                <Input
                  value={form.bin}
                  onChange={(e) => setForm((p) => ({ ...p, bin: e.target.value }))}
                />
              </div>
              <div>
                <Label>Телефон</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))
                  }
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                type="email"
              />
            </div>
            <div>
              <Label>Сайт</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                placeholder="example.com"
              />
            </div>
            <div>
              <Label>Адрес</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div>
              <Label>Заметка</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить компанию?</AlertDialogTitle>
            <AlertDialogDescription>
              Компания «{deleteTarget?.name}» будет удалена. Связанные контакты
              и сделки останутся — у них просто сбросится привязка к компании.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
