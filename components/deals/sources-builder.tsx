"use client"

/**
 * Визард создания/редактирования ingest-источника.
 *
 * После сохранения (POST/PUT /api/admin/crm-sources) — если это новый
 * webhook, показываем блок с готовым URL для копирования (то самое
 * состояние «Хук готов»).
 */

import { useEffect, useMemo, useState } from "react"
import { Copy, Loader2, Check } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { crmGet, crmPost, crmPut } from "@/lib/crm-fetch"
import { useToast } from "@/hooks/use-toast"
import type {
  DealPipeline,
  DealStage,
  PipelinesListResponse,
} from "@/lib/deals-types"
import type {
  CrmIngestSource,
  CrmIngestStrategy,
  CrmIngestClientResolution,
  CrmSourceDetailResponse,
} from "@/lib/crm-sources-types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (s: CrmIngestSource) => void
  /** Если задан — режим редактирования. */
  initial?: CrmIngestSource | null
}

interface SystemUser {
  id: number
  full_name: string
  email: string
}

const PLACEHOLDERS = [
  "{source_ref_id}",
  "{client.name}",
  "{client.email}",
  "{client.phone}",
  "{product_name}",
  "{amount}",
  "{currency}",
  "{external_url}",
]

const SAMPLE_PAYLOAD_TEMPLATE = {
  source_ref_id: "12345",
  client: {
    name: "Иван Иванов",
    email: "ivan@example.com",
    phone: "+77771234567",
    company: "OOO Ромашка",
  },
  amount: 150000,
  currency: "KZT",
  product_name: "Экран для ККТ",
  notes: "Просит срочную доставку",
  priority: "high",
  external_url: "https://example.com/orders/12345",
}

export default function SourceBuilder({
  open,
  onOpenChange,
  onSaved,
  initial,
}: Props) {
  const { toast } = useToast()
  const editing = Boolean(initial)

  const [pipelines, setPipelines] = useState<DealPipeline[]>([])
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([])

  const [name, setName] = useState("")
  const [pipelineId, setPipelineId] = useState<string>("")
  const [stageId, setStageId] = useState<string>("")
  const [titleTemplate, setTitleTemplate] = useState("")
  const [notesTemplate, setNotesTemplate] = useState("")
  const [poolIds, setPoolIds] = useState<number[]>([])
  const [strategy, setStrategy] = useState<CrmIngestStrategy>("unassigned")
  const [fixedUserId, setFixedUserId] = useState<string>("")
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal")
  const [clientResolution, setClientResolution] =
    useState<CrmIngestClientResolution>("find_by_email")
  const [dedupeByRef, setDedupeByRef] = useState(true)
  const [active, setActive] = useState(true)

  const [saving, setSaving] = useState(false)
  // Показываем «Хук готов» после первого создания webhook'а.
  const [readyUrl, setReadyUrl] = useState<string | null>(null)

  const activeStages: DealStage[] = useMemo(() => {
    const p = pipelines.find((x) => String(x.id) === pipelineId)
    return [...(p?.stages ?? [])].sort((a, b) => a.order - b.order)
  }, [pipelines, pipelineId])

  // Загрузка справочников когда модалка открывается.
  useEffect(() => {
    if (!open) return
    let ignore = false
    // Независимые .catch — один упавший не должен блокировать другой.
    const loadPipelines = crmGet<PipelinesListResponse>(
      "/api/admin/deal-pipelines?with_stages=1",
    ).catch((e) => {
      console.error("load pipelines:", e)
      return { success: false, pipelines: [] as any[] } as PipelinesListResponse
    })
    // Flask отдаёт system-users плоским массивом.
    const loadUsers = crmGet<SystemUser[] | { users: SystemUser[] }>(
      "/api/system-users",
    ).catch((e) => {
      console.error("load system users:", e)
      return [] as SystemUser[]
    })
    Promise.all([loadPipelines, loadUsers]).then(([p, u]) => {
      if (ignore) return
      setPipelines(p.pipelines || [])
      const users = Array.isArray(u) ? u : u.users || []
      setSystemUsers(users)
    })
    return () => {
      ignore = true
    }
  }, [open])

  // Prefill / reset.
  useEffect(() => {
    if (!open) {
      // При закрытии сбрасываем «Хук готов».
      setReadyUrl(null)
      return
    }
    if (initial) {
      setName(initial.name)
      setPipelineId(String(initial.pipeline_id))
      setStageId(String(initial.stage_id))
      setTitleTemplate(initial.title_template)
      setNotesTemplate(initial.notes_template || "")
      setPoolIds(initial.pool_user_ids || [])
      setStrategy(initial.assignment_strategy)
      setFixedUserId(initial.fixed_user_id ? String(initial.fixed_user_id) : "")
      setPriority(initial.priority)
      setClientResolution(initial.client_resolution)
      setDedupeByRef(initial.dedupe_by_ref)
      setActive(initial.active)
    } else {
      setName("")
      setPipelineId("")
      setStageId("")
      setTitleTemplate("Заявка #{source_ref_id}")
      setNotesTemplate("")
      setPoolIds([])
      setStrategy("unassigned")
      setFixedUserId("")
      setPriority("normal")
      setClientResolution("find_by_email")
      setDedupeByRef(true)
      setActive(true)
    }
  }, [open, initial])

  // Первая стадия воронки по умолчанию.
  useEffect(() => {
    if (!pipelineId || editing) return
    const p = pipelines.find((x) => String(x.id) === pipelineId)
    if (!p?.stages?.length) return
    const first = [...p.stages].sort((a, b) => a.order - b.order)[0]
    if (!stageId || !p.stages.some((s) => String(s.id) === stageId)) {
      setStageId(String(first.id))
    }
  }, [pipelineId, pipelines, editing])

  const canSubmit = useMemo(() => {
    if (!name.trim() || !pipelineId || !stageId || !titleTemplate.trim()) return false
    if (strategy === "fixed" && !fixedUserId) return false
    if ((strategy === "round_robin" || strategy === "least_busy") && poolIds.length === 0)
      return false
    return true
  }, [name, pipelineId, stageId, titleTemplate, strategy, fixedUserId, poolIds])

  const insertPlaceholder = (placeholder: string, target: "title" | "notes") => {
    if (target === "title") setTitleTemplate((v) => v + placeholder)
    else setNotesTemplate((v) => v + placeholder)
  }

  const buildUrl = (token: string) =>
    `https://pospro-new-server.onrender.com/api/webhooks/crm/ingest/${token}`

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        pipeline_id: Number(pipelineId),
        stage_id: Number(stageId),
        title_template: titleTemplate.trim(),
        notes_template: notesTemplate.trim() || null,
        priority,
        assignment_strategy: strategy,
        pool_user_ids: strategy === "fixed" || strategy === "unassigned" ? [] : poolIds,
        fixed_user_id:
          strategy === "fixed" && fixedUserId ? Number(fixedUserId) : null,
        client_resolution: clientResolution,
        dedupe_by_ref: dedupeByRef,
        active,
      }

      if (editing && initial) {
        const res = await crmPut<CrmSourceDetailResponse>(
          `/api/admin/crm-sources/${initial.id}`,
          payload,
        )
        toast({ title: "Источник сохранён" })
        onSaved(res.source)
      } else {
        payload.kind = "webhook" // из формы всегда создаём webhook. Internal — только через seed/API.
        const res = await crmPost<CrmSourceDetailResponse>(
          "/api/admin/crm-sources",
          payload,
        )
        toast({ title: "Хук создан" })
        // Показываем «Хук готов» с URL, не закрываем модалку — юзер копирует.
        if (res.source.token) {
          setReadyUrl(buildUrl(res.source.token))
        } else {
          onSaved(res.source)
        }
      }
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

  // Внешний вид «Хук готов» — второй экран после создания webhook'а.
  if (readyUrl) {
    return (
      <ReadyDialog
        url={readyUrl}
        onDone={() => {
          setReadyUrl(null)
          onOpenChange(false)
          onSaved({} as any) // триггерим refresh
        }}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Редактирование источника" : "Создание webhook'а"}
          </DialogTitle>
          <DialogDescription>
            Правила автосоздания сделки из внешнего события
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Основное */}
          <Section title="Основное">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>
                  Название хука <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CAMPO Magazine"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Воронка *</Label>
                  <Select value={pipelineId} onValueChange={setPipelineId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Стадия *</Label>
                  <Select
                    value={stageId}
                    onValueChange={setStageId}
                    disabled={!pipelineId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStages.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          <span
                            className="inline-block h-2 w-2 rounded-full mr-2 align-middle"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Section>

          {/* Шаблоны */}
          <Section title="Шаблоны текста">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>
                  Заголовок сделки <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  placeholder="Заказ с CAMPO — {source_ref_id}"
                />
                <PlaceholderChips
                  onInsert={(p) => insertPlaceholder(p, "title")}
                />
              </div>

              <div className="space-y-1">
                <Label>Заметки</Label>
                <Textarea
                  rows={3}
                  value={notesTemplate}
                  onChange={(e) => setNotesTemplate(e.target.value)}
                  placeholder="Клиент: {client.name}\nТелефон: {client.phone}"
                />
                <PlaceholderChips
                  onInsert={(p) => insertPlaceholder(p, "notes")}
                />
              </div>
            </div>
          </Section>

          {/* Ответственный */}
          <Section title="Назначение ответственного">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Стратегия</Label>
                <Select
                  value={strategy}
                  onValueChange={(v) => setStrategy(v as CrmIngestStrategy)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      Без ответственного (в очередь «Свободные»)
                    </SelectItem>
                    <SelectItem value="fixed">Всегда один и тот же</SelectItem>
                    <SelectItem value="round_robin">
                      По кругу из пула
                    </SelectItem>
                    <SelectItem value="least_busy">
                      Наименее загруженный из пула
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {strategy === "fixed" && (
                <div className="space-y-1">
                  <Label>Ответственный *</Label>
                  <Select value={fixedUserId} onValueChange={setFixedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      {systemUsers.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.full_name}{" "}
                          <span className="text-gray-500">{u.email}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(strategy === "round_robin" || strategy === "least_busy") && (
                <div className="space-y-1">
                  <Label>Пул менеджеров *</Label>
                  <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                    {systemUsers.map((u) => {
                      const checked = poolIds.includes(u.id)
                      return (
                        <label
                          key={u.id}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer",
                            checked
                              ? "bg-brand-yellow/25"
                              : "hover:bg-gray-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setPoolIds((prev) =>
                                e.target.checked
                                  ? [...prev, u.id]
                                  : prev.filter((id) => id !== u.id),
                              )
                            }}
                          />
                          <span className="text-sm">{u.full_name}</span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {u.email}
                          </span>
                        </label>
                      )
                    })}
                    {systemUsers.length === 0 && (
                      <div className="text-sm text-gray-500 py-2 text-center">
                        Системных пользователей нет
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Прочее */}
          <Section title="Прочее">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Приоритет по умолчанию</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="normal">Обычный</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Как искать клиента</Label>
                <Select
                  value={clientResolution}
                  onValueChange={(v) =>
                    setClientResolution(v as CrmIngestClientResolution)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не создавать</SelectItem>
                    <SelectItem value="always_create">
                      Всегда создавать нового
                    </SelectItem>
                    <SelectItem value="find_by_email">
                      Искать по email → создать если нет
                    </SelectItem>
                    <SelectItem value="find_by_phone">
                      Искать по телефону → создать если нет
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 cursor-pointer">
                <Switch checked={dedupeByRef} onCheckedChange={setDedupeByRef} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">Дедупликация</div>
                  <div className="text-xs text-gray-500">
                    Не создавать повторно с тем же source_ref_id
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 cursor-pointer">
                <Switch checked={active} onCheckedChange={setActive} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">Активен</div>
                  <div className="text-xs text-gray-500">
                    Выключенный отвечает 404 на все запросы
                  </div>
                </div>
              </label>
            </div>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {editing ? "Сохранить" : "Создать хук"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/30 p-4 space-y-2">
      <div className="text-sm font-semibold text-gray-700">{title}</div>
      {children}
    </div>
  )
}

function PlaceholderChips({ onInsert }: { onInsert: (p: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {PLACEHOLDERS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onInsert(p)}
          className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 hover:bg-brand-yellow/30 text-gray-700 transition-colors"
        >
          {p}
        </button>
      ))}
    </div>
  )
}

/** Финальный экран «Хук готов» с копируемыми блоками. */
function ReadyDialog({ url, onDone }: { url: string; onDone: () => void }) {
  const { toast } = useToast()
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedPayload, setCopiedPayload] = useState(false)

  const sample = JSON.stringify(SAMPLE_PAYLOAD_TEMPLATE, null, 2)

  const copy = async (text: string, which: "url" | "payload") => {
    try {
      await navigator.clipboard.writeText(text)
      if (which === "url") {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } else {
        setCopiedPayload(true)
        setTimeout(() => setCopiedPayload(false), 2000)
      }
      toast({ title: "Скопировано" })
    } catch {
      toast({ variant: "destructive", title: "Не удалось скопировать" })
    }
  }

  return (
    <Dialog open onOpenChange={onDone}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-4 w-4 text-emerald-600" />
            </span>
            Хук готов
          </DialogTitle>
          <DialogDescription>
            Вставьте URL в настройки внешнего сервиса. Токен показывается один
            раз — сохраните URL, потом его можно будет скопировать снова из
            списка источников.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-gray-500">
              URL для внешнего сервиса
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 p-2 rounded font-mono break-all">
                {url}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(url, "url")}
                className="shrink-0"
              >
                {copiedUrl ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Метод: <code>POST</code> · Content-Type:{" "}
              <code>application/json</code>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-gray-500">
              Пример payload
            </Label>
            <div className="mt-1 flex items-start gap-2">
              <pre className="flex-1 text-[11px] bg-gray-100 p-2 rounded font-mono overflow-x-auto max-h-64 leading-relaxed">
                {sample}
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(sample, "payload")}
                className="shrink-0"
              >
                {copiedPayload ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Все поля опциональные кроме <code>source_ref_id</code> (нужен для
              дедупликации).
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onDone}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            Готово
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
