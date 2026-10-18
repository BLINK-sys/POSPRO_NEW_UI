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
import { useAuth } from "@/context/auth-context"
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
  const { user } = useAuth()
  // Настройка воронок доступна только владельцу и юзерам с флагом
  // can_manage_pipelines. Остальным кнопку скрываем.
  const canManagePipelines = Boolean(
    user && (user.is_owner || user.can_manage_pipelines),
  )

  const [pipelines, setPipelines] = useState<DealPipeline[]>([])
  const [activePipelineId, setActivePipelineId] = useState<number | null>(null)
  // Пагинация per-stage: по 10 карточек в колонке, остальные подгружаем
  // по кнопке «Загрузить ещё». Храним Map stageId → {deals, total}.
  // Так же обеспечиваем независимый счётчик total у каждой колонки,
  // чтобы в заголовке колонки было видно сколько сделок всего, а в теле
  // — сколько уже отрисовано.
  const [stageData, setStageData] = useState<
    Map<number, { deals: Deal[]; total: number }>
  >(new Map())
  // Какая колонка сейчас грузит очередную порцию — для спиннера на кнопке
  // «Загрузить ещё». null = ни одна не грузит.
  const [loadingMoreStageId, setLoadingMoreStageId] = useState<number | null>(null)
  const [clientsById, setClientsById] = useState<Map<number, string>>(new Map())
  const [usersById, setUsersById] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [activeDrag, setActiveDrag] = useState<Deal | null>(null)

  const DEALS_PAGE_SIZE = 10

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

  // 2) Загрузка сделок при смене активной воронки — параллельно по
  //    всем стадиям, по DEALS_PAGE_SIZE на каждую. Если в стадии больше —
  //    юзер жмёт «Загрузить ещё 10» внутри колонки.
  //
  //    Делаем именно N запросов (а не один общий с limit=200) — иначе
  //    в большой базе 29k сделок первые 200 могут все оказаться в одной
  //    стадии, и остальные колонки будут пусты.
  useEffect(() => {
    if (activePipelineId == null) return
    const pipeline = pipelines.find((p) => p.id === activePipelineId)
    if (!pipeline || !pipeline.stages) return

    let ignore = false
    const results = pipeline.stages.map((s) =>
      crmGet<DealsListResponse>(
        `/api/admin/deals?pipeline_id=${activePipelineId}&stage_id=${s.id}&limit=${DEALS_PAGE_SIZE}&offset=0`,
      )
        .then((res) => ({ stageId: s.id, deals: res.deals || [], total: res.total || 0 }))
        .catch((e) => {
          console.error(`load deals (stage ${s.id}):`, e)
          return { stageId: s.id, deals: [] as Deal[], total: 0 }
        }),
    )

    Promise.all(results).then((rows) => {
      if (ignore) return
      const next = new Map<number, { deals: Deal[]; total: number }>()
      for (const r of rows) {
        next.set(r.stageId, { deals: r.deals, total: r.total })
      }
      setStageData(next)
    })

    return () => {
      ignore = true
    }
  }, [activePipelineId, pipelines])

  /** Догружает следующую порцию сделок конкретной стадии. */
  const loadMoreForStage = useCallback(
    async (stageId: number) => {
      if (activePipelineId == null) return
      const row = stageData.get(stageId)
      if (!row) return
      if (row.deals.length >= row.total) return

      setLoadingMoreStageId(stageId)
      try {
        const res = await crmGet<DealsListResponse>(
          `/api/admin/deals?pipeline_id=${activePipelineId}&stage_id=${stageId}&limit=${DEALS_PAGE_SIZE}&offset=${row.deals.length}`,
        )
        setStageData((prev) => {
          const next = new Map(prev)
          const existing = next.get(stageId)
          if (!existing) return prev
          // Dedup по id — если drag&drop успел перенести карточку в
          // эту же колонку с другого места, не хотим её удвоить.
          const seen = new Set(existing.deals.map((d) => d.id))
          const added = (res.deals || []).filter((d) => !seen.has(d.id))
          next.set(stageId, {
            deals: [...existing.deals, ...added],
            total: res.total || existing.total,
          })
          return next
        })
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить ещё",
          description: e?.message,
        })
      } finally {
        setLoadingMoreStageId(null)
      }
    },
    [activePipelineId, stageData, toast],
  )

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) ?? null,
    [pipelines, activePipelineId],
  )
  const stages = useMemo<DealStage[]>(
    () => [...(activePipeline?.stages ?? [])]
      // Скрываем стадии с is_active=false — они используются только для
      // хранения исторических сделок (видны в карточке/истории).
      .filter((s) => (s as any).is_active !== false)
      .sort((a, b) => a.order - b.order),
    [activePipeline],
  )

  // Сортируем сделки каждой стадии по updated_at DESC. Данные уже
  // приходят с бэка в этом порядке (ORDER BY updated_at DESC), но после
  // drag&drop между колонками мы вставляем сделку локально — пересортировка
  // гарантирует стабильный порядок независимо от истории операций.
  const dealsByStage = useMemo(() => {
    const map = new Map<number, Deal[]>()
    for (const s of stages) {
      const row = stageData.get(s.id)
      const list = row ? [...row.deals] : []
      list.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
      map.set(s.id, list)
    }
    return map
  }, [stageData, stages])

  // Всего сделок в воронке — сумма total'ов по стадиям (не длина
  // загруженного — тот показывает только видимое).
  const totalInPipeline = useMemo(() => {
    let sum = 0
    for (const s of stages) sum += stageData.get(s.id)?.total ?? 0
    return sum
  }, [stageData, stages])

  // Все сделки (для drag&drop lookups + DragOverlay). dnd-kit работает по id,
  // ему достаточно уже загруженных карточек.
  const allLoadedDeals = useMemo(() => {
    const flat: Deal[] = []
    for (const row of stageData.values()) flat.push(...row.deals)
    return flat
  }, [stageData])

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
      const d = allLoadedDeals.find((x) => x.id === dealId)
      return d?.stage_id
    },
    [allLoadedDeals],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id)
    setActiveDrag(allLoadedDeals.find((d) => d.id === id) ?? null)
  }

  /**
   * Переносит сделку между Map-колонками. Обновляет total:
   *   у `from` — минус 1, у `to` — плюс 1 (вне зависимости от того,
   *   что `toTotal` может быть `undefined` — тогда 1).
   */
  const moveDealLocally = useCallback(
    (dealId: number, from: number, to: number, replacement?: Deal) => {
      setStageData((prev) => {
        const next = new Map(prev)
        const fromRow = next.get(from)
        const toRow = next.get(to)
        if (!fromRow) return prev

        const idx = fromRow.deals.findIndex((d) => d.id === dealId)
        if (idx < 0) return prev
        const movedBase = fromRow.deals[idx]
        const moved: Deal = replacement
          ? replacement
          : { ...movedBase, stage_id: to }

        next.set(from, {
          deals: fromRow.deals.filter((d) => d.id !== dealId),
          total: Math.max(0, fromRow.total - 1),
        })
        next.set(to, {
          deals: toRow ? [moved, ...toRow.deals] : [moved],
          total: (toRow?.total ?? 0) + 1,
        })
        return next
      })
    },
    [],
  )

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
      const targetDeal = allLoadedDeals.find((d) => d.id === Number(overId))
      if (targetDeal) toStageId = targetDeal.stage_id
    }
    if (toStageId == null || toStageId === from) return

    // Оптимистично переносим между колонками (меняет total в обеих).
    moveDealLocally(dealId, from, toStageId)
    setMovingId(dealId)

    try {
      const res = await crmPost<{ success: boolean; deal: Deal }>(
        `/api/admin/deals/${dealId}/move`,
        { stage_id: toStageId },
      )
      // Заменяем на серверную версию (там мог измениться status на won/lost + updated_at).
      setStageData((prev) => {
        const next = new Map(prev)
        const row = next.get(toStageId!)
        if (!row) return prev
        next.set(toStageId!, {
          deals: row.deals.map((d) => (d.id === dealId ? res.deal : d)),
          total: row.total,
        })
        return next
      })
    } catch (e: any) {
      // Откатываем — ставим обратно.
      moveDealLocally(dealId, toStageId, from)
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
            {canManagePipelines
              ? "Настройте воронки и стадии в разделе управления сделками"
              : "Обратитесь к владельцу системы — только он может настроить воронки"}
          </p>
        </div>
        {canManagePipelines && (
          <Button asChild variant="outline">
            <Link href="/admin/deals/pipelines">Настройка воронок</Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    // min-w-0 нужен чтобы flex-child (наш root) не растягивался под ширину
    // содержимого — иначе `overflow-x-auto` ниже не сработает и вся
    // страница уедет вправо когда стадий много.
    // `-mr-4 md:-mr-6` «съедает» правый padding админ-layout (`p-4 md:p-6`),
    // чтобы доска доходила до самого края экрана — по просьбе юзера.
    <div className="space-y-4 w-full min-w-0 -mr-4 md:-mr-6">
      {/* Шапка страницы */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Сделки</h1>
            <p className="text-sm text-gray-500">Всего в воронке: {totalInPipeline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManagePipelines && (
            <>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href="/admin/deals/pipelines">Настройка воронок</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href="/admin/deals/sources">Источники</Link>
              </Button>
            </>
          )}
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

      {/* Выпадающий список воронок. Было табами — упиралось в ширину экрана
          когда у юзера много воронок. Dropdown компактнее и держит сколько
          угодно. Если воронка одна — показываем просто её имя без селекта. */}
      {pipelines.length > 1 ? (
        <div className="w-64">
          <Select
            value={activePipelineId != null ? String(activePipelineId) : ""}
            onValueChange={(v) => setActivePipelineId(Number(v))}
          >
            <SelectTrigger className="w-full bg-white border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] rounded-lg font-semibold">
              <SelectValue placeholder="Выберите воронку" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                  {!p.active && (
                    <span className="ml-1.5 text-xs text-gray-400">(выкл.)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : pipelines.length === 1 ? (
        <div className="text-sm font-semibold text-gray-700">
          {pipelines[0].name}
          {!pipelines[0].active && (
            <span className="ml-1.5 text-xs text-gray-400">(выкл.)</span>
          )}
        </div>
      ) : null}

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
          deps={[stages.length, allLoadedDeals.length, activePipelineId]}
        />

        <div
          ref={boardScrollRef}
          onMouseDown={handleBoardMouseDown}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            // Фиксированная высота = окно минус шапка/контролы (~260px).
            // Внутри каждая колонка `h-full` → у неё bounded height →
            // внутренняя зона с карточками скроллится независимо.
            // `overflow-x-auto` неявно клипит и по y — отрицательные
            // margin'ы компенсируют запас под тень колонок.
            "flex gap-3 pt-3 -mt-3 pb-6 -mb-6 w-full max-w-full overflow-x-auto",
            // Высота = окно - шапка/контролы (~180px). Колонки доходят
            // почти до нижнего края viewport'а, с небольшим воздухом.
            "h-[calc(100dvh-180px)] min-h-[400px]",
            // Прячем нативный горизонтальный скроллбар — управление
            // прокруткой через верхний жёлтый bar + правую кнопку.
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
            // Cursor'ом показываем режим pan (когда юзер держит ПКМ).
            panning && "cursor-grabbing select-none",
          )}
          title="Держите правую кнопку мыши и тяните — прокрутка колонок"
        >
          {stages.map((s) => {
            const row = stageData.get(s.id)
            const deals = dealsByStage.get(s.id) ?? []
            const total = row?.total ?? 0
            return (
              <KanbanColumn
                key={s.id}
                stage={s}
                deals={deals}
                total={total}
                onLoadMore={() => loadMoreForStage(s.id)}
                loadingMore={loadingMoreStageId === s.id}
                onOpenDeal={onOpenDeal}
                movingId={movingId}
                clientsById={clientsById}
                usersById={usersById}
              />
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (() => {
            const st = stages.find((s) => s.id === activeDrag.stage_id)
            return (
              <DealCard
                deal={activeDrag}
                isOverlay
                clientsById={clientsById}
                usersById={usersById}
                stageColor={st?.color}
                stageType={st?.type}
              />
            )
          })() : null}
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
  total,
  onLoadMore,
  loadingMore,
  onOpenDeal,
  movingId,
  clientsById,
  usersById,
}: {
  stage: DealStage
  deals: Deal[]
  total: number
  onLoadMore: () => void
  loadingMore: boolean
  onOpenDeal?: (id: number) => void
  movingId: number | null
  clientsById: Map<number, string>
  usersById: Map<number, string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}` })
  const canLoadMore = deals.length < total

  return (
    <div
      className={cn(
        // w-60 = 240px — уже чем раньше (288), ближе к Б24-style колонкам.
        // `h-full` → наследует bounded height доски → внутренний overflow
        // работает независимо для каждой колонки.
        "shrink-0 w-60 h-full rounded-xl flex flex-col",
        // Рамка — тонкая (`border`), цветом стадии через inline style.
        "border bg-gray-50/60 transition-all",
        "shadow-[0_6px_18px_rgba(0,0,0,0.10),0_2px_4px_rgba(0,0,0,0.06)]",
        isOver && "bg-brand-yellow/10 shadow-[0_12px_28px_rgba(250,204,21,0.30),0_4px_8px_rgba(250,204,21,0.20)]",
      )}
      style={{ borderColor: isOver ? "#facc15" : stage.color }}
    >
      {/* Header колонки — тонкая заливка цвета стадии для акцента.
          rounded учитывает тонкую рамку (`border` = 1px). Показываем
          «загружено/всего» — иначе юзер не поймёт, что скрыто. */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 rounded-t-[calc(0.75rem-1px)]"
        style={{ backgroundColor: `${stage.color}14` }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3
              className="text-sm font-semibold leading-tight break-words line-clamp-2"
              title={stage.name}
            >
              {stage.name}
            </h3>
            {stage.type === "won" && (
              <Trophy className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {stage.type === "lost" && (
              <Ban className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
            )}
          </div>
        </div>
        <span
          className="text-xs text-gray-500 tabular-nums"
          title={canLoadMore ? `Показано ${deals.length} из ${total}` : `Всего ${total}`}
        >
          {canLoadMore ? `${deals.length}/${total}` : total}
        </span>
      </div>

      {/* Скроллящаяся зона с карточками. Отдельный ref от droppable —
          хочется чтобы drop-детект работал по всей колонке. Независимый
          overflow-y: родительская доска имеет фикс.высоту → `flex-1` + и
          overflow-y-auto = свой скролл в каждой колонке. */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto"
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
                stageType={stage.type}
              />
            ))
          )}

          {canLoadMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full h-8 rounded-lg text-xs mt-1 bg-white hover:bg-gray-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Загружаю…
                </>
              ) : (
                <>Загрузить ещё {Math.min(10, total - deals.length)}</>
              )}
            </Button>
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
  stageType,
}: {
  deal: Deal
  onOpen?: (id: number) => void
  loading?: boolean
  clientsById: Map<number, string>
  usersById: Map<number, string>
  stageColor?: string
  stageType?: string
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
        stageType={stageType}
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
  stageType,
}: {
  deal: Deal
  onOpen?: (id: number) => void
  loading?: boolean
  isOverlay?: boolean
  clientsById: Map<number, string>
  usersById: Map<number, string>
  stageColor?: string
  stageType?: string
}) {
  const isWon = stageType === "won"
  const isLost = stageType === "lost"
  const isFinal = isWon || isLost
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
  // «Источник»: приоритет — ручной выбор (deal_source), затем автомат из
  // ingest (source_name). Если нет ни того, ни другого — поле не рендерим.
  const sourceLabel =
    deal.deal_source?.name || deal.source_name || null

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
      <div className="p-2 space-y-2">
        {/* Название сделки — зачёркиваем для карточек в финальных
            стадиях (won/lost). Это Б24-поведение: завершённая сделка
            отображается как «закрытое дело», визуально отличимое от
            активных. */}
        <div className="flex items-start gap-1.5">
          {deal.priority === "high" && !isFinal && (
            <Circle className="h-2 w-2 mt-1 fill-red-500 text-red-500 shrink-0" />
          )}
          {isWon && (
            <Trophy className="h-3 w-3 mt-0.5 text-emerald-600 shrink-0" />
          )}
          {isLost && (
            <Ban className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />
          )}
          <h4 className={cn(
            "text-[13px] font-semibold leading-tight line-clamp-2 flex-1",
            isFinal && "line-through",
            isWon && "text-emerald-700",
            isLost && "text-gray-400",
          )}>
            {deal.name}
          </h4>
        </div>

        {/* Поля — каждое двумя строками: лейбл сверху, значение снизу. */}
        <div className="space-y-1.5">
          <Field label="Сумма">
            <span className="font-semibold tabular-nums text-gray-900">{amount}</span>
          </Field>

          {deal.client_id != null && (
            <Field label="Клиент">
              <span className="truncate" title={clientName}>{clientName}</span>
            </Field>
          )}

          {deal.responsible_user_id != null && (
            <Field label="Ответственный">
              <span className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-full bg-brand-yellow/60 text-[9px] font-semibold flex items-center justify-center shrink-0 text-black">
                  {(responsibleName[0] || "?").toUpperCase()}
                </span>
                <span className="truncate" title={responsibleName}>
                  {responsibleName}
                </span>
              </span>
            </Field>
          )}

          {sourceLabel && (
            <Field label="Источник">
              <span className="truncate" title={sourceLabel}>{sourceLabel}</span>
            </Field>
          )}
        </div>

        {/* Нижняя строка: относительная дата создания + подсказка просрочки. */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-gray-100">
          <span className="tabular-nums pt-1">
            {formatRelative(deal.created_at) || created}
          </span>
          {closing && (
            <span className={cn("tabular-nums pt-1", closing.hintClass)}>
              {closing.hint}
            </span>
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

/**
 * Поле карточки сделки: лейбл сверху мелким серым, значение снизу.
 * Используется в DealCard для компактной выдачи «Сумма / Клиент /
 * Ответственный / Источник». Лейбл не truncate'ится, значение — да.
 */
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 leading-tight">
        {label}
      </div>
      <div className="text-[12px] text-gray-800 leading-snug truncate">
        {children}
      </div>
    </div>
  )
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

/**
 * Короткая относительная дата для карточки канбана: «только что»,
 * «17 минут назад», «3 часа назад», «вчера», «3 дня назад», иначе —
 * обычная дата «15.10.2026». Для старых дат (>7 дней) всегда дата.
 */
function formatRelative(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return formatDate(iso)
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return "только что"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} ${pluralRu(min, "минуту", "минуты", "минут")} назад`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${pluralRu(hr, "час", "часа", "часов")} назад`
  const dys = Math.floor(hr / 24)
  if (dys === 1) return "вчера"
  if (dys < 7) return `${dys} ${pluralRu(dys, "день", "дня", "дней")} назад`
  return formatDate(iso)
}

/** Склонение числительных для русского (1 минута / 2 минуты / 5 минут). */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
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
