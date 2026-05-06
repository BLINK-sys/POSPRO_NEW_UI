"use client"

/**
 * Модалка «Выбор клиента» для страницы /kp.
 *
 * Левая колонка — список клиентов адресной книги с поиском и кнопкой
 * «Добавить нового». Правая — форма редактирования/просмотра выбранного
 * клиента. Поля зависят от типа организации (ТОО / ИП / Физ.лицо).
 *
 * После «Сохранить и выбрать» закрывает модалку и пробрасывает выбранного
 * клиента наверх через onPicked. Пул клиентов общий для всех системных
 * пользователей — то что один менеджер добавил, увидят все.
 */

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Search, Trash2, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
import {
  listKpClients,
  createKpClient,
  updateKpClient,
  deleteKpClient,
  type KpClient,
  type KpClientInput,
  type KpClientOrgType,
} from "@/app/actions/kp-clients"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { cn } from "@/lib/utils"

const SOFT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"

const ORG_TYPE_LABEL: Record<KpClientOrgType, string> = {
  too: "ТОО",
  ip: "ИП",
  individual: "Физ.лицо",
}

const ORG_TYPE_BADGE: Record<KpClientOrgType, string> = {
  too: "bg-blue-100 text-blue-700 border-blue-200",
  ip: "bg-emerald-100 text-emerald-700 border-emerald-200",
  individual: "bg-amber-100 text-amber-700 border-amber-200",
}

// Какие поля показывать для каждого типа организации
const ORG_TYPE_FIELDS: Record<KpClientOrgType, {
  organization_name: boolean
  full_name: boolean
  bin: boolean
  iin: boolean
}> = {
  too: { organization_name: true, full_name: true, bin: true, iin: false },
  ip: { organization_name: true, full_name: true, bin: false, iin: true },
  individual: { organization_name: false, full_name: true, bin: false, iin: true },
}

const FULL_NAME_LABEL: Record<KpClientOrgType, string> = {
  too: "ФИО директора",
  ip: "ФИО директора / владельца",
  individual: "ФИО",
}

const ORG_NAME_LABEL: Record<KpClientOrgType, string> = {
  too: "Название ТОО",
  ip: "Название ИП",
  individual: "",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedClientId?: number | null
  onPicked: (client: KpClient) => void
}

// Состояние формы — то что юзер сейчас редактирует. id = null означает
// «создаём нового», id = число — редактируем существующего.
interface FormState {
  id: number | null
  organization_type: KpClientOrgType
  organization_name: string
  full_name: string
  bin: string
  iin: string
  phone: string
  whatsapp: string
  note: string
}

const EMPTY_FORM: FormState = {
  id: null,
  organization_type: "too",
  organization_name: "",
  full_name: "",
  bin: "",
  iin: "",
  phone: "",
  whatsapp: "",
  note: "",
}

function clientToForm(c: KpClient): FormState {
  return {
    id: c.id,
    organization_type: c.organization_type,
    organization_name: c.organization_name || "",
    full_name: c.full_name || "",
    bin: c.bin || "",
    iin: c.iin || "",
    phone: c.phone || "",
    whatsapp: c.whatsapp || "",
    note: c.note || "",
  }
}

function formToInput(f: FormState): KpClientInput {
  return {
    organization_type: f.organization_type,
    organization_name: f.organization_name.trim() || null,
    full_name: f.full_name.trim() || null,
    bin: f.bin.trim() || null,
    iin: f.iin.trim() || null,
    phone: f.phone.trim() || null,
    whatsapp: f.whatsapp.trim() || null,
    note: f.note.trim() || null,
  }
}

export function KpClientPickerDialog({ open, onOpenChange, selectedClientId, onPicked }: Props) {
  const { toast } = useToast()
  const [clients, setClients] = useState<KpClient[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [activeId, setActiveId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<KpClient | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Загрузка списка при открытии
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch("")
    listKpClients()
      .then((list) => {
        setClients(list)
        // Если уже был выбран клиент — открываем его сразу
        if (selectedClientId) {
          const found = list.find((c) => c.id === selectedClientId)
          if (found) {
            setActiveId(found.id)
            setForm(clientToForm(found))
            return
          }
        }
        // Иначе — пустая форма создания нового
        setActiveId(null)
        setForm(EMPTY_FORM)
      })
      .catch(() => {
        toast({ title: "Ошибка", description: "Не удалось загрузить список клиентов", variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [open, selectedClientId, toast])

  // Локальный фильтр по поисковой строке. Бэк-поиск тоже есть, но для
  // адресных книг до пары сотен записей достаточно клиентского.
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const fields = [
        c.organization_name,
        c.full_name,
        c.bin,
        c.iin,
        c.phone,
        c.whatsapp,
      ].filter(Boolean) as string[]
      return fields.some((f) => f.toLowerCase().includes(q))
    })
  }, [clients, search])

  const handleSelect = (c: KpClient) => {
    setActiveId(c.id)
    setForm(clientToForm(c))
  }

  const handleNew = () => {
    setActiveId(null)
    setForm(EMPTY_FORM)
  }

  // Валидируем минимально на клиенте — бэк вернёт точную ошибку если что.
  const validate = (f: FormState): string | null => {
    const fields = ORG_TYPE_FIELDS[f.organization_type]
    if (fields.organization_name && !f.organization_name.trim()) {
      return ORG_NAME_LABEL[f.organization_type] + " обязательно"
    }
    if (fields.full_name && !f.full_name.trim()) {
      return FULL_NAME_LABEL[f.organization_type] + " обязательно"
    }
    if (fields.bin && !f.bin.trim()) return "БИН обязателен"
    if (fields.iin && !f.iin.trim()) return "ИИН обязателен"
    return null
  }

  const handleSaveAndPick = async () => {
    const err = validate(form)
    if (err) {
      toast({ title: "Заполните обязательные поля", description: err, variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const input = formToInput(form)
      const res = form.id
        ? await updateKpClient(form.id, input)
        : await createKpClient(input)
      if (!res.success || !res.client) {
        toast({ title: "Ошибка", description: res.error || "Не удалось сохранить", variant: "destructive" })
        return
      }
      const saved = res.client
      // Обновляем список в памяти — без повторного fetch'а.
      setClients((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = saved
          return next
        }
        return [...prev, saved]
      })
      onPicked(saved)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCandidate) return
    setDeleting(true)
    try {
      const res = await deleteKpClient(deleteCandidate.id)
      if (!res.success) {
        toast({
          title: "Нельзя удалить",
          description: res.error || "Клиент используется в документах",
          variant: "destructive",
        })
        return
      }
      setClients((prev) => prev.filter((c) => c.id !== deleteCandidate.id))
      // Если удалили того что был открыт — сбросим форму
      if (activeId === deleteCandidate.id) {
        setActiveId(null)
        setForm(EMPTY_FORM)
      }
      setDeleteCandidate(null)
      toast({ title: "Удалено", description: "Клиент удалён из адресной книги" })
    } finally {
      setDeleting(false)
    }
  }

  const fields = ORG_TYPE_FIELDS[form.organization_type]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-lg">Выбор клиента</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-[320px_1fr] h-[560px] min-h-0">
            {/* ─── Левая колонка: список ─────────────── */}
            <div className="border-r flex flex-col bg-gray-50/50 min-h-0">
              <div className="p-3 space-y-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Поиск по имени / БИН / ИИН"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn("h-9 pl-8 text-sm", SOFT)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNew}
                  className={cn(
                    "w-full justify-center gap-1.5 text-sm",
                    activeId === null && "bg-yellow-50 border-yellow-300 text-yellow-900",
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить нового
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-10 px-4 text-sm text-gray-400">
                    {search ? "Ничего не найдено" : "Адресная книга пуста"}
                  </div>
                ) : (
                  <ul className="py-1">
                    {filteredClients.map((c) => {
                      const isActive = activeId === c.id
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(c)}
                            className={cn(
                              "w-full text-left px-3 py-2 hover:bg-yellow-50 transition-colors group flex items-start gap-2",
                              isActive && "bg-yellow-100 hover:bg-yellow-100",
                            )}
                          >
                            <span
                              className={cn(
                                "inline-flex shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border uppercase tracking-wide",
                                ORG_TYPE_BADGE[c.organization_type],
                              )}
                            >
                              {ORG_TYPE_LABEL[c.organization_type]}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-gray-900 truncate">
                                {c.display_name}
                              </span>
                              {c.phone && (
                                <span className="block text-[11px] text-gray-500 truncate">{c.phone}</span>
                              )}
                            </span>
                            {isActive && <Check className="h-4 w-4 text-yellow-700 shrink-0 mt-0.5" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* ─── Правая колонка: форма ──────────────── */}
            <div className="flex flex-col min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {form.id ? "Редактирование клиента" : "Новый клиент"}
                  </h3>
                  {form.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const c = clients.find((x) => x.id === form.id)
                        if (c) setDeleteCandidate(c)
                      }}
                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Удалить
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Тип организации
                  </Label>
                  <Select
                    value={form.organization_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, organization_type: v as KpClientOrgType }))}
                  >
                    <SelectTrigger className={cn("mt-1 h-9", SOFT)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="too">ТОО</SelectItem>
                      <SelectItem value="ip">ИП</SelectItem>
                      <SelectItem value="individual">Физ.лицо</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fields.organization_name && (
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {ORG_NAME_LABEL[form.organization_type]} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.organization_name}
                      onChange={(e) => setForm((f) => ({ ...f, organization_name: e.target.value }))}
                      className={cn("mt-1 h-9 text-sm", SOFT)}
                      placeholder={form.organization_type === "too" ? 'ТОО «Пример»' : 'ИП Иванов'}
                    />
                  </div>
                )}

                {fields.full_name && (
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {FULL_NAME_LABEL[form.organization_type]} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                      className={cn("mt-1 h-9 text-sm", SOFT)}
                      placeholder="Иванов Иван Иванович"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {fields.bin && (
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        БИН <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={form.bin}
                        onChange={(e) => setForm((f) => ({ ...f, bin: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                        className={cn("mt-1 h-9 text-sm", SOFT)}
                        placeholder="123456789012"
                        inputMode="numeric"
                      />
                    </div>
                  )}
                  {fields.iin && (
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ИИН <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={form.iin}
                        onChange={(e) => setForm((f) => ({ ...f, iin: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                        className={cn("mt-1 h-9 text-sm", SOFT)}
                        placeholder="123456789012"
                        inputMode="numeric"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Телефон
                    </Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className={cn("mt-1 h-9 text-sm", SOFT)}
                      placeholder="+7 (___) ___-__-__"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      WhatsApp
                    </Label>
                    <Input
                      value={form.whatsapp}
                      onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                      className={cn("mt-1 h-9 text-sm", SOFT)}
                      placeholder="+7 (___) ___-__-__"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Заметка
                  </Label>
                  <Textarea
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    className={cn("mt-1 text-sm min-h-[70px] resize-none", SOFT)}
                    placeholder="Дополнительная информация о клиенте..."
                  />
                </div>
              </div>

              <DialogFooter className="shrink-0 px-6 py-3 border-t bg-gray-50 sm:justify-between gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                  Отмена
                </Button>
                <Button
                  onClick={handleSaveAndPick}
                  disabled={saving}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1.5" />
                      {form.id ? "Сохранить и выбрать" : "Создать и выбрать"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={!!deleteCandidate}
        onOpenChange={(o) => !o && !deleting && setDeleteCandidate(null)}
        onConfirm={handleDelete}
        title="Удалить клиента?"
        description={
          deleteCandidate
            ? `Клиент «${deleteCandidate.display_name}» будет удалён из адресной книги. Если он используется хотя бы в одном документе — удалить не получится.`
            : ""
        }
      />
    </>
  )
}
