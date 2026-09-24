"use client"

/**
 * Карточка сделки /admin/deals/[id]. Full-width, две колонки:
 *
 *   ┌──────────────────────── header ────────────────────────┐
 *   │ ← К доске | Название | стадия/статус select | 🗑        │
 *   └────────────────────────────────────────────────────────┘
 *
 *   ┌──── left (flex-1, стек карточек) ────┬─ right (400px chat) ─┐
 *   │  DealInfoCard                        │                       │
 *   │  DealMembersCard                     │  DealChatPanel        │
 *   │  DealDocumentsCard                   │  (sticky, h=calc)     │
 *   │  TabKp                               │                       │
 *   │  TabTasks                            │                       │
 *   └──────────────────────────────────────┴───────────────────────┘
 *
 * Вкладок нет, всё на одной странице. Лента и Заказы убраны из UI
 * (в API остаются — их можно вернуть отдельной кнопкой позже).
 *
 * Справочники клиентов/юзеров грузятся один раз в этом компоненте и
 * прокидываются в дочерние карточки — так дочерние не делают N+1
 * запросов.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Trash2, Circle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type {
  Deal,
  DealPipeline,
  PipelinesListResponse,
} from "@/lib/deals-types"

import DealInfoCard from "./deal-info-card"
import DealMembersCard from "./deal-members-card"
import DealDocumentsCard from "./deal-documents-card"
import DealChatPanel from "./deal-chat-panel"
import TabKp from "./tabs/tab-kp"
import TabTasks from "./tabs/tab-tasks"

interface Props {
  dealId: number
}

interface DealMember {
  id: number
  user_id: number
  role: string
  added_at: string | null
}

interface KpAttachment {
  id: number
  kp_history_id: number
  attached_at: string | null
  attached_by: number | null
  kp: {
    id: number
    name: string
    total_amount: number
    signed_at: string | null
    created_at: string | null
  }
}

interface FullDeal extends Deal {
  members?: DealMember[]
  kps?: KpAttachment[]
}

interface Client {
  id: number
  display_name: string
  full_name?: string | null
  object?: string | null
  contacts?: { phone?: string; note?: string }[]
}

interface Sys {
  id: number
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
}

export default function DealDetail({ dealId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const [deal, setDeal] = useState<FullDeal | null>(null)
  const [pipelines, setPipelines] = useState<DealPipeline[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<Sys[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [draft, setDraft] = useState<Partial<FullDeal>>({})

  const reloadDeal = useCallback(async () => {
    const res = await crmGet<{ deal: FullDeal }>(`/api/admin/deals/${dealId}`)
    setDeal(res.deal)
    // draft НЕ трогаем — редактируемые поля остаются как есть (dirty flow).
    // Если сохранение прошло — родитель сам сбросит draft (см. handleSave).
  }, [dealId])

  // Первичная загрузка.
  useEffect(() => {
    let ignore = false
    setLoading(true)

    Promise.all([
      crmGet<{ deal: FullDeal }>(`/api/admin/deals/${dealId}`),
      crmGet<PipelinesListResponse>("/api/admin/deal-pipelines?with_stages=1"),
      crmGet<{ clients: Client[] } | Client[]>("/api/kp-clients").catch(() => ({ clients: [] })),
      crmGet<{ users: Sys[] } | Sys[]>("/api/system-users").catch(() => ({ users: [] })),
    ])
      .then(([d, p, c, u]) => {
        if (ignore) return
        setDeal(d.deal)
        setDraft(makeDraft(d.deal))
        setPipelines(p.pipelines || [])
        const cs = Array.isArray(c) ? c : (c.clients || [])
        const us = Array.isArray(u) ? u : (u.users || [])
        setClients(cs)
        setUsers(us)
      })
      .catch((e) => {
        console.error(e)
        toast({
          variant: "destructive",
          title: "Не удалось загрузить сделку",
          description: e?.message,
        })
      })
      .finally(() => { if (!ignore) setLoading(false) })

    return () => { ignore = true }
  }, [dealId, toast])

  const clientsById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.display_name])),
    [clients],
  )
  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, userDisplayName(u)])),
    [users],
  )

  const stage = useMemo(() => {
    if (!deal) return null
    for (const p of pipelines) {
      const s = p.stages?.find((x) => x.id === deal.stage_id)
      if (s) return s
    }
    return null
  }, [deal, pipelines])

  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === deal?.pipeline_id) ?? null,
    [pipelines, deal],
  )

  const isDirty = useMemo(() => {
    if (!deal) return false
    for (const k of Object.keys(draft) as (keyof FullDeal)[]) {
      if ((draft as any)[k] !== (deal as any)[k]) return true
    }
    return false
  }, [draft, deal])

  const handleSave = async () => {
    if (!deal) return
    setSaving(true)
    try {
      const payload: Record<string, any> = {}
      for (const k of Object.keys(draft) as (keyof FullDeal)[]) {
        if ((draft as any)[k] !== (deal as any)[k]) {
          payload[k as string] = (draft as any)[k]
        }
      }
      const res = await crmPut<{ deal: FullDeal }>(
        `/api/admin/deals/${deal.id}`,
        payload,
      )
      setDeal(res.deal)
      setDraft(makeDraft(res.deal))
      toast({ title: "Сохранено" })
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

  const handleMoveStage = async (newStageId: number) => {
    if (!deal) return
    try {
      const res = await crmPost<{ deal: FullDeal }>(
        `/api/admin/deals/${deal.id}/move`,
        { stage_id: newStageId },
      )
      setDeal(res.deal)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось сменить стадию",
        description: e?.message,
      })
    }
  }

  const handleDelete = async () => {
    if (!deal) return
    try {
      await crmDelete(`/api/admin/deals/${deal.id}`)
      toast({ title: "Сделка удалена" })
      router.push("/admin/deals")
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!deal) {
    return (
      <div className="text-center py-24 text-gray-500">Сделка не найдена</div>
    )
  }

  return (
    <div className="xl:flex xl:flex-col xl:h-[calc(100dvh-7rem)] space-y-3">
      {/* Шапка */}
      <Card className="rounded-xl border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] shrink-0">
        <div className="p-4 flex items-center gap-3">
          <Button variant="ghost" asChild size="sm" className="rounded-full">
            <Link href="/admin/deals">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              К доске
            </Link>
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{deal.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>ID: {deal.id}</span>
              {pipeline && <><span>·</span><span>{pipeline.name}</span></>}
              {stage && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Circle
                      className="h-2 w-2"
                      style={{ fill: stage.color, color: stage.color }}
                    />
                    {stage.name}
                  </span>
                </>
              )}
              <span>·</span>
              <StatusBadge status={deal.status} />
            </div>
          </div>

          {pipeline && (
            <div className="w-56">
              <Select
                value={String(deal.stage_id)}
                onValueChange={(v) => handleMoveStage(Number(v))}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(pipeline.stages ?? [])
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
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
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            className="text-red-500 hover:bg-red-50"
            title="Удалить сделку"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Три колонки:
            [1] Информация о сделке — самостоятельная карточка слева
            [2] Средний стек — роли/документы/КП/задачи
            [3] Чат — растягивается на всю высоту доступного пространства
          На средних экранах (< xl) сворачиваем в одну колонку.

          Родительский div на xl фиксирован по высоте (100dvh - высота
          админ-навбара сверху), grid — flex-1 min-h-0, каждая из первых
          двух колонок скроллится независимо (`overflow-y-auto`), правая
          отдаёт всю высоту Chat'у, который сам режет message-list. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,1fr)_minmax(0,0.9fr)_minmax(440px,1.4fr)] gap-3 xl:flex-1 xl:min-h-0">
        <div className="min-w-0 xl:overflow-y-auto xl:pr-1">
          <DealInfoCard
            deal={deal}
            draft={draft}
            onDraft={(patch) => setDraft((p) => ({ ...p, ...patch }))}
            onSave={handleSave}
            saving={saving}
            isDirty={isDirty}
            clients={clients}
            users={users}
            clientsById={clientsById}
            usersById={usersById}
            creatorId={deal.creator_id ?? null}
          />
        </div>

        <div className="space-y-3 min-w-0 xl:overflow-y-auto xl:pr-1">
          <DealMembersCard
            dealId={deal.id}
            creatorId={deal.creator_id ?? null}
            members={deal.members ?? []}
            users={users}
            usersById={usersById}
            onChange={reloadDeal}
          />

          <DealDocumentsCard
            dealId={deal.id}
            usersById={usersById}
          />

          <TabKp
            dealId={deal.id}
            kps={(deal.kps ?? []) as any}
            onChange={reloadDeal}
          />

          <TabTasks
            dealId={deal.id}
            clientId={deal.client_id ?? null}
            responsibleUserId={deal.responsible_user_id ?? null}
            usersById={usersById}
          />
        </div>

        <div className="min-w-0 xl:h-full">
          <DealChatPanel
            dealId={deal.id}
            currentUserId={currentUserId}
            usersById={usersById}
          />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сделку?</AlertDialogTitle>
            <AlertDialogDescription>
              Сделка «{deal.name}» будет удалена вместе со всеми её данными
              (участники, лента, привязки КП/заказов). Действие нельзя отменить.
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

function makeDraft(d: Deal): Partial<Deal> {
  return {
    name: d.name,
    amount: d.amount,
    currency: d.currency,
    priority: d.priority,
    notes: d.notes,
    responsible_user_id: d.responsible_user_id,
    client_id: d.client_id,
    expected_close_at: d.expected_close_at,
  }
}

function StatusBadge({ status }: { status: Deal["status"] }) {
  const map: Record<Deal["status"], { label: string; cls: string }> = {
    open: { label: "открыта", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    won: { label: "выиграна", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    lost: { label: "проиграна", cls: "bg-red-50 text-red-700 border-red-200" },
  }
  const cfg = map[status]
  return (
    <span className={cn("border rounded-full px-2 py-0.5", cfg.cls)}>{cfg.label}</span>
  )
}

function userDisplayName(u: Sys): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}
