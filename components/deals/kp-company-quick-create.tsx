"use client"

/**
 * Инлайн-модалка «Новая компания» — вызывается плюс-кнопкой из пикера
 * компании (в карточке сделки и в модалке клиента). Полный набор полей
 * — такой же как на /admin/clients?tab=companies, чтобы пользователь
 * мог завести компанию сразу целиком и не ходить на отдельную страницу.
 */

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { useToast } from "@/hooks/use-toast"
import { crmPost } from "@/lib/crm-fetch"
import { formatPhone } from "@/lib/utils"

export interface CompanyLite {
  id: number
  name: string
  bin?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (company: CompanyLite) => void
  initialName?: string
}

interface FormState {
  name: string
  bin: string
  address: string
  website: string
  phone: string
  email: string
  note: string
}

const EMPTY: FormState = {
  name: "",
  bin: "",
  address: "",
  website: "",
  phone: "",
  email: "",
  note: "",
}

export default function KpCompanyQuickCreateDialog({
  open, onOpenChange, onCreated, initialName,
}: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>({ ...EMPTY, name: initialName || "" })
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setForm(EMPTY)
    setSaving(false)
  }

  const handleSubmit = async () => {
    const trimmed = form.name.trim()
    if (!trimmed) {
      toast({ variant: "destructive", title: "Название обязательно" })
      return
    }
    setSaving(true)
    try {
      const body = {
        name: trimmed,
        bin: form.bin.trim() || null,
        address: form.address.trim() || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        note: form.note.trim() || null,
      }
      const res = await crmPost<{ company: CompanyLite }>(
        "/api/admin/kp-companies",
        body,
      )
      toast({ title: "Компания создана" })
      onCreated(res.company)
      reset()
      onOpenChange(false)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось создать",
        description: e?.message,
      })
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (saving) return
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Новая компания</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Название *</Label>
            <Input
              autoFocus
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
