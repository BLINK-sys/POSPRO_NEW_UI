"use client"

/**
 * Модалка «Выбор клиента» для страницы /kp.
 *
 * Левая колонка — список клиентов адресной книги с поиском и кнопкой
 * «Добавить нового». Правая — форма редактирования/просмотра выбранного
 * клиента. Поля: ФИО, Объект (свободный текст), Контакты (массив телефонов
 * с заметками). Никаких ТОО/ИП/физлицо — все клиенты однотипные.
 *
 * После «Сохранить и выбрать» закрывает модалку и пробрасывает выбранного
 * клиента наверх через onPicked. Пул клиентов общий для всех системных
 * пользователей — то что один менеджер добавил, увидят все.
 */

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Search, Trash2, Check, Phone, X } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import {
  listKpClients,
  createKpClient,
  updateKpClient,
  deleteKpClient,
  type KpClient,
  type KpClientInput,
  type KpClientContact,
} from "@/app/actions/kp-clients"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { cn } from "@/lib/utils"

const SOFT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedClientId?: number | null
  onPicked: (client: KpClient) => void
}

// Состояние формы. id = null — создание нового клиента.
interface FormState {
  id: number | null
  full_name: string
  object: string
  contacts: KpClientContact[]
}

const EMPTY_FORM: FormState = {
  id: null,
  full_name: "",
  object: "",
  contacts: [],
}

function clientToForm(c: KpClient): FormState {
  return {
    id: c.id,
    full_name: c.full_name || "",
    object: c.object || "",
    contacts: Array.isArray(c.contacts) ? c.contacts.map(x => ({ phone: x.phone || "", note: x.note || "" })) : [],
  }
}

function formToInput(f: FormState): KpClientInput {
  return {
    full_name: f.full_name.trim(),
    object: f.object.trim() || null,
    contacts: f.contacts
      .map(c => ({ phone: c.phone.trim(), note: c.note.trim() }))
      .filter(c => c.phone),  // выкидываем пустые
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
        if (selectedClientId) {
          const found = list.find((c) => c.id === selectedClientId)
          if (found) {
            setActiveId(found.id)
            setForm(clientToForm(found))
            return
          }
        }
        setActiveId(null)
        setForm(EMPTY_FORM)
      })
      .catch(() => {
        toast({ title: "Ошибка", description: "Не удалось загрузить список клиентов", variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [open, selectedClientId, toast])

  // Локальный фильтр по поисковой строке.
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const fields = [c.full_name, c.object].filter(Boolean) as string[]
      if (fields.some((f) => f.toLowerCase().includes(q))) return true
      // Поиск по телефонам тоже — менеджеры часто ищут по номеру.
      return (c.contacts || []).some(ct => ct.phone.toLowerCase().includes(q))
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

  // --- Контакты ---
  const addContact = () => {
    setForm(f => ({ ...f, contacts: [...f.contacts, { phone: "", note: "" }] }))
  }
  const updateContact = (idx: number, patch: Partial<KpClientContact>) => {
    setForm(f => ({
      ...f,
      contacts: f.contacts.map((c, i) => i === idx ? { ...c, ...patch } : c),
    }))
  }
  const removeContact = (idx: number) => {
    setForm(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }))
  }

  const validate = (f: FormState): string | null => {
    if (!f.full_name.trim()) return "ФИО клиента обязательно"
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
                    placeholder="Поиск по ФИО / объекту / телефону"
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
                      const firstContact = c.contacts?.[0]
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
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-gray-900 truncate">
                                {c.display_name}
                              </span>
                              {c.object && (
                                <span className="block text-[11px] text-gray-500 truncate">
                                  {c.object}
                                </span>
                              )}
                              {firstContact && (
                                <span className="block text-[11px] text-gray-400 truncate flex items-center gap-1">
                                  <Phone className="h-2.5 w-2.5 flex-shrink-0" />
                                  {firstContact.phone}
                                  {(c.contacts?.length ?? 0) > 1 && (
                                    <span className="text-gray-300">+{(c.contacts?.length ?? 1) - 1}</span>
                                  )}
                                </span>
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
                    ФИО <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className={cn("mt-1 h-9 text-sm", SOFT)}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Объект
                  </Label>
                  <Textarea
                    value={form.object}
                    onChange={(e) => setForm((f) => ({ ...f, object: e.target.value }))}
                    className={cn("mt-1 text-sm min-h-[60px] resize-none", SOFT)}
                    placeholder="Название объекта, адрес, название организации…"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Контакты
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addContact}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить
                    </Button>
                  </div>

                  {form.contacts.length === 0 ? (
                    <p className="text-[11px] text-gray-400 py-2">
                      Контактов нет. Нажмите «Добавить» — можно добавить несколько телефонов с заметками.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {form.contacts.map((ct, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1 grid grid-cols-[1fr_1fr] gap-2">
                            <Input
                              value={ct.phone}
                              onChange={(e) => updateContact(idx, { phone: e.target.value })}
                              className={cn("h-9 text-sm", SOFT)}
                              placeholder="+7 (___) ___-__-__"
                            />
                            <Input
                              value={ct.note}
                              onChange={(e) => updateContact(idx, { note: e.target.value })}
                              className={cn("h-9 text-sm", SOFT)}
                              placeholder="Заметка (WhatsApp, секретарь…)"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeContact(idx)}
                            className="h-9 w-9 p-0 text-gray-400 hover:text-red-600 shrink-0"
                            title="Удалить контакт"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
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
