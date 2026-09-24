"use client"

/**
 * Модалка создания новой сделки.
 *
 * UX-мелочи:
 *  - Все input'ы, textarea, кнопки и select-триггеры внутри модалки
 *    рендерятся БЕЗ focus-кольца (юзер жаловался на видимую рамку).
 *  - Клиент и Ответственный выбираются не Select-дропдауном, а
 *    пикер-модалкой с поиском (см. EntityPickerDialog) — так удобнее
 *    когда справочник большой.
 */

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Loader2, User, UserSquare2 } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { crmGet, crmPost } from "@/lib/crm-fetch"
import { useToast } from "@/hooks/use-toast"
import type {
  Deal,
  DealPipeline,
  DealStage,
  PipelinesListResponse,
} from "@/lib/deals-types"

import EntityPickerDialog from "./entity-picker-dialog"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (deal: Deal) => void
  /** Начальные значения — по умолчанию берутся из активной воронки/стадии. */
  initialPipelineId?: number | null
  initialStageId?: number | null
}

interface KpClient {
  id: number
  full_name: string | null
  object: string | null
  display_name: string
  contacts?: { phone: string; note?: string }[]
}

interface SystemUser {
  id: number
  full_name: string
  email: string
}

// Убираем фокус-кольцо со всех form-контролов в этой модалке. Покрываем
// и `focus:`, и `focus-visible:` — shadcn Select использует `focus:ring-2`,
// а Input/Textarea — `focus-visible:ring-brand-yellow` (пропатчено глобально).
// data-[state=open] нужен для SelectTrigger — открытый селект иначе
// подсвечивается ring'ом от Radix.
const NO_RING =
  "focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 focus:!outline-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0"

export default function DealCreateDialog({
  open,
  onOpenChange,
  onCreated,
  initialPipelineId,
  initialStageId,
}: Props) {
  const { toast } = useToast()

  const [pipelines, setPipelines] = useState<DealPipeline[]>([])
  const [clients, setClients] = useState<KpClient[]>([])
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState("")
  const [pipelineId, setPipelineId] = useState<string>("")
  const [stageId, setStageId] = useState<string>("")
  const [clientId, setClientId] = useState<number | null>(null)
  const [amount, setAmount] = useState<string>("")
  const [currency, setCurrency] = useState<string>("KZT")
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal")
  const [responsibleId, setResponsibleId] = useState<number | null>(null)
  const [notes, setNotes] = useState("")

  // Пикеры
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [responsiblePickerOpen, setResponsiblePickerOpen] = useState(false)

  // Загрузка справочников когда модалка открывается.
  useEffect(() => {
    if (!open) return
    let ignore = false

    const loadPipelines = crmGet<PipelinesListResponse>(
      "/api/admin/deal-pipelines?with_stages=1",
    ).catch((e) => {
      console.error("load pipelines:", e)
      return { success: false, pipelines: [] as any[] } as PipelinesListResponse
    })
    const loadClients = crmGet<{ clients: KpClient[] }>("/api/kp-clients").catch(
      (e) => {
        console.error("load clients:", e)
        return { clients: [] as KpClient[] }
      },
    )
    // Flask отдаёт system-users плоским массивом, не {users: []}.
    const loadUsers = crmGet<SystemUser[] | { users: SystemUser[] }>(
      "/api/system-users",
    ).catch((e) => {
      console.error("load system users:", e)
      return [] as SystemUser[]
    })

    Promise.all([loadPipelines, loadClients, loadUsers]).then(([p, c, u]) => {
      if (ignore) return
      setPipelines(p.pipelines || [])
      setClients(c.clients || [])
      const users = Array.isArray(u) ? u : u.users || []
      setSystemUsers(users)
    })
    return () => {
      ignore = true
    }
  }, [open])

  // Начальные значения воронки/стадии.
  useEffect(() => {
    if (!open) return
    if (initialPipelineId != null) setPipelineId(String(initialPipelineId))
    else if (pipelines[0]) setPipelineId(String(pipelines[0].id))
  }, [open, initialPipelineId, pipelines])

  useEffect(() => {
    if (!pipelineId) return
    const p = pipelines.find((x) => String(x.id) === pipelineId)
    if (!p?.stages?.length) return
    if (initialStageId != null && p.stages.some((s) => s.id === initialStageId)) {
      setStageId(String(initialStageId))
    } else {
      const first = [...p.stages].sort((a, b) => a.order - b.order)[0]
      setStageId(String(first.id))
    }
  }, [pipelineId, initialStageId, pipelines])

  // Reset при закрытии.
  useEffect(() => {
    if (open) return
    setName("")
    setAmount("")
    setCurrency("KZT")
    setPriority("normal")
    setResponsibleId(null)
    setClientId(null)
    setNotes("")
  }, [open])

  const activeStages = useMemo<DealStage[]>(() => {
    const p = pipelines.find((x) => String(x.id) === pipelineId)
    return [...(p?.stages ?? [])].sort((a, b) => a.order - b.order)
  }, [pipelines, pipelineId])

  const selectedClient = clients.find((c) => c.id === clientId) ?? null
  const selectedUser = systemUsers.find((u) => u.id === responsibleId) ?? null

  const canSubmit = name.trim().length > 0 && pipelineId && stageId && !loading

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        pipeline_id: Number(pipelineId),
        stage_id: Number(stageId),
        priority,
      }
      if (clientId != null) payload.client_id = clientId
      if (responsibleId != null) payload.responsible_user_id = responsibleId
      const parsedAmount = Number(amount)
      if (amount && !Number.isNaN(parsedAmount)) payload.amount = parsedAmount
      if (currency) payload.currency = currency.trim()
      if (notes.trim()) payload.notes = notes.trim()

      const res = await crmPost<{ success: boolean; deal: Deal }>(
        "/api/admin/deals",
        payload,
      )
      toast({ title: "Сделка создана" })
      onCreated(res.deal)
      onOpenChange(false)
    } catch (e: any) {
      console.error(e)
      toast({
        variant: "destructive",
        title: "Не удалось создать сделку",
        description: e?.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новая сделка</DialogTitle>
            <DialogDescription>
              Заполните ключевые поля — детали можно доредактировать в
              карточке.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="deal-name">
                Название <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Заказ POS-терминалов CAMPO"
                autoFocus
                className={NO_RING}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Воронка</Label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                  <SelectTrigger className={NO_RING}>
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
                <Label>Стадия</Label>
                <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
                  <SelectTrigger className={NO_RING}>
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

            {/* Клиент — пикер-модалка */}
            <div className="space-y-1">
              <Label>Клиент</Label>
              <PickerTrigger
                icon={<UserSquare2 className="h-4 w-4 text-gray-500" />}
                onClick={() => setClientPickerOpen(true)}
                placeholder="Не выбран"
                selected={
                  selectedClient
                    ? {
                        primary: selectedClient.display_name,
                        secondary:
                          selectedClient.contacts?.[0]?.phone ||
                          selectedClient.object ||
                          undefined,
                      }
                    : null
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Сумма</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={NO_RING}
                  />
                  <Input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className={cn("w-16 text-center", NO_RING)}
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Приоритет</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger className={NO_RING}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="normal">Обычный</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ответственный — пикер-модалка */}
            <div className="space-y-1">
              <Label>Ответственный</Label>
              <PickerTrigger
                icon={<User className="h-4 w-4 text-gray-500" />}
                onClick={() => setResponsiblePickerOpen(true)}
                placeholder="Я (по умолчанию)"
                selected={
                  selectedUser
                    ? {
                        primary: selectedUser.full_name,
                        secondary: selectedUser.email,
                      }
                    : null
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Заметки</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Заказчик просил срочную доставку…"
                rows={3}
                className={NO_RING}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className={NO_RING}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "bg-brand-yellow text-black hover:bg-yellow-500",
                NO_RING,
              )}
            >
              {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Создать сделку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Пикеры */}
      <EntityPickerDialog
        open={clientPickerOpen}
        onOpenChange={setClientPickerOpen}
        title="Выбор клиента"
        searchPlaceholder="Поиск по имени / телефону"
        emptyText="Клиентов не найдено"
        clearText="Убрать выбор клиента"
        items={clients.map((c) => ({
          id: c.id,
          primary: c.display_name,
          secondary:
            c.contacts?.map((x) => x.phone).filter(Boolean).join(", ") ||
            c.object ||
            undefined,
        }))}
        value={clientId}
        onChange={setClientId}
      />

      <EntityPickerDialog
        open={responsiblePickerOpen}
        onOpenChange={setResponsiblePickerOpen}
        title="Выбор ответственного"
        searchPlaceholder="Поиск по имени / email"
        emptyText="Менеджеров не найдено"
        clearText="Ответственный — я (по умолчанию)"
        items={systemUsers.map((u) => ({
          id: u.id,
          primary: u.full_name,
          secondary: u.email,
        }))}
        value={responsibleId}
        onChange={setResponsibleId}
      />
    </>
  )
}

/**
 * Кнопка-триггер для пикер-модалки. Визуально маскируется под инпут,
 * с одной иконкой слева и chevron справа. Без focus-кольца.
 */
function PickerTrigger({
  icon,
  onClick,
  placeholder,
  selected,
}: {
  icon: React.ReactNode
  onClick: () => void
  placeholder: string
  selected: { primary: string; secondary?: string } | null
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full h-10 flex items-center gap-2 rounded-md border border-input bg-background px-3 text-left",
        "hover:border-gray-400 transition-colors",
        NO_RING,
      )}
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        {selected ? (
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm truncate">{selected.primary}</span>
            {selected.secondary && (
              <span className="text-xs text-gray-500 truncate">
                {selected.secondary}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}
      </div>
      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
    </button>
  )
}
