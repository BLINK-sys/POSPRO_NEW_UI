"use client"

/**
 * Канбан задач проекта. Столбцы — ProjectStage, карточки — Task.
 * DnD через @dnd-kit: при переносе в другую колонку шлём POST
 * /api/admin/projects/<pid>/tasks/<tid>/move с новым stage_id — бэк
 * автоматически мапит глобальный status задачи по maps_to_status
 * стадии и сохраняет prev_project_stage_id.
 *
 * Компоновка повторяет канбан сделок (deals-kanban.tsx): доска на всю
 * ширину окна (negative margin), top-scrollbar, pan правой кнопкой мыши,
 * fullscreen-toggle, цветные рамки колонок по stage.color, независимый
 * вертикальный скролл внутри каждой колонки.
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { useAuth } from "@/context/auth-context"
import { createPortal } from "react-dom"
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  closestCorners, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import { Card } from "@/components/ui/card"
import {
  AlertTriangle, Clock, User, Flag, Filter, X as IconX,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { crmPost } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"
import {
  type ProjectStage, type ProjectMember, type TaskStageStatus,
  STAGE_STATUS_META,
} from "@/lib/projects-types"

interface TaskLite {
  id: number
  title: string
  status: TaskStageStatus
  priority: string
  responsible_id: number | null
  project_stage_id: number | null
  due_at: string | null
  completed_at: string | null
}

export default function ProjectKanban({
  projectId, stages, tasks, usersById, canManage, onTasksChange,
  isFullscreen = false, onToggleFullscreen,
  members = [], managerFilter = null, onManagerFilterChange,
}: {
  projectId: number
  stages: ProjectStage[]
  tasks: TaskLite[]
  usersById: Map<number, string>
  canManage: boolean
  onTasksChange: () => void
  /** Fullscreen управляется снаружи (project-detail), чтобы кнопка
   *  переключения жила в одной строке с селектором вид «Канбан/Список». */
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  /** Participants для фильтра «Менеджер» — приходят из project.members. */
  members?: ProjectMember[]
  /** null = не фильтруем (все). Массив user_id = включить только их. */
  managerFilter?: number[] | null
  onManagerFilterChange?: (v: number[] | null) => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useAuth()

  // Юзер имеет право видеть фильтр менеджеров, если он может настраивать
  // проект (canManage) ИЛИ если ему в настройках участников включили
  // «Все задачи проекта» (can_see_all_tasks=true). Иначе бэк отдаст
  // только его задачи, фильтр для него бессмыслен.
  const canUseFilter = useMemo(() => {
    if (canManage) return true
    if (!user) return false
    const me = members.find((m) => m.user_id === user.id)
    return !!(me && me.can_see_all_tasks)
  }, [canManage, user, members])

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sort_order - b.sort_order),
    [stages],
  )

  // Группируем задачи по колонкам. Задачи без project_stage_id —
  // отдельная «корзина» слева, чтобы они не терялись после удаления
  // колонки или до назначения.
  const buckets = useMemo(() => {
    const byStage: Record<number, TaskLite[]> = {}
    const orphan: TaskLite[] = []
    for (const s of sortedStages) byStage[s.id] = []
    for (const t of tasks) {
      if (t.project_stage_id != null && byStage[t.project_stage_id]) {
        byStage[t.project_stage_id].push(t)
      } else {
        orphan.push(t)
      }
    }
    return { byStage, orphan }
  }, [tasks, sortedStages])

  const sensors = useSensors(
    // distance: 5px — ниже порог, чем у сделок (6), т.к. карточки задач
    // меньше. Правую кнопку всё равно отфильтровывает сам PointerSensor
    // (reads pointerType=mouse+button=0) — у dnd-kit это дефолт.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // ---- Fullscreen ---- (управляется снаружи — см. props)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ---- Фокус на карточке по ?focusTask=<tid> (приход назад из задачи) ----
  // После скролла и подсветки чистим query, чтобы повторная установка
  // того же focusTask снова триггерила эффект.
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null)
  useEffect(() => {
    if (typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    const raw = sp.get("focusTask")
    if (!raw) return
    const tid = Number(raw)
    if (!tid) return
    setFocusedTaskId(tid)
    // Чистим URL сразу — на случай, если юзер скроллит дальше, нам
    // не нужно повторно триггериться. history.replaceState — без
    // перехода и без reload.
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete("focusTask")
      window.history.replaceState({}, "", url.toString())
    } catch { /* noop */ }
  }, [])

  // Как только таски загружены и фокусная карточка смонтирована —
  // скроллим к ней и снимаем подсветку через 2.5s.
  useEffect(() => {
    if (!focusedTaskId) return
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-task-card-id="${focusedTaskId}"]`,
      )
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
    }, 120)
    const clear = window.setTimeout(() => setFocusedTaskId(null), 2500)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(clear)
    }
  }, [focusedTaskId, tasks])

  // ---- Активная карточка drag'а (для DragOverlay) ----
  // Без DragOverlay карточка летит внутри своей колонки с transform, но
  // overflow-hidden колонки/доски её обрезает — визуально она «прячется
  // за другими колонками». Поэтому рендерим дубликат в Portal на уровне
  // body, а исходную — делаем прозрачной (см. opacity в TaskCard).
  const [activeTask, setActiveTask] = useState<TaskLite | null>(null)
  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(String(event.active.id).replace("task-", ""))
    setActiveTask(tasks.find((t) => t.id === id) ?? null)
  }

  // ---- Pan правой кнопкой по горизонтали ----
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2) return
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

  const openTask = useCallback((tid: number) => {
    // Запоминаем, что пришли в задачу из этого проекта — чтобы на
    // странице задачи показать кнопку «← В проект» с автоскроллом к
    // нужной карточке. TTL ~30 мин — хватит на любой сценарий.
    try {
      sessionStorage.setItem("task_return_to_project", JSON.stringify({
        taskId: tid,
        projectId,
        ts: Date.now(),
      }))
    } catch { /* noop */ }
    router.push(`/admin/tasks/${tid}`)
  }, [projectId, router])

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const taskId = Number(String(active.id).replace("task-", ""))
    const overId = String(over.id)
    let targetStageId: number | null = null
    if (overId.startsWith("stage-")) {
      targetStageId = Number(overId.replace("stage-", ""))
    } else if (overId.startsWith("task-")) {
      const overTask = tasks.find((t) => t.id === Number(overId.replace("task-", "")))
      targetStageId = overTask?.project_stage_id ?? null
    } else if (overId === "orphan") {
      targetStageId = null
    }
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    if (task.project_stage_id === targetStageId) return

    try {
      await crmPost(
        `/api/admin/projects/${projectId}/tasks/${taskId}/move`,
        { stage_id: targetStageId },
      )
      onTasksChange()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Не удалось перенести", description: e?.message })
    }
  }

  // Сборка всех колонок (включая «Без колонки», если есть) — унифицируем
  // маркер первой/последней для правильного «воздуха» у краёв в fullscreen.
  const allColumns = useMemo(() => {
    const cols: Array<{
      id: string
      title: string
      color: string
      status: TaskStageStatus | null
      items: TaskLite[]
    }> = []
    if (buckets.orphan.length > 0) {
      cols.push({
        id: "orphan",
        title: "Без колонки",
        color: "#cbd5e1",
        status: null,
        items: buckets.orphan,
      })
    }
    for (const s of sortedStages) {
      cols.push({
        id: `stage-${s.id}`,
        title: s.name,
        color: s.color,
        status: s.maps_to_status,
        items: buckets.byStage[s.id] ?? [],
      })
    }
    return cols
  }, [buckets, sortedStages])

  // Тулбар над канбаном: в inline-режиме фильтр и «На весь экран» уже
  // стоят в tabs-header project-detail, здесь ничего не рендерим. В
  // fullscreen-портале шапки табов нет — даём фильтр и «Свернуть» сами.
  const toolbar = isFullscreen && (canUseFilter || onToggleFullscreen) ? (
    <div className="flex items-center gap-2">
      {canUseFilter && (
        <ManagerFilter
          members={members}
          value={managerFilter}
          onChange={onManagerFilterChange ?? (() => {})}
        />
      )}
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="h-7 inline-flex items-center gap-1.5 px-2 rounded-md border border-gray-200 bg-white text-xs text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors shrink-0 ml-auto"
          title="Свернуть"
        >
          Свернуть
        </button>
      )}
    </div>
  ) : null

  const canvasContent = (
    <>
      {toolbar}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <TopScrollbar
          targetRef={boardScrollRef}
          deps={[allColumns.length, tasks.length, isFullscreen]}
        />

        <div
          ref={boardScrollRef}
          onMouseDown={handleBoardMouseDown}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "flex gap-3 pt-3 -mt-3 pb-6 -mb-6 overflow-x-auto",
            isFullscreen
              // В fullscreen контейнер дотягивается до краёв экрана,
              // «воздух» крайним колонкам даётся через ml/mr ниже.
              ? "flex-1 min-h-0 -mx-3 md:-mx-4"
              // Inline режим: высота подбирается под header проекта (
              // шапка + табы + переключатель вид/канбан + fullscreen-строка).
              : "w-full max-w-full h-[calc(100dvh-260px)] min-h-[400px]",
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
            panning && "cursor-grabbing select-none",
          )}
          title="Держите правую кнопку мыши и тяните — прокрутка колонок"
        >
          {allColumns.map((c, i) => (
            <StageColumn
              key={c.id}
              id={c.id}
              title={c.title}
              color={c.color}
              status={c.status}
              tasks={c.items}
              usersById={usersById}
              onOpenTask={openTask}
              firstInRow={isFullscreen && i === 0}
              lastInRow={isFullscreen && i === allColumns.length - 1}
              activeTaskId={activeTask?.id ?? null}
              focusedTaskId={focusedTaskId}
            />
          ))}
        </div>

        {/* DragOverlay рендерится в Portal — карточка летит поверх всего,
            обрезку колонок (overflow-hidden) обходит. */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCardPresentation
              task={activeTask}
              responsibleName={
                activeTask.responsible_id
                  ? usersById.get(activeTask.responsible_id) ?? null
                  : null
              }
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {!canManage && !isFullscreen && (
        <p className="text-xs text-gray-500">
          Только просмотр: настройка колонок доступна владельцу проекта.
        </p>
      )}
    </>
  )

  return (
    // min-w-0 + negative mr «съедает» правый padding админ-layout
    // (p-4 md:p-6), чтобы доска доходила до самого края — ровно как в
    // канбане сделок.
    <div className="space-y-2 w-full min-w-0 -mr-4 md:-mr-6">
      {!isFullscreen && canvasContent}

      {mounted && isFullscreen && createPortal(
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden p-3 md:p-4 flex flex-col gap-2">
          {canvasContent}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ---------- column ----------

function StageColumn({
  id, title, color, status, tasks, usersById, onOpenTask,
  firstInRow, lastInRow, activeTaskId, focusedTaskId,
}: {
  id: string
  title: string
  color: string
  status: TaskStageStatus | null
  tasks: TaskLite[]
  usersById: Map<number, string>
  onOpenTask: (taskId: number) => void
  firstInRow?: boolean
  lastInRow?: boolean
  /** id перетаскиваемой сейчас задачи — исходная карточка прячется
   *  (opacity 0 + pointer-events none), чтобы работала только копия
   *  в DragOverlay. */
  activeTaskId?: number | null
  /** id карточки, которую подсвечиваем ring'ом (focusTask из URL). */
  focusedTaskId?: number | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const meta = status ? STAGE_STATUS_META[status] : null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // w-60 (240px) — как в сделках. h-full → свой вертикальный скролл.
        "shrink-0 w-60 h-full rounded-xl flex flex-col",
        "border bg-gray-50/60 transition-all",
        "shadow-[0_6px_18px_rgba(0,0,0,0.10),0_2px_4px_rgba(0,0,0,0.06)]",
        "overflow-hidden",
        firstInRow && "ml-3 md:ml-4",
        lastInRow && "mr-3 md:mr-4",
        isOver && "bg-brand-yellow/10 shadow-[0_12px_28px_rgba(250,204,21,0.30),0_4px_8px_rgba(250,204,21,0.20)]",
      )}
      style={{ borderColor: isOver ? "#facc15" : color }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 rounded-t-[calc(0.75rem-1px)]"
        style={{ backgroundColor: `${color}14` }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-semibold leading-tight break-words line-clamp-2"
            title={title}
          >
            {title}
          </h3>
        </div>
        <span className="text-xs text-gray-500 tabular-nums shrink-0">
          {tasks.length}
        </span>
      </div>
      {meta && (
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
          {meta.label}
        </div>
      )}
      <div className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            responsibleName={t.responsible_id ? usersById.get(t.responsible_id) ?? null : null}
            onClick={() => onOpenTask(t.id)}
            hidden={activeTaskId === t.id}
            focused={focusedTaskId === t.id}
            focusColor={color}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-[11px] text-gray-400 italic text-center py-4">
            пусто
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({
  task, responsibleName, onClick, hidden, focused, focusColor,
}: {
  task: TaskLite
  responsibleName: string | null
  onClick: () => void
  /** Исходная карточка при активном drag — прячется, видна только копия
   *  в DragOverlay. opacity:0 оставляет место, pointer-events:none не
   *  перехватывает мышь. */
  hidden?: boolean
  /** Карточка «в фокусе» — приход через ?focusTask=<id>. Подсвечиваем
   *  пульсирующим ring'ом цветом колонки, ~2.5s (управляется parent'ом).*/
  focused?: boolean
  /** Цвет stage (= цвет рамки родительской колонки). Используется для
   *  подсветки, чтобы связать карточку визуально с колонкой куда она
   *  вернулась. */
  focusColor?: string
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `task-${task.id}`,
  })

  // Собираем стили подсветки цветом колонки: outline (не распирает layout)
  // + glow-shadow того же hue. Fast-pulse 0.6s через inline animation —
  // быстрее стандартного Tailwind animate-pulse (2s).
  const focusStyle: React.CSSProperties = focused && focusColor
    ? {
        outline: `3px solid ${focusColor}`,
        outlineOffset: "2px",
        borderRadius: "0.5rem",
        boxShadow: `0 0 28px ${focusColor}, 0 0 10px ${focusColor}`,
        animation: "taskFocusPulse 0.6s ease-in-out infinite alternate",
      }
    : {}
  const style: React.CSSProperties = {
    ...(hidden ? { opacity: 0, pointerEvents: "none" as const } : {}),
    ...focusStyle,
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-task-card-id={task.id}
      style={style}
    >
      <TaskCardPresentation
        task={task}
        responsibleName={responsibleName}
        onClick={onClick}
      />
    </div>
  )
}

/**
 * Чисто-презентационная карточка — рендерится и в колонке, и в DragOverlay
 * (там без listeners/attributes). Общий визуал гарантирует, что при drag
 * карточка выглядит ровно так же, как на месте.
 */
function TaskCardPresentation({
  task, responsibleName, onClick, isOverlay,
}: {
  task: TaskLite
  responsibleName: string | null
  onClick?: () => void
  isOverlay?: boolean
}) {
  const overdue =
    task.due_at &&
    task.status !== "done" &&
    new Date(task.due_at).getTime() < Date.now()

  return (
    <Card
      onClick={onClick}
      className={cn(
        "rounded-lg border-gray-200 p-2.5 bg-white transition-shadow",
        !isOverlay && "cursor-grab active:cursor-grabbing hover:shadow-md",
        isOverlay && "shadow-[0_10px_25px_rgba(0,0,0,0.15)] rotate-1 cursor-grabbing",
      )}
    >
      <div className="text-sm font-medium text-gray-900 line-clamp-2">
        {task.title}
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500 flex-wrap">
        {task.priority === "high" && (
          <span className="inline-flex items-center gap-0.5 text-red-600">
            <Flag className="h-3 w-3" />
            высокий
          </span>
        )}
        {responsibleName && (
          <span className="inline-flex items-center gap-0.5">
            <User className="h-3 w-3" />
            {shortName(responsibleName)}
          </span>
        )}
        {task.due_at && (
          <span className={cn("inline-flex items-center gap-0.5", overdue && "text-red-600 font-medium")}>
            {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {formatDate(task.due_at)}
          </span>
        )}
      </div>
    </Card>
  )
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

// ============================================================================
// ManagerFilter — поп-ап «кого показывать» на канбане
// ============================================================================

/**
 * Простой чек-лист менеджеров. value=null → «все» (фильтр выключен).
 * value=[] → выбрано никого (ничего не показывать — валидное состояние,
 * но обычно = «сняли все галочки», интерпретируем как «только свои»?).
 * Логика сервера: пустой query param = нет фильтра = все. Поэтому
 * value=[] передаём как null (сброс), чтобы не путать пользователя.
 */
export function ManagerFilter({
  members, value, onChange,
}: {
  members: ProjectMember[]
  value: number[] | null
  onChange: (v: number[] | null) => void
}) {
  const selected = new Set(value ?? [])
  const active = value !== null && value.length > 0
  const sorted = [...members].sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"))

  const toggle = (uid: number) => {
    const next = new Set(selected)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    const arr = [...next]
    onChange(arr.length === 0 ? null : arr)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-7 inline-flex items-center gap-1.5 px-2 rounded-md border text-xs transition-colors shrink-0",
            active
              ? "bg-brand-yellow/20 border-brand-yellow text-black font-medium hover:bg-brand-yellow/30"
              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300",
          )}
          title="Фильтр по менеджеру"
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Менеджер</span>
          {active && (
            <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-brand-yellow text-[10px] font-semibold text-black">
              {value!.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-gray-100">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
            Показать задачи:
          </span>
          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="h-6 px-1.5 text-[11px] text-gray-500 hover:text-gray-900"
            >
              <IconX className="h-3 w-3 mr-0.5" /> Сбросить
            </Button>
          )}
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="text-xs text-gray-400 italic text-center py-4">
              В проекте пока нет участников.
            </div>
          ) : sorted.map((m) => {
            const checked = selected.has(m.user_id)
            return (
              <label
                key={m.user_id}
                className="flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m.user_id)}
                  className="h-3.5 w-3.5 accent-yellow-500"
                />
                <span className="text-sm text-gray-800 truncate flex-1">
                  {m.full_name}
                </span>
                {m.is_owner && (
                  <span className="text-[10px] text-amber-600 uppercase tracking-wider shrink-0">owner</span>
                )}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// TopScrollbar — та же реализация, что в deals-kanban.tsx
// ============================================================================

function TopScrollbar({
  targetRef,
  deps = [],
}: {
  targetRef: React.RefObject<HTMLDivElement>
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
    if (scrollWidth <= clientWidth + 8) {
      setVisible(false)
      return
    }
    setVisible(true)
    const trackWidth = track.clientWidth
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

  useEffect(() => {
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const startX = e.clientX
    const startScroll = el.scrollLeft
    const maxScroll = el.scrollWidth - el.clientWidth
    const trackWidth = track.clientWidth
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

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
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
