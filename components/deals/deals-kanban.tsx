"use client"

/**
 * Kanban-доска сделок. Одна страница — вся логика тут для MVP;
 * если разрастётся — разобьём на sub-компоненты.
 *
 * Данные:
 *   GET  /api/admin/deal-pipelines?with_stages=1    → воронки + стадии
 *   GET  /api/admin/deals?pipeline_id=N             → сделки воронки
 *   POST /api/admin/deals/<id>/move                 → drag смена стадии
 *
 * Drag&drop через @dnd-kit. Строим SortableContext на каждую колонку —
 * так карточки внутри колонки сортируются, а между колонками dnd-kit
 * автоматически переносит через drop-detection.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Briefcase, Circle, Trophy, Ban } from "lucide-react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { crmGet, crmPost } from "@/lib/crm-fetch"
import { useToast } from "@/hooks/use-toast"
import type {
  Deal,
  DealPipeline,
  DealStage,
  DealsListResponse,
  PipelinesListResponse,
} from "@/lib/deals-types"

interface Props {
  onCreate?: () => void       // клик по «+ Новая сделка» открывает модалку
  onOpenDeal?: (id: number) => void  // клик по карточке — открыть детали
}

interface KpClientLite {
  id: number
  display_name: string
}

interface SystemUserLite {
  id: number
  full_name: string
  email: string
}

export default function DealsKanban({ onCreate, onOpenDeal }: Props) {
  const { toast } = useToast()

  const [pipelines, setPipelines] = useState<DealPipeline[]>([])
  const [activePipelineId, setActivePipelineId] = useState<number | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [clientsById, setClientsById] = useState<Map<number, string>>(new Map())
  const [usersById, setUsersById] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [activeDrag, setActiveDrag] = useState<Deal | null>(null)

  // 1) Первичная загрузка воронок + справочников клиентов/юзеров.
  //    Каждый запрос независимо в .catch — один упавший не блокирует другой.
  useEffect(() => {
    let ignore = false

    const loadPipelines = crmGet<PipelinesListResponse>(
      "/api/admin/deal-pipelines?with_stages=1",
    ).catch((e) => {
      console.error("load pipelines:", e)
      toast({
        variant: "destructive",
        title: "Не удалось загрузить воронки",
        description: e?.message,
      })
      return { success: false, pipelines: [] as any[] } as PipelinesListResponse
    })
    const loadClients = crmGet<{ clients: KpClientLite[] }>("/api/kp-clients").catch(
      () => ({ clients: [] as KpClientLite[] }),
    )
    // Flask отдаёт system-users плоским массивом.
    const loadUsers = crmGet<SystemUserLite[] | { users: SystemUserLite[] }>(
      "/api/system-users",
    ).catch(() => [] as SystemUserLite[])

    Promise.all([loadPipelines, loadClients, loadUsers])
      .then(([p, c, u]) => {
        if (ignore) return
        const list = p.pipelines || []
        setPipelines(list)
        const first = list.find((x) => x.active) ?? list[0]
        if (first) setActivePipelineId(first.id)
        setClientsById(
          new Map((c.clients || []).map((x) => [x.id, x.display_name])),
        )
        const users = Array.isArray(u) ? u : u.users || []
        setUsersById(new Map(users.map((x) => [x.id, x.full_name || x.email])))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [toast])

  // 2) Загрузка сделок при смене активной воронки.
  useEffect(() => {
    if (activePipelineId == null) return
    let ignore = false
    crmGet<DealsListResponse>(`/api/admin/deals?pipeline_id=${activePipelineId}&limit=200`)
      .then((res) => {
        if (!ignore) setDeals(res.deals || [])
      })
      .catch((e) => {
        console.error("load deals:", e)
        toast({
          variant: "destructive",
          title: "Не удалось загрузить сделки",
          description: e?.message,
        })
      })
    return () => {
      ignore = true
    }
  }, [activePipelineId, toast])

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) ?? null,
    [pipelines, activePipelineId],
  )
  const stages = useMemo<DealStage[]>(
    () => [...(activePipeline?.stages ?? [])].sort((a, b) => a.order - b.order),
    [activePipeline],
  )

  // Группируем сделки по stage_id для быстрого рендера колонок.
  const dealsByStage = useMemo(() => {
    const map = new Map<number, Deal[]>()
    for (const s of stages) map.set(s.id, [])
    for (const d of deals) {
      const arr = map.get(d.stage_id)
      if (arr) arr.push(d)
    }
    // Сортируем внутри колонки — по updated_at DESC.
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
    }
    return map
  }, [deals, stages])

  const sensors = useSensors(
    // Игнорируем правую кнопку — правым кликом мы делаем pan Kanban'а
    // (см. handleBoardMouseDown ниже), а не drag сделки. dnd-kit по
    // умолчанию слушает все кнопки — фильтруем.
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  // ---- Pan правой кнопкой мыши по горизонтали ----
  // Задача: если стадий много, скроллим внутренний контейнер по горизонту
  // движением с зажатой правой кнопкой (браузерное меню гасим через
  // onContextMenu). Listener'ы навешиваются СИНХРОННО в handler'е
  // mousedown — если ставить через useEffect на state, первые события
  // теряются пока идёт ре-рендер.
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2) return // только правая кнопка
    const el = boardScrollRef.current
    if (!el) return
    e.preventDefault()

    const startX = e.clientX
    const startScroll = el.scrollLeft
    setPanning(true)

    const onMove = (ev: MouseEvent) => {
      el.scrollLeft = startScroll - (ev.clientX - startX)
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      setPanning(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const findStageIdForDraggable = useCallback(
    (dealId: number): number | undefined => {
      const d = deals.find((x) => x.id === dealId)
      return d?.stage_id
    },
    [deals],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id)
    setActiveDrag(deals.find((d) => d.id === id) ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const dealId = Number(active.id)
    const from = findStageIdForDraggable(dealId)
    if (from == null) return

    // over.id может быть id стадии (пустая колонка) или id сделки (в чужой
    // колонке). Разрешаем через overContainer:
    const overId = String(over.id)
    let toStageId: number | null = null
    if (overId.startsWith("stage-")) {
      toStageId = Number(overId.replace("stage-", ""))
    } else {
      const targetDeal = deals.find((d) => d.id === Number(overId))
      if (targetDeal) toStageId = targetDeal.stage_id
    }
    if (toStageId == null || toStageId === from) return

    // Оптимистично обновляем UI.
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: toStageId! } : d)))
    setMovingId(dealId)

    try {
      const res = await crmPost<{ success: boolean; deal: Deal }>(
        `/api/admin/deals/${dealId}/move`,
        { stage_id: toStageId },
      )
      // Заменяем на серверную версию (там мог измениться status на won/lost + updated_at).
      setDeals((prev) => prev.map((d) => (d.id === dealId ? res.deal : d)))
    } catch (e: any) {
      // Откатываем.
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: from } : d)))
      toast({
        variant: "destructive",
        title: "Не удалось переместить",
        description: e?.message,
      })
    } finally {
      setMovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!activePipeline || stages.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-brand-yellow/25 flex items-center justify-center">
          <Briefcase className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Воронок пока нет</h2>
          <p className="text-sm text-gray-500 mt-1">
            Настройте воронки и стадии в разделе управления сделками
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/deals/pipelines">Настройка воронок</Link>
        </Button>
      </div>
    )
  }

  return (
    // min-w-0 нужен чтобы flex-child (наш root) не растягивался под ширину
    // содержимого — иначе `overflow-x-auto` ниже не сработает и вся
    // страница уедет вправо когда стадий много.
    <div className="space-y-4 w-full min-w-0">
      {/* Шапка страницы */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Сделки</h1>
            <p className="text-sm text-gray-500">Всего в воронке: {deals.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href="/admin/deals/pipelines">Настройка воронок</Link>
          </Button>
          <Button
            size="sm"
            onClick={onCreate}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Новая сделка
          </Button>
        </div>
      </div>

      {/* Табы воронок. `overflow-x-auto` по спеке клипит и по y тоже,
          из-за чего тень активной кнопки обрезается ровной линией.
          `py-4 -my-4` — запас 16px под тень (offset 4 + blur 12),
          полная отрицательная компенсация чтобы вертикальный ритм
          вокруг остался как без правки. */}
      {pipelines.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-4 -my-4">
          {pipelines.map((p) => {
            const active = p.id === activePipelineId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePipelineId(p.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap bg-white",
                  "transition-all duration-150 ease-out",
                  active
                    ? "bg-brand-yellow/25 text-black font-semibold border border-brand-yellow shadow-[0_4px_12px_rgba(250,204,21,0.35)]"
                    : "text-gray-600 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.10)] hover:-translate-y-[1px] hover:text-gray-900",
                )}
              >
                {p.name}
                {!p.active && <span className="ml-1.5 text-xs text-gray-400">(выкл.)</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Кастомная жёлтая скроллбар-полоска над колонками. Показывается
            только когда содержимое шире контейнера. deps'ы триггерят
            пересчёт когда меняется набор колонок (смена воронки) или
            их наполнение (новые сделки). */}
        <TopScrollbar
          targetRef={boardScrollRef}
          deps={[stages.length, deals.length, activePipelineId]}
        />

        <div
          ref={boardScrollRef}
          onMouseDown={handleBoardMouseDown}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            // `overflow-x-auto` неявно клипит и по y, из-за чего тени
            // колонок обрезаются ровной линией по краям. Тень
            // (offset 6 + blur 18) требует ~24px запаса; `pt-3 pb-6`
            // — как раз столько. Отрицательные margin'ы компенсируют
            // весь этот запас: сверху `-mt-3` возвращает вертикальный
            // ритм, снизу `-mb-6` — тоже полностью (это последний
            // блок в потоке, ниже ничего нет).
            "flex gap-3 pt-3 -mt-3 pb-6 -mb-6 min-h-[400px] w-full max-w-full overflow-x-auto",
            // Прячем нативный горизонтальный скроллбар — управление
            // прокруткой через верхний жёлтый bar + правую кнопку.
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
            // Cursor'ом показываем режим pan (когда юзер держит ПКМ).
            panning && "cursor-grabbing select-none",
          )}
          title="Держите правую кнопку мыши и тяните — прокрутка колонок"
        >
          {stages.map((s) => (
            <KanbanColumn
              key={s.id}
              stage={s}
              deals={dealsByStage.get(s.id) ?? []}
              onOpenDeal={onOpenDeal}
              movingId={movingId}
              clientsById={clientsById}
              usersById={usersById}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <DealCard
              deal={activeDrag}
              isOverlay
              clientsById={clientsById}
              usersById={usersById}
              stageColor={
                stages.find((s) => s.id === activeDrag.stage_id)?.color
              }
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ============================================================================
// Kanban column
// ============================================================================

function KanbanColumn({
  stage,
  deals,
  onOpenDeal,
  movingId,
  clientsById,
  usersById,
}: {
  stage: DealStage
  deals: Deal[]
  onOpenDeal?: (id: number) => void
  movingId: number | null
  clientsById: Map<number, string>
  usersById: Map<number, string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}` })

  return (
    <div
      className={cn(
        "shrink-0 w-72 rounded-xl flex flex-col",
        // Рамка — тонкая (`border`), цветом стадии через inline style.
        // Тень — выразительная, чтобы колонка ощутимо «поднималась» над фоном.
        "border bg-gray-50/60 transition-all",
        "shadow-[0_6px_18px_rgba(0,0,0,0.10),0_2px_4px_rgba(0,0,0,0.06)]",
        isOver && "bg-brand-yellow/10 shadow-[0_12px_28px_rgba(250,204,21,0.30),0_4px_8px_rgba(250,204,21,0.20)]",
      )}
      style={{ borderColor: isOver ? "#facc15" : stage.color }}
    >
      {/* Header колонки — тонкая заливка цвета стадии для акцента.
          rounded учитывает тонкую рамку (`border` = 1px). */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 rounded-t-[calc(0.75rem-1px)]"
        style={{ backgroundColor: `${stage.color}14` }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
            {stage.type === "won" && (
              <Trophy className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            )}
            {stage.type === "lost" && <Ban className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          </div>
        </div>
        <span className="text-xs text-gray-500 tabular-nums">{deals.length}</span>
      </div>

      {/* Скроллящаяся зона с карточками. Отдельный ref от droppable —
          хочется чтобы drop-детект работал по всей колонке. */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]"
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">
              Перетащите сделку сюда
            </div>
          ) : (
            deals.map((d) => (
              <SortableDealCard
                key={d.id}
                deal={d}
                onOpen={onOpenDeal}
                loading={movingId === d.id}
                clientsById={clientsById}
                usersById={usersById}
                stageColor={stage.color}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

// ============================================================================
// Deal card
// ============================================================================

function SortableDealCard({
  deal,
  onOpen,
  loading,
  clientsById,
  usersById,
  stageColor,
}: {
  deal: Deal
  onOpen?: (id: number) => void
  loading?: boolean
  clientsById: Map<number, string>
  usersById: Map<number, string>
  stageColor?: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard
        deal={deal}
        onOpen={onOpen}
        loading={loading}
        clientsById={clientsById}
        usersById={usersById}
        stageColor={stageColor}
      />
    </div>
  )
}

function DealCard({
  deal,
  onOpen,
  loading,
  isOverlay,
  clientsById,
  usersById,
  stageColor,
}: {
  deal: Deal
  onOpen?: (id: number) => void
  loading?: boolean
  isOverlay?: boolean
  clientsById: Map<number, string>
  usersById: Map<number, string>
  stageColor?: string
}) {
  const amount = deal.amount != null ? formatAmount(deal.amount, deal.currency) : "—"
  const clientName =
    (deal.client_id != null && clientsById.get(deal.client_id)) || "—"
  const responsibleName =
    (deal.responsible_user_id != null && usersById.get(deal.responsible_user_id)) ||
    "—"
  const created = formatDate(deal.created_at)
  const closing = deal.expected_close_at
    ? formatClosingInfo(deal.expected_close_at)
    : null

  return (
    <Card
      className={cn(
        // border-2 + inline style borderColor окрашивает всю рамку в цвет
        // стадии. При отсутствии stageColor (fallback) — обычный серый.
        "rounded-lg border-2 bg-white",
        "transition-all duration-150 ease-out cursor-grab active:cursor-grabbing",
        !isOverlay && "hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)] hover:-translate-y-[1px]",
        isOverlay && "shadow-[0_10px_25px_rgba(0,0,0,0.15)] rotate-1",
        loading && "opacity-70",
      )}
      style={stageColor ? { borderColor: stageColor } : undefined}
      onClick={(e) => {
        // Клик по карточке (не drag) — открывает детали. dnd-kit при
        // маленьком движении не считает клик за drag.
        if (isOverlay) return
        if (onOpen) {
          e.stopPropagation()
          onOpen(deal.id)
        }
      }}
    >
      <div className="p-2.5 space-y-2">
        {/* Название + priority marker */}
        <div className="flex items-start gap-1.5">
          {deal.priority === "high" && (
            <Circle className="h-2 w-2 mt-1 fill-red-500 text-red-500 shrink-0" />
          )}
          <h4 className="text-sm font-medium line-clamp-2 flex-1">{deal.name}</h4>
          {deal.source_ref_type && (
            <span
              className="text-[10px] uppercase tracking-wider text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded shrink-0 max-w-[120px] truncate"
              title={
                deal.source_name
                  ? `Источник: ${deal.source_name}`
                  : `Из источника: ${deal.source_ref_type}`
              }
            >
              {deal.source_name || "ingest"}
            </span>
          )}
        </div>

        {/* Поля-метки. `grid-cols-[auto_1fr]` держит колонки-лейблы
            выровненными по ширине самого длинного лейбла. */}
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
          <span className="text-gray-500">Дата:</span>
          <span className="text-gray-800 tabular-nums truncate">{created}</span>

          <span className="text-gray-500">Клиент:</span>
          <span className="text-gray-800 truncate" title={clientName}>
            {clientName}
          </span>

          <span className="text-gray-500">Отв.:</span>
          <span className="text-gray-800 truncate" title={responsibleName}>
            {responsibleName}
          </span>

          <span className="text-gray-500">Сумма:</span>
          <span className="text-gray-800 font-semibold tabular-nums truncate">
            {amount}
          </span>

          {closing && (
            <>
              <span className="text-gray-500">Закрытие:</span>
              <span className="text-gray-800 tabular-nums truncate">
                {closing.date}
              </span>
              {/* Подсказка на отдельной строке без отступа лейблов
                  (col-span-2), чтобы длинные фразы «просрочено на 12
                  дней» не резались троеточием. */}
              <span className={cn("col-span-2 truncate", closing.hintClass)}>
                {closing.hint}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

/**
 * Форматирует «ожидаемую дату закрытия» в компактный текст с датой и
 * подсказкой сколько осталось или на сколько просрочено.
 *
 *   через 3 дня          — до дня закрытия
 *   сегодня              — тот же календарный день
 *   просрочено на 2 дня  — прошло N дней после
 *
 * Сравниваем по календарным дням, не по абсолютному времени.
 */
function formatClosingInfo(iso: string): {
  date: string
  hint: string
  hintClass: string
} | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })

  const today = new Date()
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((b - a) / (24 * 60 * 60 * 1000))

  let hint: string
  let hintClass: string
  if (diffDays > 0) {
    hint = `Осталось: ${plural(diffDays, "день", "дня", "дней")}`
    // При ≤3 дней подкрашиваем оранжевым чтобы бросалось в глаза, что
    // сделка на подходе; в остальном — зелёным, как «всё в норме».
    hintClass = diffDays <= 3
      ? "text-orange-600 font-medium"
      : "text-emerald-600 font-medium"
  } else if (diffDays === 0) {
    hint = "Сегодня"
    hintClass = "text-orange-600 font-medium"
  } else {
    hint = `Просрочено: на ${plural(-diffDays, "день", "дня", "дней")}`
    hintClass = "text-red-600 font-medium"
  }
  return { date, hint, hintClass }
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  let word: string
  if (mod10 === 1 && mod100 !== 11) word = one
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = few
  else word = many
  return `${n} ${word}`
}

function formatDate(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// ============================================================================
// TopScrollbar — тонкая кастомная скроллбар-полоска над Kanban
// ============================================================================

/**
 * Синхронизирует свой thumb с scrollLeft внешнего контейнера
 * (`targetRef`). Поддерживает две стороны:
 *  - target скроллится (через wheel/pan/keyboard) → thumb двигается
 *  - юзер хватает thumb и тянет → target.scrollLeft обновляется
 *
 * ResizeObserver'ом следим за изменением размеров target'а (при смене
 * воронки колонки могут появиться/уйти) — пересчитываем размер thumb'а.
 */
function TopScrollbar({
  targetRef,
  deps = [],
}: {
  targetRef: React.RefObject<HTMLDivElement>
  /** Значения, при изменении которых `scrollWidth` мог поменяться
   *  (например, набор колонок). ResizeObserver ловит только изменения
   *  размеров сЕмОгО target'а, но не его scrollWidth от добавления детей. */
  deps?: any[]
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumbWidth, setThumbWidth] = useState(0)
  const [thumbLeft, setThumbLeft] = useState(0)
  const [visible, setVisible] = useState(false)

  const measure = useCallback(() => {
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const { scrollWidth, clientWidth, scrollLeft } = el
    // Порог 8px чтобы не мигать при sub-pixel-отличиях (padding/border).
    if (scrollWidth <= clientWidth + 8) {
      setVisible(false)
      return
    }
    setVisible(true)
    const trackWidth = track.clientWidth
    // Ширина thumb'а пропорциональна видимой доле, но не меньше 40px
    // чтобы всегда было за что схватить.
    const rawThumbWidth = (clientWidth / scrollWidth) * trackWidth
    const w = Math.max(40, rawThumbWidth)
    const maxScroll = scrollWidth - clientWidth
    const left = maxScroll > 0 ? (scrollLeft / maxScroll) * (trackWidth - w) : 0
    setThumbWidth(w)
    setThumbLeft(left)
  }, [targetRef])

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    measure()
    el.addEventListener("scroll", measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener("resize", measure)
    return () => {
      el.removeEventListener("scroll", measure)
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [targetRef, measure])

  // Пересчёт при внешних deps'ах (смена воронки, добавление сделок и т.п.).
  // ResizeObserver не ловит изменение scrollWidth от добавления/удаления
  // детей, а window resize здесь не при чём — контейнер того же размера.
  useEffect(() => {
    // Небольшая задержка: даём DOM применить новые размеры после ре-рендера,
    // потом меряем.
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // только левая
    e.preventDefault()
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const startX = e.clientX
    const startScroll = el.scrollLeft
    const maxScroll = el.scrollWidth - el.clientWidth
    const trackWidth = track.clientWidth
    // scroll(px) per drag(px) — коэффициент.
    const ratio = maxScroll > 0 ? maxScroll / (trackWidth - thumbWidth) : 0

    const onMove = (ev: MouseEvent) => {
      el.scrollLeft = startScroll + (ev.clientX - startX) * ratio
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  // Клик по пустой части трека — «страничная» прокрутка в ту сторону.
  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return // если по thumb'у — уже обработано
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const rect = track.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const dir = clickX < thumbLeft + thumbWidth / 2 ? -1 : 1
    el.scrollBy({
      left: dir * el.clientWidth * 0.9,
      behavior: "smooth",
    })
  }

  return (
    <div
      ref={trackRef}
      onMouseDown={handleTrackMouseDown}
      className={cn(
        "relative w-full h-2 rounded-full bg-gray-100/80 mb-1.5",
        "transition-opacity",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <div
        onMouseDown={handleThumbMouseDown}
        className={cn(
          "absolute top-0 h-full rounded-full bg-brand-yellow",
          "cursor-grab active:cursor-grabbing",
          "hover:bg-yellow-500 transition-colors",
          "shadow-[0_1px_3px_rgba(250,204,21,0.35)]",
        )}
        style={{
          width: `${thumbWidth}px`,
          transform: `translateX(${thumbLeft}px)`,
        }}
      />
    </div>
  )
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ru-KZ", {
      style: "currency",
      currency: currency || "KZT",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}
