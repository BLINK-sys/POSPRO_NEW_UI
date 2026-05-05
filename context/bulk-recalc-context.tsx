"use client"

/**
 * Глобальный контекст массового пересчёта складов.
 *
 * Зачем: пользователь должен иметь возможность свернуть окно прогресса в
 * плавающую кнопку справа-снизу и переходить по любым страницам — пересчёт
 * продолжается на сервере, а UI продолжает поллить статусы и обновлять
 * floating-кнопку. Когда все склады закончили — кнопка зеленеет и пульсирует.
 *
 * Состояние и polling живут здесь (а не в модалке), чтобы выживать переходы
 * между страницами. Модалка читает/пишет из контекста.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  type RecalculateData,
  type Warehouse,
  recalculateWarehouse,
  getRecalculateStatus,
} from "@/app/actions/warehouses"
import { useToast } from "@/hooks/use-toast"

const POLL_INTERVAL_MS = 2000

export type BulkPhase = "idle" | "running" | "done"

export interface BulkRecalcState {
  phase: BulkPhase
  // Снимки выбранных складов (для отображения в карточках при сворачивании
  // — мы не хотим тащить getWarehouses() ещё раз внутри модалки).
  warehouses: Record<number, { id: number; name: string; supplier_name: string }>
  // Прогресс по каждому складу. null — стартовый запрос ещё не вернулся.
  progress: Record<number, RecalculateData | null>
  // Ошибки запуска (если у склада нет формулы и т.п.).
  startErrors: Record<number, string>
  // Свёрнут ли в плавающую кнопку
  isMinimized: boolean
  // Открыта ли модалка прогресса
  isModalOpen: boolean
}

interface BulkRecalcContextType extends BulkRecalcState {
  /** Запуск массового пересчёта. selectedWarehouses — снимки данных
   *  для отображения карточек, recalc стартует параллельно. */
  start: (selectedWarehouses: Warehouse[]) => Promise<void>
  /** Открыть модалку прогресса (когда есть запущенный пересчёт). */
  openModal: () => void
  /** Закрыть только модалку, оставив контекст и polling — карточки
   *  складов продолжат тикать в реальном времени из ctx.progress. */
  closeModal: () => void
  /** Свернуть в плавающую кнопку — модалка закрыта, polling продолжается. */
  minimize: () => void
  /** Полностью завершить и убрать кнопку. Используется в «ОК» когда всё готово. */
  dismiss: () => void
  /** True если все запущенные пересчёты завершились (done или error). */
  allDone: boolean
  /** Сколько складов всего сейчас в работе/мониторинге. */
  totalCount: number
  /** Сколько складов уже закрыто (done или error). */
  completedCount: number
}

const BulkRecalcContext = createContext<BulkRecalcContextType | undefined>(undefined)

export function BulkRecalcProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [phase, setPhase] = useState<BulkPhase>("idle")
  const [warehousesSnap, setWarehousesSnap] = useState<
    Record<number, { id: number; name: string; supplier_name: string }>
  >({})
  const [progress, setProgress] = useState<Record<number, RecalculateData | null>>({})
  const [startErrors, setStartErrors] = useState<Record<number, string>>({})
  const [isMinimized, setIsMinimized] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Чтобы toast «всё готово» сработал ровно один раз на сессию пересчёта
  const doneToastFiredRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  // Считаем текущее состояние
  const totalCount = Object.keys(progress).length + Object.keys(startErrors).length
  const completedCount = useMemo(() => {
    let n = Object.keys(startErrors).length
    for (const id of Object.keys(progress)) {
      const s = progress[Number(id)]
      if (s && (s.status === "done" || s.status === "error")) n += 1
    }
    return n
  }, [progress, startErrors])
  const allDone = phase === "done" || (totalCount > 0 && completedCount === totalCount)

  // Когда все завершились — переключаем фазу в done и стопим polling
  useEffect(() => {
    if (phase !== "running") return
    if (totalCount === 0) return
    if (completedCount < totalCount) return
    setPhase("done")
    stopPolling()
    if (!doneToastFiredRef.current) {
      doneToastFiredRef.current = true
      toast({
        title: "Массовый пересчёт завершён",
        description: `${totalCount} склад(ов) обработано`,
      })
    }
  }, [phase, totalCount, completedCount, stopPolling, toast])

  // Снимаем таймер при размонтировании
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  /** Старт пересчёта */
  const start = useCallback(
    async (selectedWarehouses: Warehouse[]) => {
      // Очищаем предыдущее состояние
      stopPolling()
      doneToastFiredRef.current = false
      setIsMinimized(false)
      // Удерживаем модалку открытой через контекст. Родительский `open`
      // диалога переключится в false когда selection-фаза «применит»
      // выбор — без этого флага диалог бы закрылся целиком.
      setIsModalOpen(true)

      const snap: typeof warehousesSnap = {}
      for (const w of selectedWarehouses) {
        snap[w.id] = {
          id: w.id,
          name: w.name,
          supplier_name: w.supplier_name || "",
        }
      }
      setWarehousesSnap(snap)
      setStartErrors({})
      // Изначально null — карточки покажут «Запуск…»
      setProgress(
        selectedWarehouses.reduce<Record<number, RecalculateData | null>>(
          (acc, w) => {
            acc[w.id] = null
            return acc
          },
          {},
        ),
      )
      setPhase("running")

      // Параллельно стартуем все
      const results = await Promise.all(
        selectedWarehouses.map(async (w) => ({
          id: w.id,
          result: await recalculateWarehouse(w.id),
        })),
      )

      const newProgress: Record<number, RecalculateData | null> = {}
      const newErrors: Record<number, string> = {}
      for (const { id, result } of results) {
        if (result.success && result.data) {
          newProgress[id] = result.data
        } else {
          newErrors[id] = result.message || "Не удалось запустить пересчёт"
        }
      }
      setProgress((prev) => ({ ...prev, ...newProgress }))
      setStartErrors(newErrors)

      // Если все стартовые запросы провалились — нечего поллить
      const ids = Object.keys(newProgress).map(Number)
      if (ids.length === 0) {
        // Все ошибки на старте → сразу done (карточки покажут красные плашки)
        return
      }

      // Запускаем общий таймер
      pollTimerRef.current = setInterval(async () => {
        const updates = await Promise.all(
          ids.map(async (id) => {
            const r = await getRecalculateStatus(id)
            return { id, data: r.data || null }
          }),
        )
        setProgress((prev) => {
          const next = { ...prev }
          for (const { id, data } of updates) {
            if (data) next[id] = data
          }
          return next
        })
      }, POLL_INTERVAL_MS)
    },
    [stopPolling],
  )

  const openModal = useCallback(() => {
    setIsModalOpen(true)
    setIsMinimized(false)
  }, [])

  const closeModal = useCallback(() => {
    // Только прячем модалку. Polling и состояние остаются — это нужно
    // чтобы карточки складов на странице /admin/suppliers продолжали
    // показывать live-прогресс через ctx.progress даже если модалку
    // закрыли крестиком (а не «свернули»).
    setIsModalOpen(false)
  }, [])

  const minimize = useCallback(() => {
    setIsModalOpen(false)
    setIsMinimized(true)
  }, [])

  const dismiss = useCallback(() => {
    stopPolling()
    setIsModalOpen(false)
    setIsMinimized(false)
    setPhase("idle")
    setProgress({})
    setStartErrors({})
    setWarehousesSnap({})
  }, [stopPolling])

  const value: BulkRecalcContextType = {
    phase,
    warehouses: warehousesSnap,
    progress,
    startErrors,
    isMinimized,
    isModalOpen,
    start,
    openModal,
    closeModal,
    minimize,
    dismiss,
    allDone,
    totalCount,
    completedCount,
  }

  return (
    <BulkRecalcContext.Provider value={value}>{children}</BulkRecalcContext.Provider>
  )
}

export function useBulkRecalc() {
  const ctx = useContext(BulkRecalcContext)
  if (!ctx) throw new Error("useBulkRecalc must be used within BulkRecalcProvider")
  return ctx
}
