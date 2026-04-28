'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus, ArrowLeft, Check } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useKP, KPItem, WarehousePriceOption } from '@/context/kp-context'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { getCurrencies, refreshRates } from '@/app/actions/currencies'
import { Save, Loader2 as Loader2Icon, HelpCircle, X as XIcon } from 'lucide-react'
// ── Format: round up to nearest 100, no decimals ──
function fmt(value: number): string {
  return Math.ceil(value).toLocaleString('ru-RU')
}

// ── Text cell with modal edit + tooltip ──────────
function TextCell({ value, onChange, placeholder = '—' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleOpen = () => { setDraft(value); setOpen(true) }
  const handleSave = () => { onChange(draft); setOpen(false) }

  return (
    <>
      <td
        className="border px-1 py-1 cursor-pointer hover:bg-blue-50/50 relative group"
        onClick={handleOpen}
        title={value || undefined}
      >
        <span className="text-[10px] text-gray-600 line-clamp-1">{value || <span className="text-gray-300">{placeholder}</span>}</span>
      </td>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-80 p-4" onClick={e => e.stopPropagation()}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400 resize-none"
              autoFocus
              placeholder={placeholder}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Отмена</button>
              <button onClick={handleSave} className="px-3 py-1 text-xs bg-brand-yellow hover:bg-yellow-500 rounded-full font-medium">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Date cell with calendar + today + manual input ──
function DateCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleOpen = () => { setDraft(value); setOpen(true) }
  const handleSave = () => { onChange(draft); setOpen(false) }
  const handleToday = () => {
    const today = new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty' })
    setDraft(today)
  }
  const handleCalendar = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [y, m, d] = e.target.value.split('-')
      setDraft(`${d}.${m}.${y}`)
    }
  }

  return (
    <>
      <td
        className="border px-1 py-1 cursor-pointer hover:bg-blue-50/50"
        onClick={handleOpen}
        title={value || undefined}
      >
        <span className="text-[10px] text-gray-600 line-clamp-1">{value || <span className="text-gray-300">—</span>}</span>
      </td>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-72 p-4" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-gray-500 font-medium">Дата оплаты</label>
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400 mt-1"
              autoFocus
              placeholder="дд.мм.гггг"
            />
            <div className="flex gap-2 mt-2">
              <input
                type="date"
                onChange={handleCalendar}
                className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-400"
              />
              <button onClick={handleToday} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded font-medium">Сегодня</button>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setOpen(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Отмена</button>
              <button onClick={handleSave} className="px-3 py-1 text-xs bg-brand-yellow hover:bg-yellow-500 rounded-full font-medium">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Types ────────────────────────────────────────
interface CalcItem {
  kpId: string
  productId: number
  name: string
  description?: string
  quantity: number
  costPrice: number        // raw cost in original currency (without VAT)
  currencyCode: string     // 'RUB', 'KZT', 'USD', etc.
  costPriceKzt: number     // cost converted to KZT, INCLUDES per-item VAT
  vatRate: number          // per-item VAT rate (%). Default 16; 0 = no VAT
  deliveryPerUnit: number  // manual input
  costPerUnitOverride: number | null    // manual override for cost per unit
  contractPerUnitOverride: number | null // manual override for contract price per unit
  supplierName: string
  warehouseName: string
  // Editable text fields
  paymentDate: string
  deliveryTerms: string
  paymentTerms: string
  note: string
}

const DEFAULT_VAT_RATE = 16

interface ExpenseItem {
  id: string
  name: string
  amount: number
}

// ── Helpers ──────────────────────────────────────
function buildCalcItems(kpItems: KPItem[], defaultVatRate: number = DEFAULT_VAT_RATE): CalcItem[] {
  return kpItems.map(item => {
    const selectedWp = item.warehousePrices?.find(
      wp => wp.warehouse_id === item.selectedWarehouseId
    ) || item.warehousePrices?.[0]

    const costPrice = selectedWp?.cost_price || 0
    const currencyCode = selectedWp?.currency_code || 'KZT'
    const calculatedDelivery = Math.ceil(selectedWp?.calculated_delivery || 0)
    const vatRate = defaultVatRate
    const vatMul = 1 + vatRate / 100

    return {
      kpId: item.kpId,
      productId: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      costPrice,
      currencyCode,
      // For KZT we apply VAT immediately. For non-KZT this happens in
      // handleApplyRates after the FX rate is set.
      costPriceKzt: currencyCode === 'KZT' ? costPrice * vatMul : 0,
      vatRate,
      deliveryPerUnit: calculatedDelivery,
      costPerUnitOverride: null,
      contractPerUnitOverride: null,
      supplierName: selectedWp?.supplier_name || item.supplier_name || '',
      warehouseName: selectedWp?.warehouse_name || '',
      paymentDate: '',
      deliveryTerms: '',
      paymentTerms: '',
      note: '',
    }
  })
}

// ══════════════════════════════════════════════════
export default function CalculatorPage() {
  const { user } = useAuth()
  const { kpItems, calculatorData, setCalculatorData, activeHistoryId, saveToHistory, updateItem: updateKpItem } = useKP()
  const router = useRouter()
  const { toast } = useToast()

  const isSystemUser = user?.role === 'admin' || user?.role === 'system'

  const [items, setItems] = useState<CalcItem[]>([])
  const [vatRate, setVatRate] = useState(16)
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({})
  const [ratesApplied, setRatesApplied] = useState(false)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [saving, setSaving] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Init: load from saved calculatorData or build from KP items
  // Also merge in any new KP items not yet in calculator
  useEffect(() => {
    const isFromHistory = !!calculatorData?.items

    const globalVat = calculatorData?.vatRate ?? DEFAULT_VAT_RATE

    if (isFromHistory) {
      // Restore saved state — keep saved currency rates
      const savedItems: CalcItem[] = calculatorData.items
      if (calculatorData.vatRate !== undefined) setVatRate(calculatorData.vatRate)
      if (calculatorData.currencyRates) setCurrencyRates(calculatorData.currencyRates)
      if (calculatorData.ratesApplied !== undefined) setRatesApplied(calculatorData.ratesApplied)
      if (calculatorData.expenses) setExpenses(calculatorData.expenses)

      // Merge: add new KP items that aren't in saved calculator
      const savedKpIds = new Set(savedItems.map(i => i.kpId))
      const savedRates = calculatorData.currencyRates || {}
      const newItems = kpItems
        .filter(kpItem => !savedKpIds.has(kpItem.kpId))
        .map(kpItem => {
          const item = buildCalcItems([kpItem], globalVat)[0]
          if (item.currencyCode !== 'KZT' && savedRates[item.currencyCode]) {
            // costPriceKzt = supplier × rate × (1 + vat/100)
            item.costPriceKzt = item.costPrice * savedRates[item.currencyCode] * (1 + (item.vatRate ?? globalVat) / 100)
          }
          return item
        })

      const currentKpIds = new Map(kpItems.map(i => [i.kpId, i]))
      const filtered = savedItems
        .filter(i => currentKpIds.has(i.kpId))
        .map(i => {
          const kpItem = currentKpIds.get(i.kpId)!
          const updates: Partial<CalcItem> = {}
          if (kpItem.quantity !== i.quantity) updates.quantity = kpItem.quantity
          if (kpItem.name !== i.name) updates.name = kpItem.name
          // Migration: items saved before per-item VAT existed have no vatRate
          // and their costPriceKzt was stored without VAT. Apply VAT now so the
          // updated formula stays consistent with the pre-existing values.
          if (i.vatRate === undefined) {
            updates.vatRate = globalVat
            updates.costPriceKzt = i.costPriceKzt * (1 + globalVat / 100)
          }
          return Object.keys(updates).length > 0 ? { ...i, ...updates } : i
        })

      setItems([...filtered, ...newItems])
    } else if (kpItems.length > 0) {
      // New calculator — build items and load rates from currency catalog
      const newItems = buildCalcItems(kpItems, globalVat)
      setItems(newItems)

      // Detect foreign currencies and fetch rates from catalog
      const foreignCodes = new Set<string>()
      newItems.forEach(item => {
        if (item.currencyCode !== 'KZT') foreignCodes.add(item.currencyCode)
      })

      if (foreignCodes.size > 0) {
        // First refresh RUB rate from Halyk Bank, then load all from catalog
        const loadRates = async () => {
          // Refresh all rates from Halyk Bank first
          await refreshRates().catch(() => {})
          const currencies = await getCurrencies()
          const rates: Record<string, number> = {}
          currencies.forEach(c => {
            if (foreignCodes.has(c.code) && c.rate_to_tenge > 0) {
              rates[c.code] = c.rate_to_tenge
            }
          })
          if (Object.keys(rates).length > 0) {
            setCurrencyRates(rates)
            setItems(prev => prev.map(item => {
              const vatMul = 1 + (item.vatRate ?? DEFAULT_VAT_RATE) / 100
              if (item.currencyCode === 'KZT') return { ...item, costPriceKzt: item.costPrice * vatMul }
              const rate = rates[item.currencyCode] || 0
              return { ...item, costPriceKzt: item.costPrice * rate * vatMul }
            }))
            setRatesApplied(true)
          }
        }
        loadRates()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build calculator data object for saving
  const buildSaveData = useCallback(() => ({
    vatRate,
    currencyRates,
    ratesApplied,
    items,
    expenses,
  }), [vatRate, currencyRates, ratesApplied, items, expenses])

  // Auto-save to context on every change (survives page navigation)
  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return }
    setCalculatorData(buildSaveData())
  }, [vatRate, currencyRates, ratesApplied, items, expenses]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save calculator data (auto-saves KP to history if needed)
  const handleSave = useCallback(async () => {
    const data = buildSaveData()
    setCalculatorData(data)
    setSaving(true)
    try {
      const success = await saveToHistory(undefined, data)
      if (success) {
        toast({ title: 'Сохранено', description: 'Расчётник и КП сохранены' })
      } else {
        toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось сохранить' })
      }
    } finally {
      setSaving(false)
    }
  }, [buildSaveData, setCalculatorData, saveToHistory, toast])

  // Redirect non-system users
  useEffect(() => {
    if (user && !isSystemUser) router.push('/')
  }, [user, isSystemUser, router])

  // Detect unique currencies (non-KZT)
  const foreignCurrencies = useMemo(() => {
    const codes = new Set<string>()
    items.forEach(item => {
      if (item.currencyCode !== 'KZT') codes.add(item.currencyCode)
    })
    return Array.from(codes).sort()
  }, [items])

  // Apply currency rates (and per-item VAT to get final costPriceKzt)
  const handleApplyRates = useCallback(() => {
    setItems(prev => prev.map(item => {
      const vatMul = 1 + (item.vatRate ?? DEFAULT_VAT_RATE) / 100
      if (item.currencyCode === 'KZT') {
        return { ...item, costPriceKzt: item.costPrice * vatMul }
      }
      const rate = currencyRates[item.currencyCode] || 0
      return { ...item, costPriceKzt: item.costPrice * rate * vatMul }
    }))
    setRatesApplied(true)
  }, [currencyRates])

  // Toggle per-item VAT on/off. ON  → vatRate = DEFAULT_VAT_RATE (16%),
  //                            OFF → vatRate = 0. Re-applies to costPriceKzt so
  // Себестоимость За ед. = supplier × rate × (1 + vatRate/100).
  const toggleItemVat = useCallback((kpId: string, enabled: boolean) => {
    const newVat = enabled ? DEFAULT_VAT_RATE : 0
    setItems(prev => prev.map(item => {
      if (item.kpId !== kpId) return item
      const oldVat = item.vatRate ?? DEFAULT_VAT_RATE
      if (oldVat === newVat) return item
      const baseKzt = item.costPriceKzt / (1 + oldVat / 100)
      return {
        ...item,
        vatRate: newVat,
        costPriceKzt: baseKzt * (1 + newVat / 100),
      }
    }))
  }, [])

  // Update single item field
  const updateItem = useCallback((kpId: string, field: keyof CalcItem, value: any) => {
    setItems(prev => prev.map(item =>
      item.kpId === kpId ? { ...item, [field]: value } : item
    ))
  }, [])

  // Expenses
  const addExpense = useCallback(() => {
    setExpenses(prev => [...prev, { id: `exp-${Date.now()}`, name: '', amount: 0 }])
  }, [])

  const updateExpense = useCallback((id: string, field: 'name' | 'amount', value: any) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }, [])

  const removeExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
  }, [])

  // ── Calculations ───────────────────────────────
  // The global vatRate is used only as a default for newly-added items;
  // each row carries its own item.vatRate which drives all VAT math.

  const calcRow = useCallback((item: CalcItem) => {
    const delivery = item.deliveryPerUnit
    const itemVatMul = (item.vatRate ?? DEFAULT_VAT_RATE) / 100

    // Себестоимость (override or auto). costPriceKzt already includes VAT.
    const costPerUnit = item.costPerUnitOverride !== null ? item.costPerUnitOverride : item.costPriceKzt
    const costTotal = costPerUnit * item.quantity
    const costNoVat = costPerUnit / (1 + itemVatMul)
    const costVat = costPerUnit - costNoVat
    const costTotalNoVat = costNoVat * item.quantity
    const costTotalVat = costVat * item.quantity

    // Сумма контракта (override or auto)
    let contractPerUnit: number
    let contractNoVat: number
    let contractVat: number
    if (item.contractPerUnitOverride !== null) {
      contractPerUnit = item.contractPerUnitOverride
      contractNoVat = contractPerUnit / (1 + itemVatMul)
      contractVat = contractPerUnit - contractNoVat
    } else {
      contractNoVat = costPerUnit + delivery
      contractVat = contractNoVat * itemVatMul
      contractPerUnit = contractNoVat + contractVat
    }
    const contractTotal = contractPerUnit * item.quantity

    // Разница (показывать только если себестоимость изменена вручную)
    const costChanged = item.costPerUnitOverride !== null
    const origCostPerUnit = item.costPriceKzt
    const origCostTotal = origCostPerUnit * item.quantity
    const origCostNoVat = origCostPerUnit / (1 + itemVatMul)
    const origCostVat = origCostPerUnit - origCostNoVat

    // Пересчёт контракта на основе оригинальной себестоимости (для сравнения)
    let origContractNoVat = origCostPerUnit + delivery
    let origContractVat = origContractNoVat * itemVatMul
    let origContractPerUnit = origContractNoVat + origContractVat
    if (item.contractPerUnitOverride !== null) {
      origContractPerUnit = item.contractPerUnitOverride
      origContractNoVat = origContractPerUnit / (1 + itemVatMul)
      origContractVat = origContractPerUnit - origContractNoVat
    }
    const origContractTotal = origContractPerUnit * item.quantity

    // Diff: новое - оригинальное (по всем колонкам)
    const diffContractPerUnit = contractPerUnit - origContractPerUnit
    const diffContractTotal = contractTotal - origContractTotal
    const diffContractNoVat = (contractNoVat * item.quantity) - (origContractNoVat * item.quantity)
    const diffContractVat = (contractVat * item.quantity) - (origContractVat * item.quantity)
    const diffCostPerUnit = costPerUnit - origCostPerUnit
    const diffCostTotal = costTotal - origCostTotal
    const diffCostNoVat = costTotalNoVat - (origCostNoVat * item.quantity)
    const diffCostVat = costTotalVat - (origCostVat * item.quantity)

    return {
      costPerUnit, costTotal, costNoVat, costVat, costTotalNoVat, costTotalVat,
      contractPerUnit, contractTotal, contractNoVat, contractVat,
      costChanged,
      diffContractPerUnit, diffContractTotal, diffContractNoVat, diffContractVat,
      diffCostPerUnit, diffCostTotal, diffCostNoVat, diffCostVat,
    }
  }, [])

  // ── Totals ─────────────────────────────────────
  const totals = useMemo(() => {
    let contractTotalSum = 0
    let contractVatSum = 0
    let costTotalSum = 0
    let costVatSum = 0
    let deliveryTotalSum = 0

    items.forEach(item => {
      const r = calcRow(item)
      contractTotalSum += r.contractTotal
      contractVatSum += r.contractVat * item.quantity
      costTotalSum += r.costTotal
      costVatSum += r.costVat * item.quantity
      deliveryTotalSum += (item.deliveryPerUnit || 0) * item.quantity
    })

    const expensesTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    // Налоги = (НДС контракта − НДС себестоимости) + (((Итого контракта − Итого себестоимости) − Итого доставка) / 5)
    const taxes = (contractVatSum - costVatSum) + ((contractTotalSum - costTotalSum - deliveryTotalSum) / 5)

    return { contractTotalSum, costTotalSum, expensesTotal, taxes, deliveryTotalSum }
  }, [items, expenses, calcRow])

  // Push current "Сумма контракта за ед." for every row back into the KP
  // items, so opening the KP page sees the freshly negotiated prices.
  const syncCalcPricesToKp = useCallback(() => {
    items.forEach(item => {
      const r = calcRow(item)
      const newPrice = Math.round(r.contractPerUnit)
      if (newPrice > 0) {
        updateKpItem(item.kpId, { price: newPrice })
      }
    })
  }, [items, calcRow, updateKpItem])

  const handleBackToKp = useCallback(() => {
    syncCalcPricesToKp()
    router.push('/kp')
  }, [syncCalcPricesToKp, router])

  if (!isSystemUser) return null

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="max-w-[1600px] mx-auto mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={handleBackToKp} className="rounded-full border-black [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]">
            <ArrowLeft className="h-4 w-4 mr-1" /> Назад к КП
          </Button>
          <h1 className="text-lg font-bold flex-1">Корпоративный расчётник</h1>
          <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-full bg-white hover:bg-yellow-50 text-black border border-yellow-400 [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]">
            {saving ? <Loader2Icon className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Сохранить
          </Button>
          <Button size="sm" onClick={() => setShowHelp(true)} className="rounded-full bg-white hover:bg-blue-50 text-black border border-blue-400 [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]">
            <HelpCircle className="h-4 w-4 mr-1" />
            Справка
          </Button>
        </div>

        {/* Settings bar */}
        <div className="flex flex-wrap items-end gap-4 p-4 bg-white rounded-xl border shadow-sm mb-4">
          {/* VAT rate */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Ставка НДС (%)</Label>
            <Input
              type="number"
              value={vatRate}
              onChange={e => setVatRate(parseFloat(e.target.value) || 0)}
              className="w-24 h-8 text-sm"
            />
          </div>

          {/* Currency rates */}
          {foreignCurrencies.map(code => (
            <div key={code} className="space-y-1">
              <Label className="text-xs text-gray-500">Курс {code} → KZT</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  value={currencyRates[code] || ''}
                  onChange={e => setCurrencyRates(prev => ({ ...prev, [code]: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="w-28 h-8 text-sm"
                />
              </div>
            </div>
          ))}

          {foreignCurrencies.length > 0 && (
            <Button size="sm" onClick={handleApplyRates} className="h-8 bg-white hover:bg-yellow-50 text-black rounded-full border border-yellow-400 [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]">
              <Check className="h-3 w-3 mr-1" /> Пересчитать
            </Button>
          )}

          {ratesApplied && (
            <span className="text-xs text-green-600 self-end pb-1">Курсы применены</span>
          )}
        </div>
      </div>

      {/* Main table */}
      <div className="max-w-[1600px] mx-auto overflow-x-auto">
        <table className="w-full border-collapse text-[10px] bg-white rounded-xl border shadow-sm table-fixed">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border px-1 py-1 text-center w-7">№</th>
              <th rowSpan={2} className="border px-1 py-1 text-left w-[140px]">Наименование</th>
              <th rowSpan={2} className="border px-1 py-1 text-center w-14 whitespace-nowrap">Кол-во</th>
              <th colSpan={4} className="border px-1 py-1 text-center bg-blue-50">Сумма контракта</th>
              <th colSpan={4} className="border px-1 py-1 text-center bg-green-50">Себестоимость</th>
              <th rowSpan={2} className="border px-1 py-1 text-left w-[70px]">Поставщик</th>
              <th rowSpan={2} className="border px-1 py-1 text-left w-[80px]">Примечание</th>
              <th rowSpan={2} className="border px-1 py-1 text-center w-[70px]">Дата оплаты</th>
              <th rowSpan={2} className="border px-1 py-1 text-center w-[70px]">Сроки поставки</th>
              <th rowSpan={2} className="border px-1 py-1 text-center w-[70px]">Условия оплаты</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border px-1 py-1 text-center bg-blue-50 text-[10px]">Цена за ед.</th>
              <th className="border px-1 py-1 text-center bg-blue-50 text-[10px]">Итого</th>
              <th className="border px-1 py-1 text-center bg-blue-50 text-[10px]">Без НДС</th>
              <th className="border px-1 py-1 text-center bg-blue-50 text-[10px]">НДС</th>
              <th className="border px-1 py-1 text-center bg-green-50 text-[10px]">За ед. ({ratesApplied || foreignCurrencies.length === 0 ? '₸' : '?'})</th>
              <th className="border px-1 py-1 text-center bg-green-50 text-[10px]">Итого</th>
              <th className="border px-1 py-1 text-center bg-green-50 text-[10px]">Без НДС</th>
              <th className="border px-1 py-1 text-center bg-green-50 text-[10px]">НДС</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const r = calcRow(item)
              const hasCost = r.costPerUnit > 0 || item.costPerUnitOverride !== null
              return (
                <React.Fragment key={item.kpId}>
                <tr className="hover:bg-gray-50">
                  <td className="border px-1 py-1 text-center text-gray-500">{idx + 1}</td>
                  <td className="border px-1 py-1 font-medium break-words">{item.name}</td>
                  <td className="border px-1 py-1 text-center">{item.quantity}</td>

                  {/* Сумма контракта — Цена за ед. EDITABLE */}
                  <td className="border px-0 py-0 bg-blue-50/30">
                    <input
                      type="number"
                      value={item.contractPerUnitOverride !== null ? item.contractPerUnitOverride : (hasCost ? Math.ceil(r.contractPerUnit) : '')}
                      onChange={e => {
                        const v = e.target.value
                        updateItem(item.kpId, 'contractPerUnitOverride', v === '' ? null : parseFloat(v) || 0)
                      }}
                      className="w-full bg-transparent outline-none text-center text-[10px] px-1 h-6"
                      placeholder="—"
                    />
                  </td>
                  <td className="border px-1 py-1 text-center bg-blue-50/30 font-medium">{hasCost ? fmt(r.contractTotal) : '—'}</td>
                  <td className="border px-1 py-1 text-center bg-blue-50/30">{hasCost ? fmt(r.contractNoVat * item.quantity) : '—'}</td>
                  <td className="border px-1 py-1 text-center bg-blue-50/30">{hasCost ? fmt(r.contractVat * item.quantity) : '—'}</td>

                  {/* Себестоимость — За ед. EDITABLE */}
                  <td className="border px-0 py-0 bg-green-50/30">
                    {item.currencyCode !== 'KZT' && !ratesApplied && item.costPerUnitOverride === null ? (
                      <span className="text-orange-500 text-[10px] px-1">{fmt(item.costPrice)} {item.currencyCode}</span>
                    ) : (
                      <input
                        type="number"
                        value={item.costPerUnitOverride !== null ? item.costPerUnitOverride : (hasCost ? Math.ceil(r.costPerUnit) : '')}
                        onChange={e => {
                          const v = e.target.value
                          updateItem(item.kpId, 'costPerUnitOverride', v === '' ? null : parseFloat(v) || 0)
                        }}
                        className="w-full bg-transparent outline-none text-center text-[10px] px-1 h-6"
                        placeholder="—"
                      />
                    )}
                  </td>
                  <td className="border px-1 py-1 text-center bg-green-50/30 font-medium">{hasCost ? fmt(r.costTotal) : '—'}</td>
                  <td className="border px-1 py-1 text-center bg-green-50/30">{hasCost ? fmt(r.costTotalNoVat) : '—'}</td>
                  <td className="border px-1 py-1 bg-green-50/30">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-[10px] text-gray-700">{hasCost ? fmt(r.costTotalVat) : '—'}</span>
                      <input
                        type="checkbox"
                        checked={(item.vatRate ?? DEFAULT_VAT_RATE) > 0}
                        onChange={e => toggleItemVat(item.kpId, e.target.checked)}
                        title={(item.vatRate ?? DEFAULT_VAT_RATE) > 0
                          ? `НДС включён (${item.vatRate ?? DEFAULT_VAT_RATE}%) — снимите, чтобы выключить`
                          : "НДС отключён — включите, чтобы добавить 16%"}
                        className="w-3.5 h-3.5 accent-green-600 cursor-pointer"
                      />
                    </div>
                  </td>

                  {/* Info fields */}
                  <td className="border px-1 py-1 text-gray-600 truncate max-w-[70px]" title={item.supplierName}>{item.supplierName}</td>
                  <TextCell value={item.note} onChange={v => updateItem(item.kpId, 'note', v)} placeholder="Примечание" />
                  <DateCell value={item.paymentDate} onChange={v => updateItem(item.kpId, 'paymentDate', v)} />
                  <TextCell value={item.deliveryTerms} onChange={v => updateItem(item.kpId, 'deliveryTerms', v)} placeholder="Сроки поставки" />
                  <TextCell value={item.paymentTerms} onChange={v => updateItem(item.kpId, 'paymentTerms', v)} placeholder="Условия оплаты" />
                </tr>
                {/* Difference row — only when cost per unit was manually changed */}
                {r.costChanged && (
                  <tr className="bg-orange-50/40 text-[9px] text-orange-600">
                    <td className="border px-1 py-0.5 text-center">Δ</td>
                    <td className="border px-1 py-0.5" />
                    <td className="border" />
                    <td className="border px-1 py-0.5 text-right">{fmt(r.diffContractPerUnit)}</td>
                    <td className="border px-1 py-0.5 text-right font-medium">{fmt(r.diffContractTotal)}</td>
                    <td className="border px-1 py-0.5 text-right">{fmt(r.diffContractNoVat)}</td>
                    <td className="border px-1 py-0.5 text-right">{fmt(r.diffContractVat)}</td>
                    <td className="border px-1 py-0.5 text-right">{fmt(r.diffCostPerUnit)}</td>
                    <td className="border px-1 py-0.5 text-right font-medium">{fmt(r.diffCostTotal)}</td>
                    <td className="border px-1 py-0.5 text-right">{fmt(r.diffCostNoVat)}</td>
                    <td className="border px-1 py-0.5 text-right">{fmt(r.diffCostVat)}</td>
                    <td colSpan={5} className="border" />
                  </tr>
                )}
                </React.Fragment>
              )
            })}

            {/* Delivery section — name takes most space, delivery input on the right */}
            <tr className="bg-yellow-50/50">
              <td colSpan={16} className="border px-2 py-2 font-medium text-gray-600">Доставка за ед. (₸)</td>
            </tr>
            <tr className="bg-yellow-50/30">
              <th className="border px-1 py-1 text-center w-7">№</th>
              <th className="border px-1 py-1 text-left" colSpan={11}>Наименование</th>
              <th className="border px-1 py-1 text-center" colSpan={2}>Доставка за ед.</th>
              <th className="border px-1 py-1 text-center" colSpan={2}>Доставка сумма</th>
            </tr>
            {items.map((item, idx) => {
              const deliverySum = (item.deliveryPerUnit || 0) * item.quantity
              return (
                <tr key={`del-${item.kpId}`} className="bg-yellow-50/20">
                  <td className="border px-1 py-1 text-center text-gray-400">{idx + 1}</td>
                  <td className="border px-1 py-1 text-gray-600 text-[10px] break-words" colSpan={11}>{item.name}</td>
                  <td className="border px-1 py-1 text-right" colSpan={2}>
                    <input
                      type="number"
                      value={item.deliveryPerUnit ? Math.ceil(item.deliveryPerUnit) : ''}
                      onChange={e => updateItem(item.kpId, 'deliveryPerUnit', Math.ceil(parseFloat(e.target.value) || 0))}
                      className="w-24 bg-white border border-gray-200 rounded px-1 h-6 text-xs text-right outline-none focus:border-blue-400 ml-auto"
                      placeholder="0"
                    />
                  </td>
                  <td className="border px-1 py-1 text-right text-xs font-medium text-gray-700" colSpan={2}>
                    {deliverySum > 0 ? fmt(deliverySum) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Итого доставка */}
      <div className="max-w-[1600px] mx-auto mt-3 flex justify-end">
        <div className="bg-white rounded-xl border-2 border-yellow-200 shadow-sm px-5 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Итого доставка:</span>
          <span className="text-base font-bold text-yellow-700">{fmt(totals.deliveryTotalSum)} ₸</span>
        </div>
      </div>

      {/* Bottom section: Expenses + Summary */}
      <div className="max-w-[1600px] mx-auto mt-6 grid grid-cols-2 gap-6">
        {/* Расходы по проекту */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Расходы по проекту</h3>
            <Button variant="outline" size="sm" onClick={addExpense} className="h-7 text-xs rounded-full">
              <Plus className="h-3 w-3 mr-1" /> Добавить
            </Button>
          </div>
          <div className="space-y-2">
            {expenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={exp.name}
                  onChange={e => updateExpense(exp.id, 'name', e.target.value)}
                  placeholder="Название расхода"
                  className="flex-1 border border-gray-200 rounded px-2 h-7 text-xs outline-none focus:border-blue-400"
                />
                <input
                  type="number"
                  value={exp.amount || ''}
                  onChange={e => updateExpense(exp.id, 'amount', parseFloat(e.target.value) || 0)}
                  placeholder="Сумма"
                  className="w-32 border border-gray-200 rounded px-2 h-7 text-xs text-right outline-none focus:border-blue-400"
                />
                <span className="text-xs text-gray-400">₸</span>
                <button onClick={() => removeExpense(exp.id)} className="text-gray-300 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {expenses.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Нет расходов</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="text-sm font-medium">Итого расходы:</span>
            <span className="text-sm font-bold">{fmt(totals.expensesTotal)} ₸</span>
          </div>
        </div>

        {/* Итоги */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Итоги</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Сумма контракта:</span>
              <span className="text-sm font-bold text-blue-700">{fmt(totals.contractTotalSum)} ₸</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Сумма закупа:</span>
              <span className="text-sm font-bold text-green-700">{fmt(totals.costTotalSum)} ₸</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Расходы по проекту:</span>
              <span className="text-sm font-bold">{fmt(totals.expensesTotal)} ₸</span>
            </div>
            <div className="pt-3 border-t flex justify-between items-center">
              <span className="text-sm text-gray-600">Налоги:</span>
              <span className="text-sm font-bold text-red-600">{fmt(totals.taxes)} ₸</span>
            </div>
            <div className="pt-3 border-t flex justify-between items-center">
              <span className="text-sm font-semibold">Маржа (прибыль):</span>
              <span className="text-base font-bold text-emerald-600">
                {fmt(totals.contractTotalSum - totals.costTotalSum - totals.expensesTotal - totals.taxes)} ₸
                {totals.contractTotalSum > 0 && (
                  <span className="text-xs font-normal text-emerald-500 ml-1">
                    ({((totals.contractTotalSum - totals.costTotalSum - totals.expensesTotal - totals.taxes) / totals.contractTotalSum * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-base font-semibold">Справка по расчётам</h3>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 text-sm text-gray-700">

              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Настройки (сверху)</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Ставка НДС (%)</b> — значение по умолчанию для новых строк (16%). У каждой строки есть свой редактируемый НДС в колонке «НДС» в Себестоимости</li>
                  <li><b>Курс валюты</b> — автоматически загружается с Halyk Bank (продажа для бизнеса + 1%). При создании нового расчётника обновляется автоматически. Можно изменить вручную</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-blue-700 mb-1">Сумма контракта (что платит клиент)</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Цена за ед.</b> = (Себестоимость + Доставка) + НДС = (Себестоимость + Доставка) × (1 + Ставка НДС). Можно изменить вручную</li>
                  <li><b>Итого</b> = Цена за ед. × Кол-во</li>
                  <li><b>Без НДС</b> = Цена за ед. / (1 + Ставка НДС) × Кол-во</li>
                  <li><b>НДС</b> = (Цена за ед. − Цена за ед. / (1 + Ставка НДС)) × Кол-во</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-green-700 mb-1">Себестоимость (наши затраты)</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>За ед. (₸)</b> = Себестоимость от поставщика × Курс валюты × (1 + 16% если НДС включён, иначе 1). У каждой строки есть галочка НДС в колонке «НДС» — по умолчанию включена. Можно изменить вручную</li>
                  <li><b>Итого</b> = За ед. × Кол-во</li>
                  <li><b>Без НДС</b> = За ед. / (1 + ставка НДС строки) × Кол-во. Если НДС выключен → равно «За ед. × Кол-во»</li>
                  <li><b>НДС</b> = (За ед. − Без НДС) × Кол-во. Если галочка НДС снята — НДС = 0, и себестоимость считается «как есть» без надбавки</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-yellow-700 mb-1">Доставка</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Доставка за ед.</b> — загружается из формулы склада (если настроена в админке). Можно изменить вручную</li>
                  <li><b>Доставка сумма</b> = Доставка за ед. × Кол-во</li>
                  <li><b>Итого доставка</b> = сумма «Доставка сумма» по всем товарам — используется в расчёте налогов</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-orange-600 mb-1">Строка разницы (Δ)</h4>
                <p>Появляется только когда вы вручную изменили <b>За ед.</b> в себестоимости. Показывает разницу между новым и оригинальным значением по всем колонкам.</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Итоги</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Сумма контракта</b> = Сумма всех «Итого» из колонки Сумма контракта</li>
                  <li><b>Сумма закупа</b> = Сумма всех «Итого» из колонки Себестоимость</li>
                  <li><b>Расходы по проекту</b> = Сумма всех добавленных расходов</li>
                  <li><b>Налоги</b> = (НДС контракта − НДС себестоимости) + (((Итого контракта − Итого себестоимости) − Итого доставка) / 5)</li>
                  <li><b>Маржа</b> = Сумма контракта − Сумма закупа − Расходы − Налоги. В скобках процент от суммы контракта</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Сохранение</h4>
                <p>Данные расчётника автоматически сохраняются в памяти при переходах между страницами. Кнопка <b>Сохранить</b> сохраняет на сервер вместе с КП.</p>
              </div>

            </div>
            <div className="px-6 py-3 border-t">
              <Button size="sm" onClick={() => setShowHelp(false)} className="w-full rounded-full">Закрыть</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
