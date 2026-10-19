"use client"

/**
 * Быстрое создание DealSourceVariant («Доп. об источнике») без ухода
 * с карточки сделки. Запрос POST /api/admin/deal-sources/<pid>/variants
 * (бэк проверит права — создавать может только owner/can_manage_pipelines).
 */

import { useEffect, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { crmPost } from "@/lib/crm-fetch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface SourceVariant {
  id: number
  parent_source_id: number
  name: string
  order_pos: number
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** id родительского источника (parent). */
  parentSourceId: number
  parentSourceName?: string
  /** Префилл имени (например из поля SOURCE_DESCRIPTION или свободного ввода). */
  initialName?: string
  onCreated?: (variant: SourceVariant) => void
}

const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 focus:!outline-none focus-visible:!outline-none"

export default function DealSourceVariantQuickCreate({
  open, onOpenChange, parentSourceId, parentSourceName,
  initialName, onCreated,
}: Props) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(initialName || "")
  }, [open, initialName])

  const submit = async () => {
    const n = name.trim()
    if (!n) {
      toast({ variant: "destructive", title: "Укажите название" })
      return
    }
    setSaving(true)
    try {
      const res = await crmPost<{ variant: SourceVariant }>(
        `/api/admin/deal-sources/${parentSourceId}/variants`,
        { name: n },
      )
      onCreated?.(res.variant)
      onOpenChange(false)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось создать вариант",
        description: e?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-[92vw] max-w-[520px]",
            "rounded-xl border border-gray-200 bg-white",
            "shadow-[0_20px_50px_rgba(0,0,0,0.20)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <DialogPrimitive.Title className="text-base font-semibold">
              Новый вариант «Дополнительно об источнике»
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100",
                NO_RING,
              )}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="p-4 space-y-3">
            {parentSourceName && (
              <div className="text-xs text-gray-500">
                Родительский источник:{" "}
                <span className="font-medium text-gray-900">{parentSourceName}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label>Название *</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Напр. «Звонок на номер 87…»"
                className={NO_RING}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
              />
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              onClick={submit}
              disabled={saving || !name.trim()}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving ? "Создаю…" : "Создать"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
