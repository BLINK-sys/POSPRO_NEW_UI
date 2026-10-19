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
import { Loader2, Plus, Briefcase, Circle, Trophy, Ban, TrendingUp, Maximize2, Minimize2 } from "lucide-react"
import { createPortal } from "react-dom"
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
import DealsFilters, { useDealsFilters, filtersToQuery } from "./deals-filters"
import DealsTabsHeader from "./deals-tabs-header"
import DealMoveSurveyDialog from "./deal-move-survey-dialog"

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

interface CompanyLite {
  id: number
  name: string
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
  const [clients, setClients] = useState<KpClientLite[]>([])
  const [companies, setCompanies] = useState<CompanyLite[]>([])
  const [users, setUsers] = useState<SystemUserLite[]>([])
  const [clientsById, setClientsById] = useState<Map<number, string>>(new Map())
  const [usersById, setUsersById] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [activeDrag, setActiveDrag] = useState<Deal | null>(null)
  // Модалка опросника при move_deal когда бэк вернул missing_codes.
  const [kanbanSurvey, setKanbanSurvey] = useState<{
    dealId: number
    fromStageId: number
    toStageId: number
    stageName?: string
    missing: string[]
  } | null>(null)

  // Фильтры канбана (период / клиент / компания / ответственный),
  // сохраняются per-user в /api/user-prefs/deals_canvas.
  const { filters, setFilters, loaded: filtersLoaded } = useDealsFilters()

  // Статистика по текущей выборке (воронка + фильтры): open/won/lost.
  const [stats, setStats] = useState<{ sum_open: number; sum_won: number; sum_lost: number }>({
    sum_open: 0, sum_won: 0, sum_lost: 0,
  })

  // Fullscreen режим: канбан на всю страницу. Сохраняем в localStorage,
  // чтобы при возврате со страницы сделки состояние осталось то же.
  const [isFullscreen, setIsFullscreen] = useState(false)
  // SSR safety: `createPortal(..., document.body)` требует браузер.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    try {
      if (localStorage.getItem("deals_canvas_fullscreen") === "1") {
        setIsFullscreen(true)
      }
    } catch {
      /* localStorage недоступен — ok, остаёмся свёрнутыми */
    }
  }, [])
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => {
      const next = !v
      try {
        localStorage.setItem("deals_canvas_fullscreen", next ? "1" : "0")
      } catch { /* noop */ }
      return next
    })
  }, [])

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
    const loadClients = crmGet<{ clients: KpClientLite[] }>("/api/kp-clients?limit=500").catch(
      () => ({ clients: [] as KpClientLite[] }),
    )
    const loadCompanies = crmGet<{ companies: CompanyLite[] }>(
      "/api/admin/kp-companies?limit=500",
    ).catch(() => ({ companies: [] as CompanyLite[] }))
    // Flask отдаёт system-users плоским массивом.
    const loadUsers = crmGet<SystemUserLite[] | { users: SystemUserLite[] }>(
      "/api/system-users",
    ).catch(() => [] as SystemUserLite[])

    Promise.all([loadPipelines, loadClients, loadCompanies, loadUsers])
      .then(([p, c, co, u]) => {
        if (ignore) return
        const list = p.pipelines || []
        setPipelines(list)
        const first = list.find((x) => x.active) ?? list[0]
        if (first) setActivePipelineId(first.id)
        const cs = c.clients || []
        setClients(cs)
        setClientsById(new Map(cs.map((x) => [x.id, x.display_name])))
        setCompanies(co.companies || [])
        const us = Array.isArray(u) ? u : u.users || []
        setUsers(us)
        setUsersById(new Map(us.map((x) => [x.id, x.full_name || x.email])))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [toast])

  // 2) Загрузка сделок при смене активной воронки или фильтров —
  //    параллельно по всем стадиям, по DEALS_PAGE_SIZE на каждую + с
  //    применёнными фильтрами (период, клиент, компания, ответственный).
  useEffect(() => {
    if (activePipelineId == null) return
    if (!filtersLoaded) return  // ждём загрузку prefs чтобы не делать 2 запроса
    const pipeline = pipelines.find((p) => p.id === activePipelineId)
    if (!pipeline || !pipeline.stages) return

    let ignore = false
    const base = filtersToQuery(filters)
    const results = pipeline.stages.map((s) => {
      const p = new URLSearchParams(base)
      p.set("pipeline_id", String(activePipelineId))
      p.set("stage_id", String(s.id))
      p.set("limit", String(DEALS_PAGE_SIZE))
      p.set("offset", "0")
      return crmGet<DealsListResponse>(`/api/admin/deals?${p.toString()}`)
        .then((res) => ({ stageId: s.id, deals: res.deals || [], total: res.total || 0 }))
        .catch((e) => {
          console.error(`load deals (stage ${s.id}):`, e)
          return { stageId: s.id, deals: [] as Deal[], total: 0 }
        })
    })

    Promise.all(results).then((rows) => {
      if (ignore) return
      const next = new Map<number, { deals: Deal[]; total: number }>()
      for (const r of rows) {
        next.set(r.stageId, { deals: r.deals, total: r.total })
      }
      setStageData(next)
    })

    // Параллельно подгружаем суммы (open/won/lost) с теми же фильтрами +
    // фиксированной текущей воронкой.
    const statsQuery = new URLSearchParams(base)
    statsQuery.set("pipeline_id", String(activePipelineId))
    crmGet<any>(`/api/admin/deals/stats?${statsQuery.toString()}`)
      .then((r) => {
        if (ignore) return
        setStats({
          sum_open: r.sum_open || 0,
          sum_won: r.sum_won || 0,
          sum_lost: r.sum_lost || 0,
        })
      })
      .catch(() => setStats({ sum_open: 0, sum_won: 0, sum_lost: 0 }))

    return () => {
      ignore = true
    }
  }, [activePipelineId, pipelines, filters, filtersLoaded])

  /** Догружает следующую порцию сделок конкретной стадии. */
  const loadMoreForStage = useCallback(
    async (stageId: number) => {
      if (activePipelineId == null) return
      const row = stageData.get(stageId)
      if (!row) return
      if (row.deals.length >= row.total) return

      setLoadingMoreStageId(stageId)
      try {
        const p = new URLSearchParams(filtersToQuery(filters))
        p.set("pipeline_id", String(activePipelineId))
        p.set("stage_id", String(stageId))
        p.set("limit", String(DEALS_PAGE_SIZE))
        p.set("offset", String(row.deals.length))
        const res = await crmGet<DealsListResponse>(
          `/api/admin/deals?${p.toString()}`,
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
    [activePipelineId, stageData, filters, toast],
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

    await _attemptKanbanMove(dealId, from, toStageId)
    setMovingId(null)
  }

  // Отдельная функция чтобы можно было переиспользовать после заполнения
  // опросника (повторный move с survey_values). Делает всё, кроме
  // оптимистичного визуального перемещения — его надо сделать ДО, если это
  // первый вызов (из handleDragEnd), а повторный вызов уже на нужной
  // стадии стоит.
  const _attemptKanbanMove = async (
    dealId: number,
    from: number,
    toStageId: number,
    surveyValues?: Record<string, number>,
  ): Promise<boolean> => {
    try {
      const body: Record<string, any> = { stage_id: toStageId }
      if (surveyValues && Object.keys(surveyValues).length)
        body.survey_values = surveyValues
      const res = await crmPost<{ success: boolean; deal: Deal }>(
        `/api/admin/deals/${dealId}/move`,
        body,
      )
      setStageData((prev) => {
        const next = new Map(prev)
        const row = next.get(toStageId)
        if (!row) return prev
        next.set(toStageId, {
          deals: row.deals.map((d) => (d.id === dealId ? res.deal : d)),
          total: row.total,
        })
        return next
      })
      setKanbanSurvey(null)
      return true
    } catch (e: any) {
      const payload = e?.payload
      if (
        e?.status === 400 &&
        Array.isArray(payload?.missing_codes) &&
        payload.missing_codes.length > 0
      ) {
        const st = stages.find((s) => s.id === toStageId)
        setKanbanSurvey({
          dealId,
          fromStageId: from,
          toStageId,
          stageName: st?.name,
          missing: payload.missing_codes,
        })
        return false
      }
      moveDealLocally(dealId, toStageId, from)
      toast({
        variant: "destructive",
        title: "Не удалось переместить",
        description: e?.message,
      })
      return false
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

  // Кнопка «на весь экран / свернуть» — передаём как rightAction в
  // DealsFilters, чтобы она стояла справа в панели фильтров.
  const fullscreenButton = (
    <button
      type="button"
      onClick={toggleFullscreen}
      className="h-7 inline-flex items-center gap-1.5 px-2 rounded-md border border-gray-200 bg-white text-xs text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors"
      title={isFullscreen ? "Свернуть" : "Развернуть на весь экран"}
    >
      {isFullscreen ? (
        <>
          <Minimize2 className="h-3.5 w-3.5" />
          <span>Свернуть</span>
        </>
      ) : (
        <>
          <Maximize2 className="h-3.5 w-3.5" />
          <span>На весь экран</span>
        </>
      )}
    </button>
  )

  // Контент «canvas»: статы + фильтры + сама kanban-доска. Рендерим его
  // либо inline (обычный режим), либо внутри Portal'а на весь экран.
  // Выделение в переменную гарантирует, что ВСЕ хуки/рефы/dnd-состояние
  // остаются общими — переключение режима ничего не теряет.
  //
  // В fullscreen:
  //   - статы компактные (в строку, высота как у селектора воронки)
  //   - канбан получает `flex-1 min-h-0`, parent — `flex flex-col` →
  //     высота самой доски занимает всё оставшееся место без скролла страницы
  const canvasContent = (
    <>
      {/* Строка: селектор воронки слева + 3 стат-плитки справа. */}
      <div className="flex items-stretch gap-3 flex-wrap">
        {pipelines.length > 1 ? (
          <div className="w-64 shrink-0 flex items-center">
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
          <div className="w-64 shrink-0 flex items-center text-sm font-semibold text-gray-700">
            {pipelines[0].name}
            {!pipelines[0].active && (
              <span className="ml-1.5 text-xs text-gray-400">(выкл.)</span>
            )}
          </div>
        ) : null}

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-w-[320px]">
          <KanbanStatCard label="Сумма открытых" value={stats.sum_open} iconColor="text-blue-600" compact={isFullscreen} />
          <KanbanStatCard label="Сумма выигранных" value={stats.sum_won} iconColor="text-emerald-600" compact={isFullscreen} />
          <KanbanStatCard label="Сумма проигранных" value={stats.sum_lost} iconColor="text-red-600" compact={isFullscreen} />
        </div>
      </div>

      {/* Фильтры канбана. Справа — кнопка fullscreen toggle. */}
      <DealsFilters
        value={filters}
        onChange={setFilters}
        clients={clients}
        companies={companies}
        users={users}
        canChooseResponsible={Boolean(user && (user.is_owner || user.can_see_all_deals))}
        rightAction={fullscreenButton}
      />

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <TopScrollbar
          targetRef={boardScrollRef}
          deps={[stages.length, allLoadedDeals.length, activePipelineId, isFullscreen]}
        />

        <div
          ref={boardScrollRef}
          onMouseDown={handleBoardMouseDown}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "flex gap-3 pt-3 -mt-3 pb-6 -mb-6 overflow-x-auto",
            // Fullscreen: parent — flex-col в Portal'е, канбан растягивается
            // через flex-1 на всё оставшееся место (без calc'ов).
            // Отрицательный mx = padding Portal'а → контейнер канбана
            // расширяется ровно до краёв экрана, карточки обрезаются
            // прямо у края. «Воздух» для первой/последней стадии даётся
            // через ml/mr на самих колонках (см. firstInRow/lastInRow ниже).
            // `w-full` здесь намеренно НЕ ставим — без явной ширины div
            // расширяется до `parent + |marginLeft| + |marginRight|`, иначе
            // отрицательный margin справа «съедал» бы правую колонку.
            // Inline: прежняя схема с явной шириной и calc'ом окна.
            isFullscreen
              ? "flex-1 min-h-0 -mx-3 md:-mx-4"
              : "w-full max-w-full h-[calc(100dvh-180px)] min-h-[400px]",
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
            panning && "cursor-grabbing select-none",
          )}
          title="Держите правую кнопку мыши и тяните — прокрутка колонок"
        >
          {stages.map((s, i) => {
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
                firstInRow={isFullscreen && i === 0}
                lastInRow={isFullscreen && i === stages.length - 1}
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
    </>
  )

  return (
    // min-w-0 нужен чтобы flex-child (наш root) не растягивался под ширину
    // содержимого — иначе `overflow-x-auto` ниже не сработает и вся
    // страница уедет вправо когда стадий много.
    // `-mr-4 md:-mr-6` «съедает» правый padding админ-layout (`p-4 md:p-6`),
    // чтобы доска доходила до самого края экрана — по просьбе юзера.
    <div className="space-y-4 w-full min-w-0 -mr-4 md:-mr-6">
      {/* Шапка страницы: иконка + заголовок + табы (История/Источники для
          owner/can_see_all_deals) + правый блок кнопок. */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Сделки</h1>
          <p className="text-sm text-gray-500">Всего в воронке: {totalInPipeline}</p>
        </div>
        <DealsTabsHeader />
        <div className="flex items-center gap-2 ml-auto">
          {canManagePipelines && (
            <>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href="/admin/deals/pipelines">Настройка воронок</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href="/admin/deals/sources">Справочники</Link>
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

      {/* В обычном режиме канбан отображается inline. В fullscreen —
          уходит в Portal на document.body (`fixed inset-0 z-50`). Между
          режимами переключается кнопкой «На весь экран» в панели
          фильтров. Состояние хранится в localStorage, поэтому возврат
          со страницы сделки сохраняет выбранный вид. */}
      {!isFullscreen && canvasContent}

      {mounted && isFullscreen && createPortal(
        // `flex-col + gap-2` → секции плотнее друг к другу (меньше воздуха);
        // `overflow-hidden` → страница не скроллится, канбан получает flex-1
        // и занимает ВСЁ оставшееся место ровно до низа viewport'а.
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden p-3 md:p-4 flex flex-col gap-2">
          {canvasContent}
        </div>,
        document.body,
      )}

      {kanbanSurvey && activePipelineId && (
        <DealMoveSurveyDialog
          open={true}
          pipelineId={activePipelineId}
          missingCodes={kanbanSurvey.missing}
          stageName={kanbanSurvey.stageName}
          onCancel={() => {
            // Откатываем визуальное перемещение.
            moveDealLocally(
              kanbanSurvey.dealId,
              kanbanSurvey.toStageId,
              kanbanSurvey.fromStageId,
            )
            setKanbanSurvey(null)
          }}
          onSubmit={async (vals) =>
            _attemptKanbanMove(
              kanbanSurvey.dealId,
              kanbanSurvey.fromStageId,
              kanbanSurvey.toStageId,
              vals,
            )
          }
        />
      )}
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
  firstInRow,
  lastInRow,
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
  /** В fullscreen — первая колонка в ряду: получает ml для «воздуха»
   *  от края экрана, иначе прижмётся к стенке скролла. */
  firstInRow?: boolean
  /** Аналогично для последней — mr. */
  lastInRow?: boolean
}) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: `stage-${stage.id}` })
  const canLoadMore = deals.length < total

  // Автоподгрузка: когда юзер доскроллил колонку до низа и кнопка
  // «Загрузить ещё» попала в viewport скроллящейся зоны — сами триггерим
  // onLoadMore. Используем IntersectionObserver с `root` = нашим внутренним
  // overflow-y контейнером (не окном). Для этого нужен прямой ref на этот
  // div — совмещаем с setNodeRef от useDroppable через callback-ref.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLButtonElement | null>(null)
  const setScrollAndDroppable = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el
      setDroppableRef(el)
    },
    [setDroppableRef],
  )

  useEffect(() => {
    if (!canLoadMore) return
    const root = scrollRef.current
    const target = loadMoreRef.current
    if (!root || !target) return

    const io = new IntersectionObserver(
      ([entry]) => {
        // Защита от повторных вызовов — внешний loadingMore может ещё не
        // успеть переключиться к моменту следующего пересечения.
        if (entry.isIntersecting && !loadingMore) {
          onLoadMore()
        }
      },
      { root, threshold: 0.1 },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [canLoadMore, loadingMore, onLoadMore])

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
        // overflow-hidden клипит содержимое по rounded-xl, иначе
        // scrollbar внутренней зоны вылезает в нижний-правый угол и
        // делает его квадратным.
        "overflow-hidden",
        // В fullscreen боковой padding Portal'а = 0, канбан-контейнер
        // с negative mx доходит до края экрана. «Воздух» для крайних
        // стадий даётся здесь — чтобы остальные колонки могли обрезаться
        // прямо у края при скролле.
        firstInRow && "ml-3 md:ml-4",
        lastInRow && "mr-3 md:mr-4",
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

      {/* Скроллящаяся зона с карточками. Независимый overflow-y: родительская
          доска имеет фикс.высоту → `flex-1` + overflow-y-auto = свой скролл
          в каждой колонке. callback-ref совмещает droppable (dnd-kit) и
          scrollRef (IntersectionObserver для автоподгрузки). */}
      <div
        ref={setScrollAndDroppable}
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
              ref={loadMoreRef}
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
  // Вариант (DealSourceVariant) — «Дополнительно об источнике» —
  // показываем мелкой строкой под источником, если он есть.
  const sourceVariantLabel = deal.source_variant?.name || null

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

          <Field label="Источник">
            {sourceLabel ? (
              <span className="truncate" title={sourceLabel}>{sourceLabel}</span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
            {sourceVariantLabel && (
              <div
                className="text-[10px] text-gray-500 truncate -mt-0.5"
                title={sourceVariantLabel}
              >
                → {sourceVariantLabel}
              </div>
            )}
          </Field>
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

/**
 * Статистика сверху канбана — тот же визуал что StatCard в /admin/deals/history:
 * иконка в кружке слева + label (uppercase) и жирное значение справа.
 *
 * В `compact` варианте (fullscreen) — всё в одну строку, высота как у
 * SelectTrigger (`h-10`), чтобы ряд «воронка + статы» был одной линией.
 */
function KanbanStatCard({
  label, value, iconColor, compact = false,
}: {
  label: string
  value: number
  iconColor: string
  compact?: boolean
}) {
  const money = value
    ? new Intl.NumberFormat("ru-KZ", {
        style: "currency", currency: "KZT", maximumFractionDigits: 0,
      }).format(value)
    : "—"
  if (compact) {
    return (
      <div className="h-10 rounded-lg border border-gray-200 bg-white px-3 flex items-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-w-0">
        <TrendingUp className={cn("h-4 w-4 shrink-0", iconColor)} />
        <div className="text-[10px] uppercase text-gray-500 tracking-wider whitespace-nowrap truncate">{label}</div>
        <div className="text-sm font-semibold tabular-nums ml-auto whitespace-nowrap">{money}</div>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
        <TrendingUp className={cn("h-5 w-5", iconColor)} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase text-gray-500 tracking-wider">{label}</div>
        <div className="text-base font-semibold tabular-nums truncate">{money}</div>
      </div>
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
