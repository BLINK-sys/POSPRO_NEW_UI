"use client"

/**
 * Быстрое создание проекта — вызывается inline из других экранов
 * (например «Привязка» → «Проект» на карточке задачи), чтобы юзеру не
 * пришлось уходить в /admin/projects.
 *
 * Возвращает созданный Project через onCreated — родитель сам решает
 * что с ним делать (например автоматом выбрать в select'е).
 */

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { crmPost } from "@/lib/crm-fetch"
import type { Project } from "@/lib/projects-types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (project: Project) => void
  initialName?: string
}

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#facc15", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#78716c", "#64748b", "#334155",
]

export default function ProjectCreateDialog({
  open, onOpenChange, onCreated, initialName,
}: Props) {
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [color, setColor] = useState("#facc15")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initialName || "")
    setColor("#facc15")
    setDescription("")
  }, [open, initialName])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ variant: "destructive", title: "Введите название" })
      return
    }
    setSaving(true)
    try {
      const res = await crmPost<{ project: Project }>("/api/admin/projects", {
        name: trimmed,
        color,
        description: description.trim() || null,
      })
      toast({ title: "Проект создан" })
      onCreated(res.project)
      onOpenChange(false)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось создать",
        description: e?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Название *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Маркетинг Q4"
            />
          </div>
          <div className="space-y-1">
            <Label>Цвет</Label>
            <div className="grid grid-cols-10 gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-md ${
                    color === c ? "ring-2 ring-offset-1 ring-gray-500" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Описание</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опционально"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={submit}
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
