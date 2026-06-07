"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { ProductAvailabilityStatus } from "@/app/actions/product-availability-statuses"
import type { Supplier } from "@/app/actions/suppliers"
import { cn } from "@/lib/utils"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface ProductAvailabilityStatusEditDialogProps {
  status: ProductAvailabilityStatus | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Omit<ProductAvailabilityStatus, "id" | "order"> & { order?: number }) => void
  suppliers?: Supplier[]
}

const operatorOptions = [
  { value: ">", label: "Больше" },
  { value: "<", label: "Меньше" },
  { value: "=", label: "Равно" },
  { value: ">=", label: "Больше или равно" },
  { value: "<=", label: "Меньше или равно" },
]

export default function ProductAvailabilityStatusEditDialog({
  status,
  open,
  onOpenChange,
  onSave,
  suppliers = []
}: ProductAvailabilityStatusEditDialogProps) {
  const [statusName, setStatusName] = useState("")
  const [conditionOperator, setConditionOperator] = useState(">")
  const [conditionValue, setConditionValue] = useState("0")
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [textColor, setTextColor] = useState("#000000")
  const [active, setActive] = useState(true)
  const [supplierId, setSupplierId] = useState<string>("none")
  const [isArrivalStatus, setIsArrivalStatus] = useState(false)
  const [arrivalDays, setArrivalDays] = useState("0")

  useEffect(() => {
    if (status) {
      setStatusName(status.status_name)
      setConditionOperator(status.condition_operator)
      setConditionValue(status.condition_value.toString())
      setBackgroundColor(status.background_color)
      setTextColor(status.text_color)
      setActive(status.active)
      setSupplierId(status.supplier_id ? status.supplier_id.toString() : "none")
      setIsArrivalStatus(!!status.is_arrival_status)
      setArrivalDays(status.arrival_days != null ? String(status.arrival_days) : "0")
    } else {
      setStatusName("")
      setConditionOperator(">")
      setConditionValue("0")
      setBackgroundColor("#ffffff")
      setTextColor("#000000")
      setActive(true)
      setSupplierId("none")
      setIsArrivalStatus(false)
      setArrivalDays("0")
    }
  }, [status, open])

  const handleSubmit = () => {
    if (!statusName.trim()) {
      alert("Название статуса обязательно")
      return
    }

    if (!conditionValue || isNaN(Number(conditionValue))) {
      alert("Значение должно быть числом")
      return
    }

    // Когда «Поступление» включено — arrival_days обязателен (число ≥ 0).
    // Когда выключено — передаём null чтобы бэк обнулил у себя.
    let arrivalDaysOut: number | null = null
    if (isArrivalStatus) {
      const n = parseInt(arrivalDays)
      if (isNaN(n) || n < 0) {
        alert("Дней до поступления должно быть числом ≥ 0")
        return
      }
      arrivalDaysOut = n
    }

    onSave({
      status_name: statusName.trim(),
      condition_operator: conditionOperator,
      condition_value: parseInt(conditionValue),
      background_color: backgroundColor,
      text_color: textColor,
      active,
      supplier_id: supplierId !== "none" ? parseInt(supplierId) : null,
      supplier_name: supplierId !== "none" ? suppliers.find(s => s.id.toString() === supplierId)?.name || null : null,
      is_arrival_status: isArrivalStatus,
      arrival_days: arrivalDaysOut,
    })
  }

  const getFormulaDisplay = () => {
    const operatorText = operatorOptions.find(op => op.value === conditionOperator)?.label || conditionOperator
    return `Если кол-во товара ${operatorText} ${conditionValue} то статус ${statusName || "..."}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {status ? "Редактировать статус наличия" : "Создать статус наличия"}
          </DialogTitle>
          <DialogDescription>
            Настройте условие для отображения статуса наличия товара.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Две колонки: слева логика срабатывания, справа — отображение
              и режимы. Превью идёт ниже на всю ширину. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* ── Левая колонка: что показывать и кому ── */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="statusName">Название статуса</Label>
                <Input
                  id="statusName"
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  placeholder="Например: На складе достаточно"
                  className={SOFT_CONTROL}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="supplier">Поставщик</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className={SOFT_CONTROL}>
                    <SelectValue placeholder="Выберите поставщика" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Все поставщики (глобальный)</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="conditionOperator">Оператор</Label>
                <Select value={conditionOperator} onValueChange={setConditionOperator}>
                  <SelectTrigger className={SOFT_CONTROL}>
                    <SelectValue placeholder="Выберите оператор" />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="conditionValue">Значение</Label>
                <Input
                  id="conditionValue"
                  type="number"
                  min="0"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  placeholder="0"
                  className={SOFT_CONTROL}
                />
              </div>
            </div>

            {/* ── Правая колонка: вид шильдика и режимы ── */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="backgroundColor">Цвет фона</Label>
                  <div className="flex gap-2">
                    <Input
                      id="backgroundColor"
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className={cn("w-12 h-10 p-1 cursor-pointer shrink-0", SOFT_CONTROL)}
                    />
                    <Input
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#ffffff"
                      className={cn("min-w-0", SOFT_CONTROL)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="textColor">Цвет текста</Label>
                  <div className="flex gap-2">
                    <Input
                      id="textColor"
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className={cn("w-12 h-10 p-1 cursor-pointer shrink-0", SOFT_CONTROL)}
                    />
                    <Input
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      placeholder="#000000"
                      className={cn("min-w-0", SOFT_CONTROL)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3">
                <Label htmlFor="active">Активен</Label>
                <Switch
                  id="active"
                  checked={active}
                  onCheckedChange={setActive}
                />
              </div>

              {/* Поступление — отдельный режим отображения шильдика с датой
                  ожидаемого поступления = сегодня + N дней. Условие срабатывания
                  (оператор/значение) остаётся как есть. */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="isArrival">Поступление</Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Шильдик дополнится датой «сегодня + N дней»
                    </p>
                  </div>
                  <Switch
                    id="isArrival"
                    checked={isArrivalStatus}
                    onCheckedChange={setIsArrivalStatus}
                  />
                </div>
                {isArrivalStatus && (
                  <div className="grid gap-2">
                    <Label htmlFor="arrivalDays">Через сколько дней</Label>
                    <Input
                      id="arrivalDays"
                      type="number"
                      min="0"
                      value={arrivalDays}
                      onChange={(e) => setArrivalDays(e.target.value)}
                      placeholder="0"
                      className={SOFT_CONTROL}
                    />
                    <p className="text-xs text-gray-500">
                      Оценочный срок: клиент всегда видит дату = сегодня + N дней.
                      Это не привязка к календарю, а правило «обычно поступает через ~N дней».
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Предварительный просмотр — на всю ширину */}
          <div className="grid gap-2 mt-5 pt-4 border-t">
            <Label>Предварительный просмотр</Label>
            <div className="p-3 rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ backgroundColor, color: textColor }}>
              <p className="text-sm font-medium">
                {formatAvailabilityStatusLabel({
                  status_name: statusName || "Название статуса",
                  is_arrival_status: isArrivalStatus,
                  arrival_days: parseInt(arrivalDays) || 0,
                })}
              </p>
              <p className="text-xs opacity-80">{getFormulaDisplay()}</p>
              {supplierId !== "none" && (
                <p className="text-xs opacity-60 mt-1">
                  Поставщик: {suppliers.find(s => s.id.toString() === supplierId)?.name}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className={SECONDARY_BTN}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} className={PRIMARY_BTN}>
            {status ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
