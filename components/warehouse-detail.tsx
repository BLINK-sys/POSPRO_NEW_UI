"use client"

import React, { useState, useTransition, useRef, useCallback, useEffect } from "react"
import {
  type Warehouse,
  type WarehouseVariable,
  saveVariables,
  saveSingleVariable,
  saveFormula,
  deleteFormula,
  recalculateWarehouse,
  getRecalculateStatus,
  calculatePreview,
} from "@/app/actions/warehouses"
import {
  type ProductCost,
  createProductCost,
  updateProductCost,
  deleteProductCost,
} from "@/app/actions/product-costs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormulaBuilder } from "@/components/formula-builder"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Calculator,
  RefreshCw,
  GripVertical,
  Check,
  X,
  Pencil,
  Eye,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const CARD_CLASS =
  "rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface RangeRow {
  from: number
  to: number | null  // null = infinity
  value: string      // can be number or formula like "37700 + (расчётный_вес - 30) * 261"
}

interface RangeConfig {
  type: "range"
  compareVar: string
  ranges: RangeRow[]
}

function generateRangeFormula(config: RangeConfig): string {
  const { compareVar, ranges } = config
  if (!ranges.length || !compareVar) return "0"

  const sorted = [...ranges].sort((a, b) => a.from - b.from)

  if (sorted.length === 1) return sorted[0].value || "0"

  // Build from last to first: nested ternary
  // (value1) if var <= to1 else ((value2) if var <= to2 else (default))
  let formula = `(${sorted[sorted.length - 1].value || "0"})`

  for (let i = sorted.length - 2; i >= 0; i--) {
    const r = sorted[i]
    const boundary = r.to ?? r.from
    const val = r.value || "0"
    formula = `(${val}) if ${compareVar} <= ${boundary} else (${formula})`
  }

  return formula
}

// ── Zero price list with search ──
function ZeroPriceList({ reasons, total }: { reasons: Array<{ name: string; reason: string }>; total: number }) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? reasons.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : reasons

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-orange-600 font-medium">
        Товары с нулевой ценой ({total})
      </summary>
      <div className="mt-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-orange-400 mb-2"
        />
        <div className="max-h-60 overflow-y-auto space-y-0.5 pl-2">
          {filtered.map((r, i) => (
            <div key={i} className="text-gray-600">
              <span className="text-gray-400">{i + 1}.</span> {r.name} — <span className="text-orange-500">{r.reason}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-gray-400 italic">Ничего не найдено</div>
          )}
        </div>
      </div>
    </details>
  )
}

interface WarehouseDetailProps {
  initialWarehouse: Warehouse
  initialProductsCount: number
}

export function WarehouseDetail({ initialWarehouse, initialProductsCount }: WarehouseDetailProps) {
  const [warehouse] = useState(initialWarehouse)
  const [variables, setVariables] = useState<WarehouseVariable[]>(
    initialWarehouse.variables || []
  )
  const [formulaText, setFormulaText] = useState(
    initialWarehouse.formula?.formula || ""
  )
  const [deliveryFormulaText, setDeliveryFormulaText] = useState(
    initialWarehouse.formula?.delivery_formula || ""
  )
  // Опциональная формула «Себестоимость без маржи». Используется только для
  // отображения колонки в модалке «Остатки» товара. Может быть пустой —
  // тогда колонка покажет «—».
  const [costFormulaText, setCostFormulaText] = useState(
    initialWarehouse.formula?.cost_formula || ""
  )
  const [productsCount, setProductsCount] = useState(initialProductsCount)
  const [isPending, startTransition] = useTransition()
  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [newProductId, setNewProductId] = useState("")
  const [newCostPrice, setNewCostPrice] = useState("")
  const [editingCostId, setEditingCostId] = useState<number | null>(null)
  const [editCostPrice, setEditCostPrice] = useState("")
  const [deletingCost, setDeletingCost] = useState<ProductCost | null>(null)
  const [previewResult, setPreviewResult] = useState<{
    calculated_price: number
    variables: Record<string, number>
    steps?: { name: string; formula?: string; value: number }[]
  } | null>(null)
  const [previewCostPrice, setPreviewCostPrice] = useState("")
  const [previewWeight, setPreviewWeight] = useState("")
  const [previewDimensions, setPreviewDimensions] = useState("")
  const [expandedVars, setExpandedVars] = useState<Set<number>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  // ===== Variable expand/collapse =====

  const toggleExpanded = (index: number) => {
    const next = new Set(expandedVars)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedVars(next)
  }

  // ===== Drag & Drop =====

  const handleDragStart = (e: React.DragEvent, index: number) => {
    // Only allow drag from collapsed card header
    if (expandedVars.has(index)) {
      e.preventDefault()
      return
    }
    setDragIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const updated = [...variables]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    setVariables(updated)
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    if (dragIndex !== null) {
      // Auto-save order after drag
      setDragIndex(null)
      startTransition(async () => {
        const result = await saveVariables(
          warehouse.id,
          variables.map((v, i) => ({ ...v, sort_order: i }))
        )
        if (result.success) {
          toast({ title: "Порядок сохранён" })
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.message })
        }
      })
    }
  }

  // ===== Variables =====

  const addVariable = (type: "formula" | "range" = "formula") => {
    setVariables([
      ...variables,
      {
        name: "",
        label: type === "range" ? JSON.stringify({ type: "range", compareVar: "вес", ranges: [{ from: 0, to: 30, value: "0" }] }) : "",
        formula: "",
        sort_order: variables.length,
      },
    ])
    // Auto-expand new variable
    setExpandedVars(new Set([...expandedVars, variables.length]))
  }

  const isRangeVariable = (variable: WarehouseVariable) => {
    try {
      const parsed = JSON.parse(variable.label || "")
      return parsed?.type === "range"
    } catch {
      return false
    }
  }

  const getRangeConfig = (variable: WarehouseVariable) => {
    try {
      return JSON.parse(variable.label || "")
    } catch {
      return { type: "range", compareVar: "вес", ranges: [{ from: 0, to: 30, value: 0 }] }
    }
  }

  const updateRangeConfig = (index: number, config: RangeConfig) => {
    const updated = [...variables]
    updated[index] = {
      ...updated[index],
      label: JSON.stringify(config),
      formula: generateRangeFormula(config),
    }
    setVariables(updated)
  }

  const updateVariable = (index: number, field: string, value: string) => {
    const updated = [...variables]
    updated[index] = { ...updated[index], [field]: value }
    setVariables(updated)
  }

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index))
  }

  const handleSaveVariables = () => {
    // Validate
    for (const v of variables) {
      if (!v.name.trim() || !v.formula.trim()) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "У всех переменных должны быть заполнены имя и формула",
        })
        return
      }
    }

    startTransition(async () => {
      const result = await saveVariables(
        warehouse.id,
        variables.map((v, i) => ({ ...v, sort_order: i }))
      )
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
        // Reload warehouse data to sync variable names with server
        await _reloadWarehouse()
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.message })
      }
    })
  }

  const handleSaveSingleVariable = (index: number) => {
    const variable = variables[index]
    if (!variable.name.trim() || !variable.formula.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Заполните имя и формулу переменной",
      })
      return
    }

    startTransition(async () => {
      const varsAbove = variables
        .slice(0, index)
        .filter((v) => v.name.trim())
        .map((v) => v.name)

      const result = await saveSingleVariable(warehouse.id, {
        ...variable,
        sort_order: index,
        vars_above: varsAbove,
      } as any)
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
        // Update local state with server data (gets ID for new variables)
        if (result.data) {
          const updated = [...variables]
          updated[index] = result.data
          setVariables(updated)
        }
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.message })
      }
    })
  }

  const _reloadWarehouse = async () => {
    try {
      const { getWarehouse } = await import("@/app/actions/warehouses")
      const updated = await getWarehouse(warehouse.id)
      if (updated) {
        setVariables(updated.variables || [])
        if (updated.formula) {
          setFormulaText(updated.formula.formula)
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // ===== Formula =====

  const handleSaveFormula = () => {
    if (!formulaText.trim()) {
      toast({ variant: "destructive", title: "Ошибка", description: "Формула не может быть пустой" })
      return
    }
    startTransition(async () => {
      const result = await saveFormula(
        warehouse.id,
        formulaText.trim(),
        deliveryFormulaText.trim() || undefined,
        costFormulaText.trim() || undefined,
      )
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.message })
      }
    })
  }

  const handleDeleteFormula = () => {
    startTransition(async () => {
      const result = await deleteFormula(warehouse.id)
      if (result.success) {
        setFormulaText("")
        toast({ title: "Успех!", description: result.message })
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.message })
      }
    })
  }

  // ===== Preview =====

  const handlePreview = () => {
    if (!previewCostPrice) {
      toast({ variant: "destructive", title: "Ошибка", description: "Укажите себестоимость для расчёта" })
      return
    }
    startTransition(async () => {
      const result = await calculatePreview(warehouse.id, 0, Number(previewCostPrice), {
        weight: previewWeight ? Number(previewWeight) : undefined,
        dimensions: previewDimensions || undefined,
      })
      if (result.success && result.data) {
        setPreviewResult(result.data)
      } else {
        toast({ variant: "destructive", title: "Ошибка расчёта", description: result.message })
        setPreviewResult(null)
      }
    })
  }

  // ===== Recalculate =====

  const [recalcResult, setRecalcResult] = useState<{
    status: string
    started_at?: string
    finished_at?: string | null
    total: number
    processed: number
    price_calculated: number
    delivery_calculated: number
    cost_no_margin_calculated?: number
    zero_price: number
    zero_price_reasons: Array<{ name: string; reason: string }>
    error_count: number
    errors: string[]
    has_delivery_formula: boolean
    has_cost_formula?: boolean
  } | null>(null)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const recalcTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (recalcTimerRef.current) {
      clearInterval(recalcTimerRef.current)
      recalcTimerRef.current = null
    }
    setIsRecalculating(false)
  }, [])

  const startPolling = useCallback(() => {
    if (recalcTimerRef.current) clearInterval(recalcTimerRef.current)
    recalcTimerRef.current = setInterval(async () => {
      const res = await getRecalculateStatus(warehouse.id)
      if (res.success && res.data) {
        setRecalcResult(res.data)
        if (res.data.status === 'done' || res.data.status === 'error') {
          stopPolling()
          toast({
            title: res.data.status === 'done' ? "Пересчёт завершён" : "Ошибка пересчёта",
            description: res.message,
            variant: res.data.status === 'error' ? 'destructive' : undefined,
          })
        }
      }
    }, 2000)
  }, [warehouse.id, stopPolling, toast])

  // On mount: check if recalculation is running or has results
  useEffect(() => {
    const checkStatus = async () => {
      const res = await getRecalculateStatus(warehouse.id)
      if (res.success && res.data) {
        setRecalcResult(res.data)
        if (res.data.status === 'running') {
          setIsRecalculating(true)
          startPolling()
        }
      }
    }
    checkStatus()
    return () => { if (recalcTimerRef.current) clearInterval(recalcTimerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecalculate = () => {
    setRecalcResult(null)
    setIsRecalculating(true)
    startTransition(async () => {
      const result = await recalculateWarehouse(warehouse.id)
      if (result.success) {
        setRecalcResult(result.data || null)
        if (result.data?.status === 'running') {
          startPolling()
        } else {
          setIsRecalculating(false)
          toast({ title: "Пересчёт завершён", description: result.message })
        }
      } else {
        setIsRecalculating(false)
        toast({ variant: "destructive", title: "Ошибка", description: result.message })
      }
    })
  }

  // ===== Product Costs =====

  const handleAddProduct = () => {
    if (!newProductId || !newCostPrice) {
      toast({ variant: "destructive", title: "Ошибка", description: "Заполните ID товара и себестоимость" })
      return
    }
    startTransition(async () => {
      const result = await createProductCost({
        product_id: Number(newProductId),
        warehouse_id: warehouse.id,
        cost_price: Number(newCostPrice),
      })
      if (result.success && result.data) {
        toast({ title: "Успех!", description: result.message })
        setProductsCount(productsCount + 1)
        setNewProductId("")
        setNewCostPrice("")
        setIsAddingProduct(false)
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleUpdateCost = (costId: number) => {
    if (!editCostPrice) return
    startTransition(async () => {
      const result = await updateProductCost(costId, { cost_price: Number(editCostPrice) })
      if (result.success && result.data) {
        toast({ title: "Успех!", description: result.message })
        // Cost updated, count stays the same
        setEditingCostId(null)
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleDeleteCost = () => {
    if (!deletingCost) return
    startTransition(async () => {
      const result = await deleteProductCost(deletingCost.id)
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
        setProductsCount(Math.max(0, productsCount - 1))
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
      setDeletingCost(null)
    })
  }

  // ===== Built-in variables reference =====
  const builtinVars = [
    { name: "себестоимость", desc: "Себестоимость товара" },
    { name: "курс_валюты", desc: `Курс ${warehouse.currency?.code || "?"} → тг (${warehouse.currency?.rate_to_tenge || "?"})` },
    { name: "габариты", desc: "Д×Ш×В (упаковка → без упаковки, 0 если пусто)" },
    { name: "вес", desc: "Из характеристик товара" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/suppliers")}
          className="rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{warehouse.name}</h1>
          <p className="text-gray-500">
            {warehouse.supplier_name} · {warehouse.city || "Город не указан"} ·{" "}
            {warehouse.currency?.code} ({warehouse.currency?.rate_to_tenge} тг)
          </p>
        </div>
      </div>

      {/* Built-in Variables Reference */}
      <Card className={CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-lg">Встроенные переменные</CardTitle>
          <CardDescription>
            Эти переменные доступны автоматически и берутся из данных товара
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {builtinVars.map((v) => (
              <div key={v.name} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <code className="text-sm font-mono bg-white px-2 py-0.5 rounded border">
                  {v.name}
                </code>
                <span className="text-xs text-gray-500">{v.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Variables */}
      <Card className={CARD_CLASS}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Пользовательские переменные</CardTitle>
              <CardDescription>
                Промежуточные переменные для расчётов. Порядок важен — переменная может использовать только те, что выше неё.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => addVariable("formula")} className={SECONDARY_BTN}>
                <Plus className="h-4 w-4 mr-1" />
                Формула
              </Button>
              <Button variant="outline" size="sm" onClick={() => addVariable("range")} className={SECONDARY_BTN}>
                <Plus className="h-4 w-4 mr-1" />
                По диапазонам
              </Button>
              <Button size="sm" onClick={handleSaveVariables} disabled={isPending} className={PRIMARY_BTN}>
                <Save className="h-4 w-4 mr-1" />
                Сохранить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {variables.length > 0 ? (
            <div className="space-y-2">
              {variables.map((variable, index) => {
                const isExpanded = expandedVars.has(index)
                return (
                  <div
                    key={index}
                    draggable={!isExpanded}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "rounded-xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-all",
                      dragIndex === index && "opacity-50 shadow-[0_8px_20px_rgba(0,0,0,0.15)]",
                      !isExpanded && "cursor-grab active:cursor-grabbing"
                    )}
                  >
                    {/* Collapsed header */}
                    <div
                      className="flex items-center gap-3 p-3 select-none"
                      onClick={() => toggleExpanded(index)}
                    >
                      <div className="text-gray-400">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <span className="text-xs text-gray-400 w-4">{index + 1}</span>
                      <code className="font-mono text-sm font-semibold text-blue-700">
                        {variable.name || "без имени"}
                      </code>
                      {variable.label && (
                        <span className="text-xs text-gray-500">— {variable.label}</span>
                      )}
                      {isRangeVariable(variable) ? (
                        <Badge variant="outline" className="ml-auto text-xs bg-amber-50 text-amber-700 border-amber-200">
                          По диапазонам · {getRangeConfig(variable).compareVar}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400 ml-auto font-mono truncate max-w-[300px]">
                          = {variable.formula || "..."}
                        </span>
                      )}
                      <svg
                        className={cn(
                          "h-4 w-4 text-gray-400 transition-transform shrink-0",
                          isExpanded && "rotate-180"
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t space-y-3">
                        {isRangeVariable(variable) ? (
                          /* Range variable UI */
                          <>
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Имя переменной</Label>
                                <Input
                                  value={variable.name}
                                  onChange={(e) => updateVariable(index, "name", e.target.value)}
                                  placeholder="тариф_доставки"
                                  className={cn("font-mono text-sm", SOFT_CONTROL)}
                                  disabled={isPending}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Сравнивать с переменной</Label>
                                <Select
                                  value={getRangeConfig(variable).compareVar}
                                  onValueChange={(val) => {
                                    const config = getRangeConfig(variable)
                                    updateRangeConfig(index, { ...config, compareVar: val })
                                  }}
                                  disabled={isPending}
                                >
                                  <SelectTrigger className={cn("text-sm", SOFT_CONTROL)}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {builtinVars.map((v) => (
                                      <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                                    ))}
                                    {variables.slice(0, index).filter((v) => v.name.trim()).map((v) => (
                                      <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Range table */}
                            <div className="space-y-2">
                              <Label className="text-xs">Диапазоны</Label>
                              <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">От</th>
                                      <th className="px-3 py-2 text-left font-medium">До</th>
                                      <th className="px-3 py-2 text-left font-medium">Значение / Формула</th>
                                      <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {getRangeConfig(variable).ranges.map((range: RangeRow, ri: number) => (
                                      <tr key={ri} className="border-t">
                                        <td className="px-3 py-1.5">
                                          <Input
                                            type="number"
                                            value={range.from}
                                            onChange={(e) => {
                                              const config = getRangeConfig(variable)
                                              const ranges = [...config.ranges]
                                              ranges[ri] = { ...ranges[ri], from: Number(e.target.value) }
                                              updateRangeConfig(index, { ...config, ranges })
                                            }}
                                            className="h-8 text-sm"
                                            disabled={isPending}
                                          />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          {ri === getRangeConfig(variable).ranges.length - 1 ? (
                                            <span className="text-gray-400 text-sm">∞</span>
                                          ) : (
                                            <Input
                                              type="number"
                                              value={range.to ?? ""}
                                              onChange={(e) => {
                                                const config = getRangeConfig(variable)
                                                const ranges = [...config.ranges]
                                                ranges[ri] = { ...ranges[ri], to: e.target.value ? Number(e.target.value) : null }
                                                updateRangeConfig(index, { ...config, ranges })
                                              }}
                                              className="h-8 text-sm"
                                              disabled={isPending}
                                            />
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <div className="space-y-1">
                                            <Input
                                              value={range.value}
                                              onChange={(e) => {
                                                const config = getRangeConfig(variable)
                                                const ranges = [...config.ranges]
                                                ranges[ri] = { ...ranges[ri], value: e.target.value }
                                                updateRangeConfig(index, { ...config, ranges })
                                              }}
                                              placeholder="37700 или формула"
                                              className="h-8 text-sm font-mono"
                                              disabled={isPending}
                                            />
                                            <div className="space-y-0.5">
                                              <div className="flex flex-wrap gap-0.5">
                                                {builtinVars.map((v) => (
                                                  <button
                                                    key={v.name}
                                                    type="button"
                                                    className="px-1.5 py-0 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                                                    onClick={() => {
                                                      const config = getRangeConfig(variable)
                                                      const ranges = [...config.ranges]
                                                      const cur = ranges[ri].value || ""
                                                      ranges[ri] = { ...ranges[ri], value: cur + (cur && !cur.endsWith(" ") && !cur.endsWith("(") ? " " : "") + v.name }
                                                      updateRangeConfig(index, { ...config, ranges })
                                                    }}
                                                    disabled={isPending}
                                                  >
                                                    {v.name}
                                                  </button>
                                                ))}
                                              </div>
                                              {variables.slice(0, index).filter((v) => v.name.trim()).length > 0 && (
                                                <div className="flex flex-wrap gap-0.5">
                                                  {variables.slice(0, index).filter((v) => v.name.trim()).map((v) => (
                                                    <button
                                                      key={v.name}
                                                      type="button"
                                                      className="px-1.5 py-0 text-[10px] rounded bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                                                      onClick={() => {
                                                        const config = getRangeConfig(variable)
                                                        const ranges = [...config.ranges]
                                                        const cur = ranges[ri].value || ""
                                                        ranges[ri] = { ...ranges[ri], value: cur + (cur && !cur.endsWith(" ") && !cur.endsWith("(") ? " " : "") + v.name }
                                                        updateRangeConfig(index, { ...config, ranges })
                                                      }}
                                                      disabled={isPending}
                                                    >
                                                      {v.name}
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                              <div className="flex flex-wrap gap-0.5">
                                                {["+", "-", "*", "/", "(", ")"].map((op) => (
                                                  <button
                                                    key={op}
                                                    type="button"
                                                    className="px-1.5 py-0 text-[10px] rounded bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 font-bold"
                                                    onClick={() => {
                                                      const config = getRangeConfig(variable)
                                                      const ranges = [...config.ranges]
                                                      const cur = ranges[ri].value || ""
                                                      ranges[ri] = { ...ranges[ri], value: cur + (cur && !cur.endsWith(" ") && !cur.endsWith("(") && op !== ")" ? " " : "") + op }
                                                      updateRangeConfig(index, { ...config, ranges })
                                                    }}
                                                    disabled={isPending}
                                                  >
                                                    {op === "*" ? "×" : op === "/" ? "÷" : op}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-3 py-1.5">
                                          {getRangeConfig(variable).ranges.length > 1 && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={() => {
                                                const config = getRangeConfig(variable)
                                                const ranges = config.ranges.filter((_: RangeRow, i: number) => i !== ri)
                                                updateRangeConfig(index, { ...config, ranges })
                                              }}
                                              disabled={isPending}
                                            >
                                              <Trash2 className="h-3 w-3 text-red-500" />
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const config = getRangeConfig(variable)
                                  const ranges = [...config.ranges]
                                  const lastTo = ranges.length > 0 ? (ranges[ranges.length - 1].to ?? ranges[ranges.length - 1].from + 100) : 0
                                  // Make previous last row have a "to" value
                                  if (ranges.length > 0 && ranges[ranges.length - 1].to === null) {
                                    ranges[ranges.length - 1] = { ...ranges[ranges.length - 1], to: lastTo }
                                  }
                                  ranges.push({ from: lastTo, to: null, value: "0" })
                                  updateRangeConfig(index, { ...config, ranges })
                                }}
                                disabled={isPending}
                                className={SECONDARY_BTN}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Добавить диапазон
                              </Button>
                            </div>

                            {/* Generated formula preview */}
                            <details className="text-xs">
                              <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
                                Сгенерированная формула
                              </summary>
                              <code className="block mt-1 p-2 bg-gray-100 rounded text-xs font-mono break-all">
                                {variable.formula || "—"}
                              </code>
                            </details>
                          </>
                        ) : (
                          /* Regular formula variable UI */
                          <>
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Имя переменной</Label>
                                <Input
                                  value={variable.name}
                                  onChange={(e) => updateVariable(index, "name", e.target.value)}
                                  placeholder="доставка"
                                  className={cn("font-mono text-sm", SOFT_CONTROL)}
                                  disabled={isPending}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Описание</Label>
                                <Input
                                  value={variable.label || ""}
                                  onChange={(e) => updateVariable(index, "label", e.target.value)}
                                  placeholder="Стоимость доставки за кг"
                                  className={cn("text-sm", SOFT_CONTROL)}
                                  disabled={isPending}
                                />
                              </div>
                            </div>
                            <FormulaBuilder
                              value={variable.formula}
                              onChange={(val) => updateVariable(index, "formula", val)}
                              label={variable.name ? `${variable.name} =` : "Формула"}
                              builtinVariables={builtinVars.map((v) => ({ name: v.name, label: v.desc }))}
                              customVariables={variables
                                .slice(0, index)
                                .filter((v) => v.name.trim())
                                .map((v) => ({ name: v.name, label: v.label || undefined }))}
                              disabled={isPending}
                            />
                          </>
                        )}
                        <div className="flex justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariable(index)}
                            disabled={isPending}
                            className="rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Удалить
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveSingleVariable(index)}
                            disabled={isPending}
                            className={PRIMARY_BTN}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Сохранить
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              Нет пользовательских переменных. Добавьте для создания промежуточных расчётов.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Final Formula */}
      <Card className={CARD_CLASS}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Итоговая формула цены</CardTitle>
              <CardDescription>
                Результат этой формулы = цена товара в тенге. Используйте встроенные и пользовательские переменные.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {formulaText && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteFormula}
                  disabled={isPending}
                  className={cn("text-red-500", SECONDARY_BTN)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Удалить
                </Button>
              )}
              <Button size="sm" onClick={handleSaveFormula} disabled={isPending} className={PRIMARY_BTN}>
                <Save className="h-4 w-4 mr-1" />
                Сохранить формулу
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormulaBuilder
            value={formulaText}
            onChange={setFormulaText}
            label="Цена ="
            builtinVariables={builtinVars.map((v) => ({ name: v.name, label: v.desc }))}
            customVariables={variables
              .filter((v) => v.name.trim())
              .map((v) => ({ name: v.name, label: v.label || undefined }))}
            disabled={isPending}
          />

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Формула доставки за единицу (необязательно)</h4>
            <FormulaBuilder
              value={deliveryFormulaText}
              onChange={setDeliveryFormulaText}
              label="Доставка ="
              builtinVariables={builtinVars.map((v) => ({ name: v.name, label: v.desc }))}
              customVariables={variables
                .filter((v) => v.name.trim())
                .map((v) => ({ name: v.name, label: v.label || undefined }))}
              disabled={isPending}
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">
              Формула «Себестоимость без маржи» (необязательно)
            </h4>
            <p className="text-xs text-gray-500 mb-2">
              Используется только для отображения в модалке «Остатки» товара —
              чтобы видеть сколько единица реально стоит без наценки. Принципы те же,
              что у формулы цены: учитывает габариты, вес и переменные склада.
              Если не задана — колонка «Себестоимость» в остатках будет пустой.
            </p>
            <FormulaBuilder
              value={costFormulaText}
              onChange={setCostFormulaText}
              label="Себестоимость ="
              builtinVariables={builtinVars.map((v) => ({ name: v.name, label: v.desc }))}
              customVariables={variables
                .filter((v) => v.name.trim())
                .map((v) => ({ name: v.name, label: v.label || undefined }))}
              disabled={isPending}
            />
          </div>

          {/* Preview */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Предварительный расчёт</h4>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Себестоимость ({warehouse.currency?.code})</Label>
                <Input
                  value={previewCostPrice}
                  onChange={(e) => setPreviewCostPrice(e.target.value)}
                  placeholder="100000"
                  className={cn("w-[160px]", SOFT_CONTROL)}
                  type="number"
                  step="0.01"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Вес (кг)</Label>
                <Input
                  value={previewWeight}
                  onChange={(e) => setPreviewWeight(e.target.value)}
                  placeholder="50"
                  className={cn("w-[100px]", SOFT_CONTROL)}
                  type="number"
                  step="0.01"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Габариты (Д×Ш×В мм)</Label>
                <Input
                  value={previewDimensions}
                  onChange={(e) => setPreviewDimensions(e.target.value)}
                  placeholder="340х465х425"
                  className={cn("w-[160px]", SOFT_CONTROL)}
                  disabled={isPending}
                />
              </div>
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={isPending || !previewCostPrice}
                className={SECONDARY_BTN}
              >
                <Eye className="h-4 w-4 mr-1" />
                Рассчитать
              </Button>
            </div>
            {previewResult && (
              <div className="mt-3 p-4 bg-green-50 rounded-xl border border-green-200 shadow-[0_1px_3px_rgba(34,197,94,0.10)] space-y-3">
                <p className="font-semibold text-green-700 text-xl">
                  Итоговая цена: {previewResult.calculated_price.toLocaleString("ru-RU")} тг
                </p>
                {previewResult.steps && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-gray-600">Пошаговый расчёт:</p>
                    {previewResult.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-green-100 last:border-0">
                        <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                        <span className="font-medium text-gray-700 min-w-[150px]">{step.name}</span>
                        {step.formula && (
                          <code className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded border break-all">
                            {step.formula}
                          </code>
                        )}
                        <span className="text-gray-400 ml-auto">=</span>
                        <span className="font-mono font-semibold text-gray-800">
                          {step.value.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Costs */}
      <Card className={CARD_CLASS}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Товары на складе «{warehouse.name}»</CardTitle>
              <CardDescription>
                Привязано товаров: <span className="font-semibold text-gray-900">{productsCount.toLocaleString("ru-RU")}</span>
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={isPending || isRecalculating}
              className={SECONDARY_BTN}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRecalculating ? 'animate-spin' : ''}`} />
              {isRecalculating && recalcResult
                ? `${recalcResult.processed}/${recalcResult.total}`
                : 'Пересчитать все'}
            </Button>
          </div>

          {/* Recalculation results */}
          {recalcResult && (
            <div className="px-6 pb-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-3 bg-gray-50 rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {/* Status header */}
                <span className="text-gray-500">Статус:</span>
                <span className={`font-medium ${recalcResult.status === 'running' ? 'text-blue-600' : recalcResult.status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {recalcResult.status === 'running' ? `Выполняется ${recalcResult.processed}/${recalcResult.total}...` : recalcResult.status === 'error' ? 'Ошибка' : 'Завершено'}
                </span>
                {recalcResult.finished_at && (
                  <>
                    <span className="text-gray-500">Дата:</span>
                    <span className="text-gray-700">{new Date(recalcResult.finished_at).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}</span>
                  </>
                )}
                {Array.isArray((recalcResult as any).rate_refreshed) && (recalcResult as any).rate_refreshed
                  .filter((r: any) => r.code === warehouse.currency?.code)
                  .map((r: any) => (
                  <React.Fragment key={r.code}>
                    <span className="text-gray-500">Курс {r.code}:</span>
                    <span className="font-medium">{r.old === r.new ? r.new : `${r.old} → ${r.new}`}</span>
                  </React.Fragment>
                ))}
                <span className="text-gray-500">Всего товаров:</span>
                <span className="font-medium">{recalcResult.total}</span>
                <span className="text-gray-500">Цена рассчитана:</span>
                <span className="font-medium text-green-600">{recalcResult.price_calculated}</span>
                {recalcResult.has_delivery_formula && (
                  <>
                    <span className="text-gray-500">Доставка рассчитана:</span>
                    <span className="font-medium text-blue-600">{recalcResult.delivery_calculated}</span>
                  </>
                )}
                {recalcResult.has_cost_formula && (
                  <>
                    <span className="text-gray-500">Себестоимость рассчитана:</span>
                    <span className="font-medium text-purple-600">{recalcResult.cost_no_margin_calculated ?? 0}</span>
                  </>
                )}
                {recalcResult.zero_price > 0 && (
                  <>
                    <span className="text-gray-500">Нулевая цена:</span>
                    <span className="font-medium text-orange-500">{recalcResult.zero_price}</span>
                  </>
                )}
                {recalcResult.error_count > 0 && (
                  <>
                    <span className="text-gray-500">Ошибки:</span>
                    <span className="font-medium text-red-500">{recalcResult.error_count}</span>
                  </>
                )}
              </div>

              {/* Zero price details */}
              {recalcResult.zero_price_reasons.length > 0 && (
                <ZeroPriceList reasons={recalcResult.zero_price_reasons} total={recalcResult.zero_price} />
              )}

              {/* Error details */}
              {recalcResult.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-red-600 font-medium">
                    Ошибки расчёта ({recalcResult.error_count})
                  </summary>
                  <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5 pl-2">
                    {recalcResult.errors.map((err, i) => (
                      <div key={i} className="text-red-500">{i + 1}. {err}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Add Product Dialog */}
      <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить товар на склад</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ID товара <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                placeholder="123"
                disabled={isPending}
                className={SOFT_CONTROL}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Себестоимость ({warehouse.currency?.code}) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(e.target.value)}
                placeholder="500"
                disabled={isPending}
                className={SOFT_CONTROL}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddingProduct(false)}
              disabled={isPending}
              className={SECONDARY_BTN}
            >
              Отмена
            </Button>
            <Button onClick={handleAddProduct} disabled={isPending} className={PRIMARY_BTN}>
              {isPending ? "Добавление..." : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Cost Dialog */}
      <DeleteConfirmationDialog
        open={!!deletingCost}
        onOpenChange={(open) => !open && setDeletingCost(null)}
        onConfirm={handleDeleteCost}
        title={`Удалить себестоимость для "${deletingCost?.product_name}"?`}
        description="Рассчитанная цена для этого товара на этом складе будет удалена."
      />
    </div>
  )
}
