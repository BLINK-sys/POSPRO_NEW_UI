"use client"

/**
 * Инлайн-модалка «Создать источник сделки» — вызывается из селекта в
 * карточке сделки и в карточке веб-хука. После успешного создания
 * вызывает `onCreated(source)`, где родитель обновит свой список и
 * выставит селект на новое значение.
 *
 * Бэк: POST /api/admin/deal-sources. Требует can_manage_pipelines на бэке —
 * обычный менеджер получит 403, кнопка-плюс для него скрывается на уровне
 * родителя (не выдаём ему возможность).
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { crmPost } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#facc15", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#78716c", "#64748b", "#334155",
]

export interface DealSourceLite {
  id: number
  name: string
  color: string | null
  is_active: boolean
  sort_order?: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (source: DealSourceLite) => void
}

export default function DealSourceQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [color, setColor] = useState("#64748b")
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName("")
    setColor("#64748b")
    setSaving(false)
  }

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ variant: "destructive", title: "Название обязательно" })
      return
    }
    setSaving(true)
    try {
      const res = await crmPost<{ source: DealSourceLite }>(
        "/api/admin/deal-sources",
        { name: trimmed, color, is_active: true },
      )
      toast({ title: "Источник создан" })
      onCreated(res.source)
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
          <DialogTitle>Новый источник</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Название *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Instagram"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Цвет чипа</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-gray-200"
                    style={{ backgroundColor: color }}
                  />
                  {color}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition-all",
                        color === c
                          ? "border-black shadow-md scale-110"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
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
