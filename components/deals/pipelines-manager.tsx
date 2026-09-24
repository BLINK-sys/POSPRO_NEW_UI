"use client"

/**
 * Управление воронками и стадиями сделок (/admin/deals/pipelines).
 *
 * Batch-режим: все правки копятся в локальном draft, кнопка «Сохранить»
 * вычисляет diff между draft и snapshot'ом (последнее что мы точно знаем
 * из бэка) и шлёт серию запросов в правильном порядке:
 *   1) create new pipelines
 *   2) update existing pipelines (name/active)
 *   3) create new stages
 *   4) update existing stages (name/color/type)
 *   5) delete stages
 *   6) delete pipelines
 *   7) reorder pipelines / stages
 *
 * После успешного save — snapshot = draft, никакого re-fetch → страница
 * не мерцает.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Trophy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"
import type {
  DealPipeline,
  DealStage,
  DealStageType,
  PipelinesListResponse,
} from "@/lib/deals-types"

// ============================================================================
// Draft types
// ============================================================================

/**
 * Локальная модель. `serverId===null` означает «ещё не создано на бэке».
 * `_deleted` — «удалить при следующем save». Draft-элементы с _deleted
 * не рендерятся, но остаются в списке чтобы порядок и tempId ссылки
 * (напр. pipeline → stages) остались стабильны до момента save.
 */
interface DraftStage {
  serverId: number | null
  clientKey: string
  name: string
  color: string
  type: DealStageType
  _deleted?: boolean
}

interface DraftPipeline {
  serverId: number | null
  clientKey: string
  name: string
  active: boolean
  stages: DraftStage[]
  _deleted?: boolean
}

const STAGE_TYPES: {
  value: DealStageType
  label: string
  Icon?: any
}[] = [
  { value: "normal", label: "Обычная" },
  { value: "won", label: "Выигрышная", Icon: Trophy },
  { value: "lost", label: "Проигрышная", Icon: Ban },
]

const DEFAULT_STAGE_COLOR = "#94a3b8"

// Пресеты для быстрого выбора цвета стадии. Взяты из Tailwind palette
// 500-ключей — насыщенные цвета, хорошо читаются как фон колонки.
// 20 = 5 колонок × 4 ряда в поповере.
const COLOR_PRESETS: string[] = [
  "#94a3b8", // slate
  "#6b7280", // gray
  "#ef4444", // red
  "#fb7185", // rose
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#facc15", // yellow-400 (brand-like)
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
]

let _keyCounter = 0
const nextKey = (prefix: string) =>
  `${prefix}-${++_keyCounter}-${Math.random().toString(36).slice(2, 6)}`

function fromServer(pipelines: DealPipeline[]): DraftPipeline[] {
  return [...pipelines]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map<DraftPipeline>((p) => ({
      serverId: p.id,
      clientKey: `p-${p.id}`,
      name: p.name,
      active: p.active,
      stages: [...(p.stages || [])]
        .sort((a, b) => a.order - b.order || a.id - b.id)
        .map<DraftStage>((s) => ({
          serverId: s.id,
          clientKey: `s-${s.id}`,
          name: s.name,
          color: s.color,
          type: s.type,
        })),
    }))
}

function deepClone(list: DraftPipeline[]): DraftPipeline[] {
  return list.map((p) => ({
    ...p,
    stages: p.stages.map((s) => ({ ...s })),
  }))
}

// ============================================================================
// Component
// ============================================================================

export default function PipelinesManager() {
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snapshot, setSnapshot] = useState<DraftPipeline[]>([])
  const [draft, setDraft] = useState<DraftPipeline[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const [newPipelineName, setNewPipelineName] = useState("")
  const [deletePipelineKey, setDeletePipelineKey] = useState<string | null>(null)
  const [deleteStageKey, setDeleteStageKey] = useState<{
    p: string
    s: string
  } | null>(null)
  // Модалка «Уйти с несохранёнными правками?»
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)

  // ----- Load once -----

  useEffect(() => {
    let ignore = false
    setLoading(true)
    crmGet<PipelinesListResponse>("/api/admin/deal-pipelines?with_stages=1")
      .then((res) => {
        if (ignore) return
        const list = fromServer(res.pipelines || [])
        setSnapshot(list)
        setDraft(deepClone(list))
        setActiveKey(list[0]?.clientKey ?? null)
      })
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить воронки",
          description: e?.message,
        })
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [toast])

  // ----- Change tracking -----

  const isDirty = useMemo(() => {
    // Простое JSON-сравнение. Списки одинакового размера, у полей
    // сериализуемые типы — достаточно.
    return JSON.stringify(draft) !== JSON.stringify(snapshot)
  }, [draft, snapshot])

  const changeCount = useMemo(() => {
    // Считаем видимые изменения для юзера — примерно.
    let count = 0
    const snapPipelines = new Map(
      snapshot.map((p) => [p.clientKey, p] as const),
    )
    const draftPipelineKeys = new Set(draft.map((p) => p.clientKey))

    for (const p of draft) {
      if (p._deleted) {
        // Удаление только если реально существовало.
        if (p.serverId != null) count++
        continue
      }
      const orig = snapPipelines.get(p.clientKey)
      if (!orig) {
        // Новая воронка.
        count++
        // Плюс каждая её (не-удалённая) стадия.
        count += p.stages.filter((s) => !s._deleted).length
        continue
      }
      // Существующая. Смотрим изменения полей.
      if (orig.name !== p.name || orig.active !== p.active) count++
      // Стадии.
      const snapStages = new Map(
        orig.stages.map((s) => [s.clientKey, s] as const),
      )
      const draftStageKeys = new Set(p.stages.map((s) => s.clientKey))

      for (const s of p.stages) {
        if (s._deleted) {
          if (s.serverId != null) count++
          continue
        }
        const os = snapStages.get(s.clientKey)
        if (!os) {
          count++
          continue
        }
        if (
          os.name !== s.name ||
          os.color !== s.color ||
          os.type !== s.type
        ) {
          count++
        }
      }
      // Порядок стадий: если разный — 1 change.
      const snapOrder = orig.stages
        .filter((s) => draftStageKeys.has(s.clientKey))
        .map((s) => s.clientKey)
      const draftOrder = p.stages
        .filter((s) => !s._deleted)
        .map((s) => s.clientKey)
      if (JSON.stringify(snapOrder) !== JSON.stringify(draftOrder)) count++
    }

    // Порядок воронок: сравниваем последовательности не-удалённых pipeline'ов.
    const snapPipelineOrder = snapshot
      .filter((p) => draftPipelineKeys.has(p.clientKey))
      .map((p) => p.clientKey)
    const draftPipelineOrder = draft
      .filter((p) => !p._deleted)
      .map((p) => p.clientKey)
    if (
      JSON.stringify(snapPipelineOrder) !== JSON.stringify(draftPipelineOrder)
    )
      count++

    return count
  }, [draft, snapshot])

  // ----- Draft mutations -----

  const active = draft.find((p) => p.clientKey === activeKey) ?? null

  const updatePipeline = (key: string, patch: Partial<DraftPipeline>) => {
    setDraft((prev) =>
      prev.map((p) => (p.clientKey === key ? { ...p, ...patch } : p)),
    )
  }
  const updateStage = (
    pKey: string,
    sKey: string,
    patch: Partial<DraftStage>,
  ) => {
    setDraft((prev) =>
      prev.map((p) =>
        p.clientKey === pKey
          ? {
              ...p,
              stages: p.stages.map((s) =>
                s.clientKey === sKey ? { ...s, ...patch } : s,
              ),
            }
          : p,
      ),
    )
  }

  const addPipeline = () => {
    const name = newPipelineName.trim()
    if (!name) return
    const p: DraftPipeline = {
      serverId: null,
      clientKey: nextKey("p-new"),
      name,
      active: true,
      stages: [],
    }
    setDraft((prev) => [...prev, p])
    setNewPipelineName("")
    setActiveKey(p.clientKey)
  }

  const requestDeletePipeline = (key: string) => setDeletePipelineKey(key)
  const confirmDeletePipeline = () => {
    if (!deletePipelineKey) return
    const p = draft.find((x) => x.clientKey === deletePipelineKey)
    if (!p) {
      setDeletePipelineKey(null)
      return
    }
    if (p.serverId == null) {
      // Только локальная — просто удалить из draft, tempId ссылки не важны.
      setDraft((prev) => prev.filter((x) => x.clientKey !== deletePipelineKey))
    } else {
      updatePipeline(deletePipelineKey, { _deleted: true })
    }
    setDeletePipelineKey(null)
    if (activeKey === deletePipelineKey) {
      const remaining = draft.find(
        (x) => x.clientKey !== deletePipelineKey && !x._deleted,
      )
      setActiveKey(remaining?.clientKey ?? null)
    }
  }

  const movePipeline = (key: string, dir: -1 | 1) => {
    const visible = draft.filter((p) => !p._deleted)
    const idx = visible.findIndex((p) => p.clientKey === key)
    const tgt = idx + dir
    if (tgt < 0 || tgt >= visible.length) return
    ;[visible[idx], visible[tgt]] = [visible[tgt], visible[idx]]
    // Reconstruct draft с новым порядком видимых + сохраняем удалённые
    // в конце (порядок не важен для _deleted).
    const deleted = draft.filter((p) => p._deleted)
    setDraft([...visible, ...deleted])
  }

  const addStage = () => {
    if (!active) return
    const s: DraftStage = {
      serverId: null,
      clientKey: nextKey("s-new"),
      name: "Новая стадия",
      color: DEFAULT_STAGE_COLOR,
      type: "normal",
    }
    setDraft((prev) =>
      prev.map((p) =>
        p.clientKey === active.clientKey ? { ...p, stages: [...p.stages, s] } : p,
      ),
    )
  }

  const requestDeleteStage = (pKey: string, sKey: string) =>
    setDeleteStageKey({ p: pKey, s: sKey })
  const confirmDeleteStage = () => {
    if (!deleteStageKey) return
    const p = draft.find((x) => x.clientKey === deleteStageKey.p)
    const s = p?.stages.find((x) => x.clientKey === deleteStageKey.s)
    if (!p || !s) {
      setDeleteStageKey(null)
      return
    }
    if (s.serverId == null) {
      setDraft((prev) =>
        prev.map((pp) =>
          pp.clientKey === deleteStageKey.p
            ? {
                ...pp,
                stages: pp.stages.filter(
                  (ss) => ss.clientKey !== deleteStageKey.s,
                ),
              }
            : pp,
        ),
      )
    } else {
      updateStage(deleteStageKey.p, deleteStageKey.s, { _deleted: true })
    }
    setDeleteStageKey(null)
  }

  const moveStage = (pKey: string, sKey: string, dir: -1 | 1) => {
    setDraft((prev) =>
      prev.map((p) => {
        if (p.clientKey !== pKey) return p
        const visible = p.stages.filter((s) => !s._deleted)
        const idx = visible.findIndex((s) => s.clientKey === sKey)
        const tgt = idx + dir
        if (tgt < 0 || tgt >= visible.length) return p
        ;[visible[idx], visible[tgt]] = [visible[tgt], visible[idx]]
        const deleted = p.stages.filter((s) => s._deleted)
        return { ...p, stages: [...visible, ...deleted] }
      }),
    )
  }

  // ----- Reset -----

  const handleReset = () => {
    setDraft(deepClone(snapshot))
    if (!snapshot.find((p) => p.clientKey === activeKey)) {
      setActiveKey(snapshot[0]?.clientKey ?? null)
    }
  }

  // ----- Save (batch) -----

  const handleSave = async (): Promise<boolean> => {
    if (!isDirty) return true
    setSaving(true)
    const errors: string[] = []
    let fatal = false
    // Локально изменяемая копия draft — на неё будем прицеплять реальные
    // serverId'ы после create'ов.
    const workingDraft: DraftPipeline[] = deepClone(draft)
    // Map: clientKey pipeline → real serverId (для новых).
    const pipelineIdMap = new Map<string, number>()

    try {
      // Прежде всего запомним оригинал pipeline'ов из snapshot для diff.
      const snapPipelines = new Map(
        snapshot.map((p) => [p.clientKey, p] as const),
      )

      // 1) Создание новых воронок.
      for (const p of workingDraft) {
        if (p._deleted || p.serverId != null) continue
        const res = await crmPost<{ pipeline: DealPipeline }>(
          "/api/admin/deal-pipelines",
          { name: p.name, active: p.active },
        )
        p.serverId = res.pipeline.id
        pipelineIdMap.set(p.clientKey, res.pipeline.id)
      }

      // 2) Обновление существующих воронок.
      for (const p of workingDraft) {
        if (p._deleted || p.serverId == null) continue
        const orig = snapPipelines.get(p.clientKey)
        if (!orig) continue
        const patch: Record<string, any> = {}
        if (orig.name !== p.name) patch.name = p.name
        if (orig.active !== p.active) patch.active = p.active
        if (Object.keys(patch).length > 0) {
          await crmPut(`/api/admin/deal-pipelines/${p.serverId}`, patch)
        }
      }

      // 3) Создание новых стадий (нужен реальный pipeline_id).
      for (const p of workingDraft) {
        if (p._deleted || p.serverId == null) continue
        for (const s of p.stages) {
          if (s._deleted || s.serverId != null) continue
          const res = await crmPost<{ stage: DealStage }>(
            "/api/admin/deal-stages",
            {
              pipeline_id: p.serverId,
              name: s.name,
              color: s.color,
              type: s.type,
            },
          )
          s.serverId = res.stage.id
        }
      }

      // 4) Обновление существующих стадий.
      for (const p of workingDraft) {
        if (p._deleted) continue
        const origPipeline = snapPipelines.get(p.clientKey)
        for (const s of p.stages) {
          if (s._deleted || s.serverId == null) continue
          const os = origPipeline?.stages.find(
            (x) => x.serverId === s.serverId,
          )
          if (!os) continue
          const patch: Record<string, any> = {}
          if (os.name !== s.name) patch.name = s.name
          if (os.color !== s.color) patch.color = s.color
          if (os.type !== s.type) patch.type = s.type
          if (Object.keys(patch).length > 0) {
            await crmPut(`/api/admin/deal-stages/${s.serverId}`, patch)
          }
        }
      }

      // 5) Удаление стадий.
      for (const p of workingDraft) {
        for (const s of p.stages) {
          if (s._deleted && s.serverId != null) {
            try {
              await crmDelete(`/api/admin/deal-stages/${s.serverId}`)
            } catch (e: any) {
              errors.push(`Стадия «${s.name}»: ${e?.message}`)
            }
          }
        }
      }

      // 6) Удаление воронок.
      for (const p of workingDraft) {
        if (p._deleted && p.serverId != null) {
          try {
            await crmDelete(`/api/admin/deal-pipelines/${p.serverId}`)
          } catch (e: any) {
            errors.push(`Воронка «${p.name}»: ${e?.message}`)
          }
        }
      }

      // 7) Reorder воронок (по видимым).
      const visiblePipelines = workingDraft.filter((p) => !p._deleted)
      const pipelineOrderPayload = visiblePipelines
        .filter((p) => p.serverId != null)
        .map((p, i) => ({ id: p.serverId!, order: i }))
      if (pipelineOrderPayload.length > 0) {
        await crmPost(
          "/api/admin/deal-pipelines/reorder",
          pipelineOrderPayload,
        )
      }

      // 8) Reorder стадий внутри каждой воронки.
      for (const p of visiblePipelines) {
        const visibleStages = p.stages.filter((s) => !s._deleted)
        const stageOrderPayload = visibleStages
          .filter((s) => s.serverId != null)
          .map((s, i) => ({ id: s.serverId!, order: i }))
        if (stageOrderPayload.length > 0) {
          await crmPost("/api/admin/deal-stages/reorder", stageOrderPayload)
        }
      }

      // Сохранили. Убираем удалённые из draft и обновляем snapshot без
      // re-fetch — страница не мерцает.
      const committed: DraftPipeline[] = workingDraft
        .filter((p) => !p._deleted)
        .map((p) => ({
          ...p,
          stages: p.stages.filter((s) => !s._deleted),
        }))
      setDraft(deepClone(committed))
      setSnapshot(deepClone(committed))

      if (errors.length > 0) {
        toast({
          variant: "destructive",
          title: `Часть изменений не применена (${errors.length})`,
          description: errors.slice(0, 3).join(" · "),
        })
      } else {
        toast({ title: "Сохранено" })
      }
    } catch (e: any) {
      fatal = true
      toast({
        variant: "destructive",
        title: "Ошибка сохранения",
        description: e?.message,
      })
    } finally {
      setSaving(false)
    }
    return !fatal && errors.length === 0
  }

  // ----- Warn on unload if dirty -----

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

  const visiblePipelines = draft.filter((p) => !p._deleted)
  const visibleStages = active?.stages.filter((s) => !s._deleted) ?? []

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Шапка */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => {
            if (isDirty) setPendingNavigation("/admin/deals")
            else router.push("/admin/deals")
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />К доске
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold leading-tight">
            Настройка воронок
          </h1>
          <p className="text-sm text-gray-500">
            Правки не применяются моментально — соберите нужные изменения и
            нажмите «Сохранить».
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="rounded-lg"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Отменить
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Сохранить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
        {/* Слева — badge несохранённых правок + карточка воронок */}
        <div className="space-y-2">
          {isDirty && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
              Несохранённых правок: {changeCount}
            </div>
          )}
          <Card className="rounded-xl border-gray-200 p-3 space-y-2 h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 px-1">
            Воронки
          </h2>
          <div className="space-y-1">
            {visiblePipelines.length === 0 && (
              <div className="text-xs text-gray-500 py-3 text-center">
                Пока нет
              </div>
            )}
            {visiblePipelines.map((p, i) => {
              const isNew = p.serverId == null
              const isRenamed =
                p.serverId != null &&
                snapshot.find((x) => x.clientKey === p.clientKey)?.name !== p.name
              return (
                <div
                  key={p.clientKey}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border p-2 transition-colors",
                    activeKey === p.clientKey
                      ? "border-brand-yellow bg-brand-yellow/15"
                      : "border-gray-200 hover:bg-gray-50 cursor-pointer",
                    !p.active && "opacity-60",
                  )}
                  onClick={() =>
                    activeKey !== p.clientKey && setActiveKey(p.clientKey)
                  }
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">
                      {p.name}
                    </span>
                    {isNew && (
                      <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded px-1 shrink-0">
                        new
                      </span>
                    )}
                    {isRenamed && (
                      <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-700 rounded px-1 shrink-0">
                        edit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconBtn
                      title="Вверх"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        movePipeline(p.clientKey, -1)
                      }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      title="Вниз"
                      disabled={i === visiblePipelines.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        movePipeline(p.clientKey, 1)
                      }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <Label className="text-xs text-gray-500">Новая воронка</Label>
            <div className="flex gap-1 mt-1">
              <Input
                placeholder="Название"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addPipeline()
                }}
              />
              <Button
                size="icon"
                onClick={addPipeline}
                disabled={!newPipelineName.trim()}
                className="bg-brand-yellow text-black hover:bg-yellow-500 shrink-0"
                title="Добавить в draft"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Не создаётся сразу — уйдёт на бэк после «Сохранить».
            </p>
          </div>
          </Card>
        </div>

        {/* Справа — детали активной воронки */}
        <Card className="rounded-xl border-gray-200 p-4">
          {!active ? (
            <div className="text-center text-gray-500 py-16">
              Выберите воронку слева или создайте новую
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  className="text-lg font-semibold"
                  value={active.name}
                  onChange={(e) =>
                    updatePipeline(active.clientKey, { name: e.target.value })
                  }
                />
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={active.active}
                    onCheckedChange={(v) =>
                      updatePipeline(active.clientKey, { active: v })
                    }
                  />
                  <Label className="text-sm">
                    {active.active ? "Активна" : "Выключена"}
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => requestDeletePipeline(active.clientKey)}
                  className="text-red-500 hover:bg-red-50 rounded-full"
                  title="Удалить воронку"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    Стадии
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addStage}
                    className="rounded-lg"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Добавить
                  </Button>
                </div>

                {visibleStages.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-300 rounded-lg">
                    Стадий нет — добавьте первую
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleStages.map((s, i) => (
                      <StageRow
                        key={s.clientKey}
                        stage={s}
                        onUpdate={(patch) =>
                          updateStage(active.clientKey, s.clientKey, patch)
                        }
                        onDelete={() =>
                          requestDeleteStage(active.clientKey, s.clientKey)
                        }
                        onMove={(dir) =>
                          moveStage(active.clientKey, s.clientKey, dir)
                        }
                        canMoveUp={i > 0}
                        canMoveDown={i < visibleStages.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Confirms */}
      <AlertDialog
        open={Boolean(deletePipelineKey)}
        onOpenChange={(v) => !v && setDeletePipelineKey(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить воронку?</AlertDialogTitle>
            <AlertDialogDescription>
              Воронка помечается на удаление и уйдёт с бэка при «Сохранить».
              Если к ней привязаны сделки, бэк вернёт ошибку — сначала
              переместите их.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePipeline}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Пометить на удаление
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteStageKey)}
        onOpenChange={(v) => !v && setDeleteStageKey(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить стадию?</AlertDialogTitle>
            <AlertDialogDescription>
              Стадия помечается на удаление и уйдёт с бэка при «Сохранить».
              Если в ней есть сделки, бэк вернёт ошибку — сначала переместите
              их в другую стадию.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteStage}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Пометить на удаление
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Уход с несохранёнными правками */}
      <AlertDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(v) => !v && setPendingNavigation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Вы внесли {changeCount}{" "}
              {changeCount === 1 ? "изменение" : "изменений"} и не нажали
              «Сохранить». Выйти без сохранения?
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
                const ok = await handleSave()
                if (ok) router.push(dest)
                // Если что-то не сохранилось — тост уже показан, оставляем
                // юзера на странице чтобы он мог посмотреть/поправить.
              }}
              className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
            >
              Сохранить и выйти
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================================
// Stage row
// ============================================================================

function StageRow({
  stage,
  onUpdate,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  stage: DraftStage
  onUpdate: (patch: Partial<DraftStage>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const typeMeta =
    STAGE_TYPES.find((t) => t.value === stage.type) ?? STAGE_TYPES[0]
  const TypeIcon = typeMeta.Icon
  const isNew = stage.serverId == null

  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-2 bg-white">
      <div className="flex items-center gap-0.5 shrink-0">
        <IconBtn title="Вверх" disabled={!canMoveUp} onClick={() => onMove(-1)}>
          <ChevronUp className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Вниз" disabled={!canMoveDown} onClick={() => onMove(1)}>
          <ChevronDown className="h-3.5 w-3.5" />
        </IconBtn>
      </div>

      <StageColorPicker
        value={stage.color}
        onChange={(color) => onUpdate({ color })}
      />

      <Input
        className="flex-1"
        value={stage.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
      />

      <Select
        value={stage.type}
        onValueChange={(v) => onUpdate({ type: v as DealStageType })}
      >
        <SelectTrigger className="w-40 shrink-0">
          <SelectValue>
            <span className="inline-flex items-center gap-1.5">
              {TypeIcon && <TypeIcon className="h-3.5 w-3.5" />}
              {typeMeta.label}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STAGE_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              <span className="inline-flex items-center gap-1.5">
                {t.Icon && <t.Icon className="h-3.5 w-3.5" />}
                {t.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isNew && (
        <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded px-1 shrink-0">
          new
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="text-red-500 hover:bg-red-50 rounded-full shrink-0"
        title="Удалить"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ============================================================================
// Icon button
// ============================================================================

function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-6 w-6 rounded flex items-center justify-center text-gray-500",
        disabled
          ? "opacity-30 cursor-not-allowed"
          : "hover:bg-gray-100 hover:text-gray-900 cursor-pointer",
      )}
    >
      {children}
    </button>
  )
}

// ============================================================================
// Stage color picker с палитрой пресетов + native color для «свой цвет»
// ============================================================================

function StageColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 shrink-0 rounded border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer"
          style={{ backgroundColor: value }}
          title="Цвет колонки"
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Палитра
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_PRESETS.map((c) => {
            const active = c.toLowerCase() === value.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={cn(
                  "h-7 w-7 rounded transition-transform",
                  // Ни рамки, ни ring — только лёгкий scale для активного
                  // и hover-feedback. Тонкий border-black/5 сохраняем
                  // всегда, чтобы белые/светлые swatch'и не «терялись».
                  "border border-black/5 hover:scale-110",
                  active && "scale-110",
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            )
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Свой цвет
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-12 rounded cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
              }}
              className="flex-1 h-8 rounded border border-gray-200 px-2 text-xs font-mono uppercase focus:outline-none focus:border-gray-400"
              placeholder="#000000"
              maxLength={7}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
