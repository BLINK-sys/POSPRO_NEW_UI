"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Структурный override себестоимости «За ед. (₸)» в корп.расчётнике.
 *
 * Вместо ввода единого числа в KZT (как делает обычный onChange на input'е),
 * оператор задаёт компоненты:
 *   - Себестоимость в исходной валюте (RUB для BIO, USD для других и т.д.)
 *   - Курс (X per 1 unit исходной валюты → KZT)
 *   - НДС в процентах (0, 12, 16…)
 *   - Округление: направление (вверх/вниз) + шаг (1, 10, 100, 1000)
 *
 * Итог: `costPerUnit (₸) = round_direction(cost × rate × (1 + vat/100), step)`
 *
 * Это удобно когда менеджер договорился о фиксированной цене у поставщика
 * на конкретный товар (например, «партия идёт по 14 000 RUB, курс мы
 * заморозили на 7.30, без НДС, округляем до 100 вверх») — все компоненты
 * остаются видны и можно аудировать происхождение цифры.
 */

export type RoundDirection = 'up' | 'down'
export type RoundStep = 1 | 10 | 100 | 1000

export interface CostOverrideStructured {
  amount: number
  rate: number
  vat: number
  roundDirection: RoundDirection
  roundStep: RoundStep
}

interface CalcCostOverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currencyCode: string
  warehouseLabel?: string
  initial?: CostOverrideStructured | null
  defaultAmount?: number
  defaultRate?: number
  defaultVat?: number
  onSave: (override: CostOverrideStructured) => void
  onClear?: () => void
}

// Округляет число по направлению и шагу. Шаг 1 + ceil даёт целое число
// сверху, шаг 100 + floor даёт ближайшую сотню снизу и т.д.
export function applyRounding(value: number, direction: RoundDirection, step: number): number {
  if (!step || step <= 0) return value
  const fn = direction === 'up' ? Math.ceil : Math.floor
  return fn(value / step) * step
}

const ROUND_STEPS: RoundStep[] = [1, 10, 100, 1000]

// Стиль для input'ов: убираем focus-выделение (рамку и ring) — единый
// тон с остальными ячейками таблицы расчётника. Плюс убираем стандартные
// spinner-стрелки у `type="number"` (WebKit + Firefox).
const INPUT_NO_FOCUS = cn(
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-200",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0"
)

export function CalcCostOverrideDialog({
  open,
  onOpenChange,
  currencyCode,
  warehouseLabel,
  initial,
  defaultAmount,
  defaultRate,
  defaultVat = 16,
  onSave,
  onClear,
}: CalcCostOverrideDialogProps) {
  const [amount, setAmount] = useState(String(initial?.amount ?? defaultAmount ?? 0))
  const [rate, setRate] = useState(String(initial?.rate ?? defaultRate ?? 1))
  const [vat, setVat] = useState(String(initial?.vat ?? defaultVat))
  const [roundDirection, setRoundDirection] = useState<RoundDirection>(initial?.roundDirection ?? 'up')
  const [roundStep, setRoundStep] = useState<RoundStep>(initial?.roundStep ?? 1)

  useEffect(() => {
    if (open) {
      setAmount(String(initial?.amount ?? defaultAmount ?? 0))
      setRate(String(initial?.rate ?? defaultRate ?? 1))
      setVat(String(initial?.vat ?? defaultVat))
      setRoundDirection(initial?.roundDirection ?? 'up')
      setRoundStep(initial?.roundStep ?? 1)
    }
  }, [open, initial, defaultAmount, defaultRate, defaultVat])

  const numAmount = parseFloat(amount) || 0
  const numRate = parseFloat(rate) || 0
  const numVat = parseFloat(vat) || 0
  const rawResult = numAmount * numRate * (1 + numVat / 100)
  const finalResult = applyRounding(rawResult, roundDirection, roundStep)

  const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Зафиксировать себестоимость</DialogTitle>
          <DialogDescription>
            Задаёт «За ед. (₸)» как произведение компонентов. Каждый
            из них редактируется отдельно — удобно когда нужно зафиксировать
            курс или поменять только НДС.
            {warehouseLabel && (
              <>
                <br />
                Склад: <b>{warehouseLabel}</b>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Первая строка — три инпута в ряд */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Себестоимость ({currencyCode})</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn("h-9 font-mono text-center", INPUT_NO_FOCUS)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Курс ({currencyCode} → ₸)</Label>
              <Input
                type="number"
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className={cn("h-9 font-mono text-center", INPUT_NO_FOCUS)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">НДС (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                className={cn("h-9 font-mono text-center", INPUT_NO_FOCUS)}
                placeholder="16"
              />
            </div>
          </div>

          {/* Вторая строка — Округление: направление + шаг */}
          <div className="space-y-1">
            <Label className="text-xs">Округление</Label>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                {(['down', 'up'] as RoundDirection[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRoundDirection(d)}
                    className={cn(
                      "px-3 h-9 text-xs font-medium transition-colors",
                      roundDirection === d
                        ? "bg-brand-yellow text-black"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {d === 'up' ? '↑ Вверх' : '↓ Вниз'}
                  </button>
                ))}
              </div>
              <div className="inline-flex flex-1 rounded-md border border-gray-200 overflow-hidden">
                {ROUND_STEPS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRoundStep(s)}
                    className={cn(
                      "flex-1 h-9 text-xs font-medium transition-colors",
                      i > 0 && "border-l border-gray-200",
                      roundStep === s
                        ? "bg-brand-yellow text-black"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {roundStep === 1
                ? `Округление до целого ${roundDirection === 'up' ? 'вверх' : 'вниз'}`
                : `Округление до ближайших ${roundStep} ${roundDirection === 'up' ? 'вверх' : 'вниз'}`}
            </p>
          </div>

          {/* Итог: формула + результат */}
          <div className="pt-3 border-t flex items-center justify-between">
            <div className="text-xs text-gray-500 leading-tight">
              {fmt(numAmount)} × {fmt(numRate)} × (1 + {fmt(numVat)}/100)
              {roundStep > 1 && (
                <><br /><span className="text-gray-400">= {fmt(rawResult)} → {roundDirection === 'up' ? '↑' : '↓'} {roundStep}</span></>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">За ед.</div>
              <div className="text-xl font-bold text-emerald-700 font-mono">
                {fmt(finalResult)} ₸
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {onClear && initial && (
            <Button variant="ghost" onClick={() => { onClear(); onOpenChange(false) }} className="mr-auto text-red-600 hover:text-red-700 hover:bg-red-50">
              Сбросить
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            onClick={() => {
              onSave({ amount: numAmount, rate: numRate, vat: numVat, roundDirection, roundStep })
              onOpenChange(false)
            }}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
            disabled={numAmount <= 0 || numRate <= 0}
          >
            Зафиксировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
