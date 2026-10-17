"use client"

/**
 * Модалка «Новая задача». Минимальный набор полей: заголовок,
 * описание, приоритет, срок, исполнитель, привязка (проект ИЛИ сделка).
 *
 * По правилам: у задачи может быть указана либо `deal_id`, либо
 * `project_id`, либо ничего. UI показывает две вкладки/тумблер
 * «Сделка / Проект» — юзер выбирает одно, второе автосбрасывается.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { crmGet, crmPost } from "@/lib/crm-fetch"
import type { Project } from "@/lib/projects-types"
import type { TaskPriority } from "@/lib/tasks-types"

interface SystemUserLite {
  id: number
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
  name?: string
}

interface DealLite {
  id: number
  name: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  projects: Project[]
  users: SystemUserLite[]
  onCreated: () => void
  /** Опционально: предзаполнить привязку (напр. открыто со страницы сделки). */
  initialDealId?: number | null
  initialProjectId?: number | null
}

export default function TaskCreateDialog({
  open, onOpenChange, projects, users, onCreated,
  initialDealId, initialProjectId,
}: Props) {
  const { toast } = useToast()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("normal")
  const [responsibleId, setResponsibleId] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState("")

  const [projectKind, setProjectKind] = useState<"none" | "deal" | "project">("none")
  const [dealId, setDealId] = useState<number | null>(null)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [deals, setDeals] = useState<DealLite[]>([])
  const [loadingDeals, setLoadingDeals] = useState(false)

  const [saving, setSaving] = useState(false)

  // Ресет при каждом открытии.
  useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
    setPriority("normal")
    setResponsibleId(null)
    setDueDate("")
    if (initialDealId) {
      setProjectKind("deal")
      setDealId(initialDealId)
      setProjectId(null)
    } else if (initialProjectId) {
      setProjectKind("project")
      setProjectId(initialProjectId)
      setDealId(null)
    } else {
      setProjectKind("none")
      setDealId(null)
      setProjectId(null)
    }
  }, [open, initialDealId, initialProjectId])

  // Deals для пикера — грузим лениво, когда юзер выбрал «Сделка».
  useEffect(() => {
    if (projectKind !== "deal" || deals.length > 0) return
    setLoadingDeals(true)
    crmGet<{ deals: DealLite[] }>("/api/admin/deals?limit=200")
      .then((res) => setDeals(res.deals || []))
      .catch(() => {})
      .finally(() => setLoadingDeals(false))
  }, [projectKind, deals.length])

  const submit = async () => {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Введите заголовок" })
      return
    }
    setSaving(true)
    try {
      await crmPost("/api/admin/tasks", {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        responsible_id: responsibleId,
        deal_id: projectKind === "deal" ? dealId : null,
        project_id: projectKind === "project" ? projectId : null,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
      })
      toast({ title: "Задача создана" })
      onCreated()
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Новая задача</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Заголовок *</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Что нужно сделать"
            />
          </div>

          <div className="space-y-1">
            <Label>Описание</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Контекст, ссылки, детали…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Приоритет</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низкий</SelectItem>
                  <SelectItem value="normal">Обычный</SelectItem>
                  <SelectItem value="high">Высокий</SelectItem>
                  <SelectItem value="urgent">Срочный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Крайний срок</Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Исполнитель</Label>
            <Select
              value={responsibleId ? String(responsibleId) : "none"}
              onValueChange={(v) => setResponsibleId(v === "none" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Не назначен" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Не назначен —</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {userDisplayName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Привязка к сделке ИЛИ проекту. */}
          <div className="space-y-1">
            <Label>Привязка</Label>
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
              {(["none", "deal", "project"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setProjectKind(k)}
                  className={`flex-1 h-8 text-xs rounded-md transition-colors ${
                    projectKind === k
                      ? "bg-white shadow-sm text-gray-900 font-medium"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {k === "none" ? "Без привязки" : k === "deal" ? "Сделка" : "Проект"}
                </button>
              ))}
            </div>
            {projectKind === "deal" && (
              <Select
                value={dealId ? String(dealId) : "none"}
                onValueChange={(v) => setDealId(v === "none" ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingDeals ? "Загружаем…" : "Выберите сделку"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Не выбрана —</SelectItem>
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {projectKind === "project" && (
              <Select
                value={projectId ? String(projectId) : "none"}
                onValueChange={(v) => setProjectId(v === "none" ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Не выбран —</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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

function userDisplayName(u: SystemUserLite): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}
