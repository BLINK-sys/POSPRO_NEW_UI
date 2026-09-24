"use client"

/**
 * Вкладка «Задачи» карточки сделки: список задач где deal_id = <this>,
 * быстрое создание, смена статуса inline, переход в /admin/tasks/<id>.
 *
 * Бэк:
 *   GET  /api/admin/tasks?deal_id=<id>
 *   POST /api/admin/tasks           create
 *   POST /api/admin/tasks/<tid>/status
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Plus, Loader2, ExternalLink, CheckCircle2, Circle, PauseCircle,
  AlertCircle, Clock,
} from "lucide-react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { crmGet, crmPost } from "@/lib/crm-fetch"

interface Task {
  id: number
  title: string
  description: string | null
  status: "pending" | "in_progress" | "waiting_check" | "done" | "paused"
  priority: "low" | "normal" | "high" | "urgent"
  responsible_id: number | null
  creator_id: number | null
  due_at: string | null
  created_at: string | null
  completed_at: string | null
}

interface Props {
  dealId: number
  clientId: number | null
  responsibleUserId: number | null
  usersById: Map<number, string>
}

const STATUS_META: Record<
  Task["status"],
  { label: string; icon: any; cls: string; text: string }
> = {
  pending:       { label: "Ожидает",   icon: Circle,        cls: "text-gray-400",    text: "text-gray-600" },
  in_progress:   { label: "В работе",  icon: Clock,         cls: "text-blue-500",    text: "text-blue-700" },
  waiting_check: { label: "На проверке", icon: AlertCircle, cls: "text-amber-500",   text: "text-amber-700" },
  done:          { label: "Готово",    icon: CheckCircle2,  cls: "text-emerald-500", text: "text-emerald-700" },
  paused:        { label: "Пауза",     icon: PauseCircle,   cls: "text-gray-400",    text: "text-gray-600" },
}

const PRIORITY_META: Record<Task["priority"], { label: string; cls: string }> = {
  low:    { label: "низкий",  cls: "bg-gray-50 text-gray-600 border-gray-200" },
  normal: { label: "обычный", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  high:   { label: "высокий", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  urgent: { label: "срочный", cls: "bg-red-50 text-red-700 border-red-200" },
}

export default function TabTasks({
  dealId,
  clientId,
  responsibleUserId,
  usersById,
}: Props) {
  const { toast } = useToast()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    crmGet<{ tasks: Task[] }>(`/api/admin/tasks?deal_id=${dealId}`)
      .then((res) => setTasks(res.tasks || []))
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить задачи",
          description: e?.message,
        })
      })
      .finally(() => setLoading(false))
  }, [dealId, toast])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (task: Task, status: Task["status"]) => {
    // Оптимистично.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))
    try {
      await crmPost(`/api/admin/tasks/${task.id}/status`, { status })
    } catch (e: any) {
      // Откат.
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
      toast({
        variant: "destructive",
        title: "Не удалось обновить статус",
        description: e?.message,
      })
    }
  }

  return (
    <>
      <Card className="rounded-xl border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Задачи {tasks.length > 0 && <span className="text-gray-400 font-normal">({tasks.length})</span>}
          </h3>
          <button
            onClick={() => setCreateOpen(true)}
            className="text-[11px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-0.5 focus:outline-none"
          >
            <Plus className="h-3 w-3" /> новая
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-xs text-gray-400 italic text-center py-2">
            Задач нет
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => (
              <li key={t.id}>
                <TaskRow
                  task={t}
                  responsibleName={
                    t.responsible_id != null
                      ? usersById.get(t.responsible_id) ?? `#${t.responsible_id}`
                      : null
                  }
                  onStatusChange={(s) => handleStatusChange(t, s)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        dealId={dealId}
        clientId={clientId}
        defaultResponsibleId={responsibleUserId}
        usersById={usersById}
        onCreated={() => {
          setCreateOpen(false)
          load()
        }}
      />
    </>
  )
}

// ============================================================================

function TaskRow({
  task,
  responsibleName,
  onStatusChange,
}: {
  task: Task
  responsibleName: string | null
  onStatusChange: (s: Task["status"]) => void
}) {
  const st = STATUS_META[task.status]
  const pr = PRIORITY_META[task.priority]
  const Icon = st.icon
  const overdue =
    task.due_at &&
    task.status !== "done" &&
    new Date(task.due_at).getTime() < Date.now()

  return (
    <div className="flex items-start gap-2 border border-gray-200 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors">
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", st.cls)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={cn(
            "text-sm truncate",
            task.status === "done" && "line-through text-gray-400",
          )}>
            {task.title}
          </div>
          <span className={cn(
            "text-[9px] uppercase tracking-wider border rounded px-1 shrink-0",
            pr.cls,
          )}>
            {pr.label}
          </span>
          {overdue && (
            <span className="text-[9px] uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 rounded px-1 shrink-0">
              просроч.
            </span>
          )}
        </div>
        <div className="text-[10px] text-gray-500 flex items-center gap-1 flex-wrap">
          {responsibleName && <span className="truncate">{responsibleName}</span>}
          {task.due_at && (
            <>
              {responsibleName && <span>·</span>}
              <span>до {formatDate(task.due_at)}</span>
            </>
          )}
        </div>
      </div>
      <Select value={task.status} onValueChange={(v) => onStatusChange(v as Task["status"])}>
        <SelectTrigger className="h-6 w-[100px] text-[11px] px-1.5 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(STATUS_META) as Task["status"][]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">
              {STATUS_META[k].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link
        href={`/admin/tasks/${task.id}`}
        title="Открыть"
        className="text-gray-400 hover:text-gray-700 p-1 shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ============================================================================

function CreateTaskDialog({
  open,
  onOpenChange,
  dealId,
  clientId,
  defaultResponsibleId,
  usersById,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dealId: number
  clientId: number | null
  defaultResponsibleId: number | null
  usersById: Map<number, string>
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Task["priority"]>("normal")
  const [responsibleId, setResponsibleId] = useState<number | null>(defaultResponsibleId)
  const [dueDate, setDueDate] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle("")
      setDescription("")
      setPriority("normal")
      setResponsibleId(defaultResponsibleId)
      setDueDate("")
    }
  }, [open, defaultResponsibleId])

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
        deal_id: dealId,
        client_id: clientId,
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
          <DialogTitle>Новая задача по сделке</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Заголовок *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Что нужно сделать"
              autoFocus
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
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
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
              <Label>Срок</Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Ответственный</Label>
            <Select
              value={responsibleId ? String(responsibleId) : "none"}
              onValueChange={(v) => setResponsibleId(v === "none" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Не назначен" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Не назначен —</SelectItem>
                {Array.from(usersById.entries()).map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}
