"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  Loader2,
  Check,
  ArrowDownAZ,
  ArrowDownZA,
  Package,
  PackageMinus,
  FolderTree,
  Eye,
  EyeOff,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  type CategorySortMode,
  type CategoryViewsPeriod,
  applyCategorySort,
  getCategoryViewsMap,
} from "@/app/actions/categories"

export type SortModeAll = CategorySortMode | "default"

type ModeOption = {
  value: SortModeAll
  label: string
  icon: React.ComponentType<{ className?: string }>
}

// «Обычная» вкладка: всё, что не про customer_activity.
const COMMON_MODES: ModeOption[] = [
  { value: "default", label: "По умолчанию (порядок в БД)", icon: FolderTree },
  { value: "alpha_asc", label: "А → Я (по алфавиту)", icon: ArrowDownAZ },
  { value: "alpha_desc", label: "Я → А (обратный)", icon: ArrowDownZA },
  { value: "products_desc", label: "По кол-ву товаров ↓", icon: Package },
  { value: "products_asc", label: "По кол-ву товаров ↑", icon: PackageMinus },
  { value: "children_desc", label: "По кол-ву подкатегорий ↓", icon: FolderTree },
]

// «Посещаемость» вкладка: пресеты + переключатель периода.
const VIEWS_MODES: ModeOption[] = [
  { value: "views_desc", label: "По посещаемости ↓", icon: Eye },
  { value: "views_asc", label: "По посещаемости ↑", icon: EyeOff },
]

const PERIODS: { value: CategoryViewsPeriod; label: string }[] = [
  { value: "1m", label: "1 мес" },
  { value: "6m", label: "6 мес" },
  { value: "12m", label: "12 мес" },
  { value: "all", label: "За всё время" },
]

const ALL_MODES = [...COMMON_MODES, ...VIEWS_MODES]

export function modeLabel(mode: SortModeAll): string {
  return ALL_MODES.find((m) => m.value === mode)?.label ?? "По умолчанию"
}

function isViewsMode(m: SortModeAll): boolean {
  return m === "views_desc" || m === "views_asc"
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sortMode: SortModeAll
  onSortModeChange: (mode: SortModeAll) => void
  includeChildren: boolean
  onIncludeChildrenChange: (v: boolean) => void
  viewsPeriod: CategoryViewsPeriod
  onViewsPeriodChange: (p: CategoryViewsPeriod) => void
  onViewsMapLoaded: (map: Record<number, number>) => void
  /** Вызывается после успешного «ОК» (apply-sort), чтобы страница
   *  перечитала порядок из БД. */
  onApplied: () => Promise<void> | void
}

/**
 * Боковая модалка сортировки категорий. Выезжает справа, центрируется
 * по вертикали (не full-height). Содержимое разделено на два таба:
 *   «Обычная»       — алфавит, товары, подкатегории.
 *   «Посещаемость» — views_desc/views_asc + переключатель периода
 *                    (данные из customer_activity, event_type='category_view').
 * Клик по режиму в табе моментально меняет клиентское превью. Кнопка «ОК»
 * вызывает apply-sort и пишет порядок в БД.
 *
 * modal={false}: non-modal Dialog не рендерит Overlay и не блокирует
 * страницу под модалкой, так что админ видит список категорий во время
 * выбора. onInteractOutside заблокирован — закрытие только кнопкой/Esc.
 */
export function CategorySortPanel({
  open,
  onOpenChange,
  sortMode,
  onSortModeChange,
  includeChildren,
  onIncludeChildrenChange,
  viewsPeriod,
  onViewsPeriodChange,
  onViewsMapLoaded,
  onApplied,
}: Props) {
  const [isApplying, startApply] = useTransition()
  const { toast } = useToast()

  // Активный таб. Init — от текущего sortMode. При смене sortMode извне
  // (например «Сброс» в футере → default) тоже синхронизируем.
  const [activeTab, setActiveTab] = useState<"common" | "views">(
    isViewsMode(sortMode) ? "views" : "common",
  )
  useEffect(() => {
    setActiveTab(isViewsMode(sortMode) ? "views" : "common")
  }, [sortMode])

  // Подгружаем views-map при активном views-табе и при смене периода.
  // Дедуп: один запрос на (mode, period).
  const lastLoadedRef = useRef<string>("")
  useEffect(() => {
    if (!isViewsMode(sortMode)) return
    const key = `${sortMode}|${viewsPeriod}`
    if (lastLoadedRef.current === key) return
    lastLoadedRef.current = key
    let cancelled = false
    ;(async () => {
      const res = await getCategoryViewsMap(viewsPeriod)
      if (cancelled) return
      if (res.error) {
        toast({ variant: "destructive", title: "Ошибка", description: res.error })
        return
      }
      onViewsMapLoaded(res.counts)
    })()
    return () => {
      cancelled = true
    }
  }, [sortMode, viewsPeriod, onViewsMapLoaded, toast])

  const handleApply = () => {
    if (sortMode === "default") {
      onOpenChange(false)
      return
    }
    startApply(async () => {
      const res = await applyCategorySort(
        sortMode,
        includeChildren,
        isViewsMode(sortMode) ? viewsPeriod : undefined,
      )
      if (res.success) {
        toast({ title: "Порядок сохранён", description: res.message })
        await onApplied()
        onSortModeChange("default")
        onOpenChange(false)
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: res.error })
      }
    })
  }

  const renderModeList = (modes: ModeOption[]) => (
    <div className="space-y-1.5">
      {modes.map((m) => {
        const Icon = m.icon
        const active = m.value === sortMode
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onSortModeChange(m.value)}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition",
              active
                ? "bg-brand-yellow/20 border border-brand-yellow shadow-[0_2px_6px_rgba(250,204,21,0.25)]"
                : "border border-transparent hover:bg-gray-50 hover:border-gray-200",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-gray-600" />
            <span className="flex-1">{m.label}</span>
            {active && <Check className="h-4 w-4 shrink-0 text-black" />}
          </button>
        )
      })}
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          // Плавающая панель справа по центру, не full-height.
          "inset-y-auto top-1/2 -translate-y-1/2",
          "h-auto max-h-[85vh] w-[460px] sm:max-w-[460px]",
          "rounded-l-2xl border overflow-hidden flex flex-col",
          "shadow-[0_20px_50px_rgba(0,0,0,0.18)]",
        )}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Сортировка категорий</SheetTitle>
          <SheetDescription>
            Выбор применяется сразу как превью. Чтобы сохранить порядок
            в БД — нажми «ОК».
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "common" | "views")}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid grid-cols-2 shrink-0">
            <TabsTrigger value="common">Обычная</TabsTrigger>
            <TabsTrigger value="views">Посещаемость</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 py-3 space-y-4">
            <TabsContent value="common" className="mt-0 space-y-4">
              {renderModeList(COMMON_MODES)}
            </TabsContent>

            <TabsContent value="views" className="mt-0 space-y-4">
              {renderModeList(VIEWS_MODES)}

              <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-3 space-y-2">
                <div className="text-xs font-medium text-gray-700">
                  Период посещаемости
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {PERIODS.map((p) => {
                    const active = p.value === viewsPeriod
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => onViewsPeriodChange(p.value)}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs font-medium transition",
                          active
                            ? "bg-brand-yellow text-black shadow-[0_1px_3px_rgba(250,204,21,0.4)]"
                            : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300",
                        )}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
                {!isViewsMode(sortMode) && (
                  <p className="text-[11px] text-gray-500">
                    Выбери один из режимов выше, чтобы применить период.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Общий свитч — виден во всех табах, но только если режим
                активный (default его не использует). */}
            {sortMode !== "default" && (
              <div className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <Label htmlFor="include-children" className="text-sm cursor-pointer">
                    Включая подкатегории
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Сортировать тем же правилом детей каждого родителя
                  </span>
                </div>
                <Switch
                  id="include-children"
                  checked={includeChildren}
                  onCheckedChange={onIncludeChildrenChange}
                />
              </div>
            )}
          </div>
        </Tabs>

        <SheetFooter className="shrink-0 flex-row gap-2 sm:gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onSortModeChange("default")
              onOpenChange(false)
            }}
            disabled={isApplying}
            className="flex-1"
          >
            Сброс
          </Button>
          <Button
            onClick={handleApply}
            disabled={isApplying}
            className="flex-1 bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            ОК
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
