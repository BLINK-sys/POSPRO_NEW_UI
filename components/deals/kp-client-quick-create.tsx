"use client"

/**
 * Инлайн-модалка «Создать контакт» — вызывается плюс-кнопкой в
 * карточке сделки (основной контакт / доп. контакты). Минимум: ФИО +
 * опционально телефон. Остальное на /admin/clients.
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
import { useToast } from "@/hooks/use-toast"
import { crmPost } from "@/lib/crm-fetch"
import { formatPhone } from "@/lib/utils"

export interface ClientLite {
  id: number
  display_name: string
  full_name?: string | null
  object?: string | null
  contacts?: Array<{ phone?: string; note?: string }>
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: ClientLite) => void
}

export default function KpClientQuickCreateDialog({
  open, onOpenChange, onCreated,
}: Props) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setFullName("")
    setPhone("")
    setNote("")
    setSaving(false)
  }

  const handleSubmit = async () => {
    const trimmed = fullName.trim()
    if (!trimmed) {
      toast({ variant: "destructive", title: "ФИО обязательно" })
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        full_name: trimmed,
      }
      if (phone.trim()) {
        payload.contacts = [{ phone: phone.trim(), note: note.trim() }]
      }
      const res = await crmPost<{ client: ClientLite }>("/api/kp-clients", payload)
      toast({ title: "Контакт создан" })
      onCreated(res.client)
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Новый контакт</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>ФИО *</Label>
            <Input
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Телефон</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1">
            <Label>Заметка</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="WhatsApp, после 18:00, …"
            />
          </div>
          <p className="text-xs text-gray-400">
            Остальные контакты и привязку к компании — на странице «Контакты»
          </p>
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
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
