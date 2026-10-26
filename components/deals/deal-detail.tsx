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
import {
  ArrowLeft, Loader2, Trash2, Circle, Save,
  MessageSquare, ChevronUp,
} from "lucide-react"

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
import DealSurveyCard from "./deal-survey-card"
import DealMoveSurveyDialog from "./deal-move-survey-dialog"
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
  const [sources, setSources] = useState<
    Array<{ id: number; name: string; color: string | null; is_active: boolean }>
  >([])
  const [companies, setCompanies] = useState<Array<{ id: number; name: string; bin?: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Чат при каждом входе на карточку свёрнут — освобождает место под
  // Информацию. Не персистим — пользователь может развернуть прямо
  // здесь, но при следующем заходе снова увидит компактный вид.
  const [chatCollapsed, setChatCollapsed] = useState(true)
  // Путь для перехода после подтверждения выхода без сохранения. null = закрыто.
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  // Инкрементим когда файл прилетел из чата — DocumentsCard видит это
  // через refreshKey и перечитывает список без reload страницы.
  const [docRefreshKey, setDocRefreshKey] = useState(0)

  const [draft, setDraft] = useState<Partial<FullDeal>>({})
  // Доп. контакты сделки — только не-primary. При save шлём как
  // contact_ids = [primary (draft.client_id), ...extra]. При смене primary
  // (через ClientPicker) draft.client_id меняется, а extraContactIds — не
  // автоматически. Если новый primary был в extra — убираем его оттуда.
  const [extraContactIds, setExtraContactIds] = useState<number[]>([])

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
      crmGet<{ sources: Array<{ id: number; name: string; color: string | null; is_active: boolean }> }>(
        "/api/admin/deal-sources",
      ).catch(() => ({ sources: [] })),
      crmGet<{ companies: Array<{ id: number; name: string; bin?: string | null }> }>(
        "/api/admin/kp-companies",
      ).catch(() => ({ companies: [] })),
    ])
      .then(([d, p, c, u, src, co]) => {
        if (ignore) return
        setDeal(d.deal)
        setDraft(makeDraft(d.deal))
        setPipelines(p.pipelines || [])
        const cs = Array.isArray(c) ? c : (c.clients || [])
        const us = Array.isArray(u) ? u : (u.users || [])
        setClients(cs)
        setUsers(us)
        setSources(src.sources || [])
        setCompanies(co.companies || [])

        // Доп. контакты = все из deal.contacts минус primary.
        const dealContacts = (d.deal as any).contacts || []
        const primaryId = d.deal.client_id
        setExtraContactIds(
          dealContacts
            .map((x: any) => x.client_id)
            .filter((id: number) => id !== primaryId),
        )
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

  // Текущее серверное значение доп. контактов — для dirty-сравнения.
  const serverExtraContactIds = useMemo(() => {
    if (!deal) return [] as number[]
    const list = ((deal as any).contacts || []) as Array<{ client_id: number }>
    return list.map((x) => x.client_id).filter((id) => id !== deal.client_id)
  }, [deal])

  const isDirty = useMemo(() => {
    if (!deal) return false
    for (const k of Object.keys(draft) as (keyof FullDeal)[]) {
      if ((draft as any)[k] !== (deal as any)[k]) return true
    }
    // Сравниваем доп. контакты как set — порядок не важен.
    const a = [...extraContactIds].sort((x, y) => x - y).join(",")
    const b = [...serverExtraContactIds].sort((x, y) => x - y).join(",")
    if (a !== b) return true
    return false
  }, [draft, deal, extraContactIds, serverExtraContactIds])

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
      // Доп. контакты шлём только если изменились — иначе лишний UPDATE
      // DealContact-таблицы.
      const extraA = [...extraContactIds].sort((x, y) => x - y).join(",")
      const extraB = [...serverExtraContactIds].sort((x, y) => x - y).join(",")
      const extraChanged = extraA !== extraB
      const primaryChanged = payload.client_id !== undefined
      if (extraChanged || primaryChanged) {
        const primary = (draft.client_id ?? deal.client_id) as number | null
        const list = primary != null ? [primary, ...extraContactIds] : [...extraContactIds]
        payload.contact_ids = list
        if (primary != null) payload.primary_contact_id = primary
      }
      const res = await crmPut<{ deal: FullDeal }>(
        `/api/admin/deals/${deal.id}`,
        payload,
      )
      setDeal(res.deal)
      setDraft(makeDraft(res.deal))
      // Пересинхронизируем extraContactIds с ответом сервера.
      const dealContacts = (res.deal as any).contacts || []
      const newPrimary = res.deal.client_id
      setExtraContactIds(
        dealContacts
          .map((x: any) => x.client_id)
          .filter((id: number) => id !== newPrimary),
      )
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

  // Состояние модалки опросника при move. Открывается, когда бэк возвращает
  // 400 с missing_codes — тогда юзер заполняет селекты и мы повторяем move.
  const [surveyDialog, setSurveyDialog] = useState<{
    stageId: number
    stageName?: string
    missing: string[]
  } | null>(null)

  const _doMove = async (
    newStageId: number,
    surveyValues?: Record<string, number>,
  ): Promise<boolean> => {
    if (!deal) return false
    try {
      const body: Record<string, any> = { stage_id: newStageId }
      if (surveyValues && Object.keys(surveyValues).length)
        body.survey_values = surveyValues
      const res = await crmPost<{ deal: FullDeal }>(
        `/api/admin/deals/${deal.id}/move`,
        body,
      )
      setDeal(res.deal)
      setDraft(makeDraft(res.deal))
      setSurveyDialog(null)
      return true
    } catch (e: any) {
      const payload = e?.payload
      if (
        e?.status === 400 &&
        Array.isArray(payload?.missing_codes) &&
        payload.missing_codes.length > 0
      ) {
        // На этой стадии требуются непустые survey_values — показываем модалку.
        let stageName: string | undefined
        for (const p of pipelines) {
          const s = p.stages?.find((x) => x.id === newStageId)
          if (s) { stageName = s.name; break }
        }
        setSurveyDialog({
          stageId: newStageId,
          stageName,
          missing: payload.missing_codes,
        })
        return false
      }
      toast({
        variant: "destructive",
        title: "Не удалось сменить стадию",
        description: e?.message,
      })
      return false
    }
  }

  const handleMoveStage = (newStageId: number) => {
    void _doMove(newStageId)
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

  // Предупреждение при закрытии/перезагрузке таба если dirty. Навигация
  // внутри приложения — через кнопку «К доске», она сама открывает диалог.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

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
    <div className="xl:flex xl:flex-col xl:h-[calc(100dvh-7rem)] space-y-2">
      {/* Шапка — одна строка, компактная. Слева: back + title + inline-meta.
          Справа: селект стадии, Сохранить, свернуть/раскрыть чат, удалить. */}
      <Card className="rounded-xl border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] shrink-0">
        <div className="px-3 py-1.5 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 px-2.5 shrink-0"
            onClick={() => {
              if (isDirty) setPendingNavigation("/admin/deals")
              else router.push("/admin/deals")
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            К доске
          </Button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate leading-tight">{deal.name}</h1>
            <div className="hidden md:flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
              <span>ID: {deal.id}</span>
              {pipeline && <><span>·</span><span className="truncate max-w-[140px]">{pipeline.name}</span></>}
              {stage && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Circle
                      className="h-2 w-2"
                      style={{ fill: stage.color, color: stage.color }}
                    />
                    <span className="truncate max-w-[120px]">{stage.name}</span>
                  </span>
                </>
              )}
              <span>·</span>
              <StatusBadge status={deal.status} />
            </div>
          </div>

          {pipeline && (
            <div className="w-44 shrink-0">
              <Select
                value={String(deal.stage_id)}
                onValueChange={(v) => handleMoveStage(Number(v))}
              >
                <SelectTrigger className="rounded-lg h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(pipeline.stages ?? [])
                    // Прячем деактивированные, кроме той, что сейчас у
                    // сделки — её оставляем видимой с меткой «архив»,
                    // чтобы юзер мог сменить на активную.
                    .filter((s) => (s as any).is_active !== false || s.id === deal.stage_id)
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        <span
                          className="inline-block h-2 w-2 rounded-full mr-2 align-middle"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                        {(s as any).is_active === false && (
                          <span className="ml-1.5 text-[10px] uppercase text-gray-400">
                            архив
                          </span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-lg h-8 bg-brand-yellow text-black hover:bg-yellow-500 shrink-0"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Сохранить
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            className="text-red-500 hover:bg-red-50 h-8 w-8 shrink-0"
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
      <div
        className={cn(
          "grid grid-cols-1 gap-3 xl:flex-1 xl:min-h-0",
          chatCollapsed
            ? "xl:grid-cols-[minmax(320px,1fr)_minmax(0,0.9fr)_minmax(320px,1fr)]"
            : "xl:grid-cols-[minmax(320px,1fr)_minmax(0,0.9fr)_minmax(440px,1.4fr)]",
        )}
      >
        <div className="min-w-0 xl:overflow-y-auto xl:pr-1">
          <DealInfoCard
            deal={deal}
            draft={draft}
            onDraft={(patch) => setDraft((p) => ({ ...p, ...patch }))}
            saving={saving}
            isDirty={isDirty}
            clients={clients}
            users={users}
            sources={sources}
            companies={companies}
            onSourceCreated={(s) =>
              setSources((prev) =>
                prev.some((x) => x.id === s.id) ? prev : [...prev, s],
              )
            }
            onCompanyCreated={(c) =>
              setCompanies((prev) =>
                prev.some((x) => x.id === c.id) ? prev : [...prev, c],
              )
            }
            onClientCreated={(cl) =>
              setClients((prev) =>
                prev.some((x) => x.id === cl.id)
                  ? prev
                  : [{ id: cl.id, display_name: cl.display_name } as any, ...prev],
              )
            }
            clientsById={clientsById}
            usersById={usersById}
            creatorId={deal.creator_id ?? null}
            extraContactIds={extraContactIds}
            onExtraContactsChange={setExtraContactIds}
          />

          {/* Пока чат развёрнут — опросник «Информация» сидит под
              DealInfoCard в левой колонке (как было). Когда чат
              свёрнут — опросник уезжает в 3-ю колонку (см. ниже). */}
          {!chatCollapsed && (
            <div className="mt-3">
              <DealSurveyCard
                deal={deal}
                draft={draft}
                onDraft={(patch) => setDraft((p) => ({ ...p, ...patch }))}
              />
            </div>
          )}
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
            refreshKey={docRefreshKey}
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

        {chatCollapsed ? (
          <div className="min-w-0 xl:overflow-y-auto xl:pr-1 flex flex-col">
            <DealSurveyCard
              deal={deal}
              draft={draft}
              onDraft={(patch) => setDraft((p) => ({ ...p, ...patch }))}
            />
            <button
              type="button"
              onClick={() => setChatCollapsed(false)}
              className={cn(
                "mt-auto self-end rounded-lg bg-brand-yellow/15 border border-brand-yellow/40",
                "hover:bg-brand-yellow/25 text-black inline-flex items-center gap-1.5",
                "px-3 py-1.5 text-sm font-semibold transition-colors",
                "sticky bottom-0 shadow-sm",
              )}
              title="Развернуть обсуждения"
            >
              <MessageSquare className="h-4 w-4" />
              Обсуждения
              <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>
        ) : (
          <div className="min-w-0 xl:h-full">
            <DealChatPanel
              dealId={deal.id}
              currentUserId={currentUserId}
              usersById={usersById}
              onAttachmentUploaded={() => setDocRefreshKey((k) => k + 1)}
              onCollapse={() => setChatCollapsed(true)}
            />
          </div>
        )}
      </div>

      {/* Выход с несохранёнными правками */}
      <AlertDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(v) => !v && setPendingNavigation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Вы изменили поля сделки и не нажали «Сохранить». Выйти без сохранения?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                const dest = pendingNavigation!
                setPendingNavigation(null)
                router.push(dest)
              }}
              className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
            >
              Не сохранять
            </Button>
            <Button
              onClick={async () => {
                const dest = pendingNavigation!
                setPendingNavigation(null)
                await handleSave()
                router.push(dest)
              }}
              disabled={saving}
              className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Сохранить и выйти
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {surveyDialog && deal && (
        <DealMoveSurveyDialog
          open={true}
          pipelineId={deal.pipeline_id}
          missingCodes={surveyDialog.missing}
          stageName={surveyDialog.stageName}
          onCancel={() => setSurveyDialog(null)}
          onSubmit={async (vals) => _doMove(surveyDialog.stageId, vals)}
        />
      )}
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
    company_id: (d as any).company_id ?? null,
    source_id: d.source_id,
    expected_close_at: d.expected_close_at,
  } as Partial<Deal>
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
