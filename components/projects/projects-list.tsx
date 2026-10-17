"use client"

/**
 * Справочник проектов CRM (/admin/projects). Простой список с
 * созданием, редактированием и удалением. Проекты используются как
 * альтернатива сделке в поле «Проект» задачи (см. tasks flow).
 *
 * Бэк: /api/admin/projects (CRUD, см. routes/projects.py).
 */

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, FolderKanban } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import type { Project } from "@/lib/projects-types"

// Палитра как у стадий сделок — приятные Tailwind-500 оттенки.
const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#facc15", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#78716c", "#64748b", "#334155",
]

interface FormState {
  id: number | null
  name: string
  color: string
  description: string
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  color: "#facc15",
  description: "",
}

export default function ProjectsList() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()

  // Гейт по спец-праву: owner или can_manage_projects. Иначе редирект
  // на список задач (кнопка «Проекты» там уже спрятана, но на прямой
  // URL заход нужен fallback).
  const canManageProjects = Boolean(
    user && (user.is_owner || user.can_manage_projects),
  )
  useEffect(() => {
    if (user && !canManageProjects) router.replace("/admin/tasks")
  }, [user, canManageProjects, router])

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    crmGet<{ projects: Project[] }>("/api/admin/projects")
      .then((res) => setProjects(res.projects || []))
      .catch((e) =>
        toast({
          variant: "destructive",
          title: "Не удалось загрузить проекты",
          description: e?.message,
        }),
      )
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }
  const openEdit = (p: Project) => {
    setForm({
      id: p.id,
      name: p.name,
      color: p.color,
      description: p.description || "",
    })
    setEditorOpen(true)
  }

  const handleSubmit = async () => {
    const name = form.name.trim()
    if (!name) {
      toast({ variant: "destructive", title: "Название обязательно" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name,
        color: form.color,
        description: form.description.trim() || null,
      }
      if (form.id == null) {
        await crmPost("/api/admin/projects", payload)
        toast({ title: "Проект создан" })
      } else {
        await crmPut(`/api/admin/projects/${form.id}`, payload)
        toast({ title: "Проект обновлён" })
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await crmDelete(`/api/admin/projects/${deleteTarget.id}`)
      toast({ title: "Проект удалён" })
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  if (user && !canManageProjects) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Проекты</h1>
            <p className="text-sm text-gray-500">
              Верхнеуровневые контейнеры для задач вне сделок
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-brand-yellow text-black hover:bg-yellow-500 rounded-full"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Новый проект
        </Button>
      </div>

      <Card className="rounded-xl border-gray-200 p-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-10">
            Проектов пока нет. Создайте первый — например «Внутренние задачи».
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-gray-500 truncate">{p.description}</div>
                  )}
                </div>
                <div className="text-xs text-gray-500 tabular-nums shrink-0">
                  задач: {p.task_count ?? 0}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(p)}
                  className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-900"
                  title="Редактировать"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(p)}
                  className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id == null ? "Новый проект" : "Проект"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Название *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Например: Маркетинг Q4"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Цвет</Label>
              <ColorPicker
                value={form.color}
                onChange={(v) => setForm({ ...form, color: v })}
              />
            </div>
            <div className="space-y-1">
              <Label>Описание</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Опционально"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {form.id == null ? "Создать" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» будет удалён. Задачи проекта не удалятся, просто потеряют
              привязку (project_id = NULL).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

// ============================================================================

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none w-full"
        >
          <span
            className="h-4 w-4 rounded-full shrink-0"
            style={{ backgroundColor: value }}
          />
          <span className="text-gray-700 tabular-nums">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false) }}
              className="h-8 w-8 rounded-lg shrink-0"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-10 rounded cursor-pointer border border-gray-200"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
