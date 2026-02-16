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

  useEffect(() => {
    if (status) {
      setStatusName(status.status_name)
      setConditionOperator(status.condition_operator)
      setConditionValue(status.condition_value.toString())
      setBackgroundColor(status.background_color)
      setTextColor(status.text_color)
      setActive(status.active)
      setSupplierId(status.supplier_id ? status.supplier_id.toString() : "none")
    } else {
      setStatusName("")
      setConditionOperator(">")
      setConditionValue("0")
      setBackgroundColor("#ffffff")
      setTextColor("#000000")
      setActive(true)
      setSupplierId("none")
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

    onSave({
      status_name: statusName.trim(),
      condition_operator: conditionOperator,
      condition_value: parseInt(conditionValue),
      background_color: backgroundColor,
      text_color: textColor,
      active,
      supplier_id: supplierId !== "none" ? parseInt(supplierId) : null,
      supplier_name: supplierId !== "none" ? suppliers.find(s => s.id.toString() === supplierId)?.name || null : null,
    })
  }

  const getFormulaDisplay = () => {
    const operatorText = operatorOptions.find(op => op.value === conditionOperator)?.label || conditionOperator
    return `Если кол-во товара ${operatorText} ${conditionValue} то статус ${statusName || "..."}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {status ? "Редактировать статус наличия" : "Создать статус наличия"}
          </DialogTitle>
          <DialogDescription>
            Настройте условие для отображения статуса наличия товара.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Название статуса */}
          <div className="grid gap-2">
            <Label htmlFor="statusName">Название статуса</Label>
            <Input
              id="statusName"
              value={statusName}
              onChange={(e) => setStatusName(e.target.value)}
              placeholder="Например: На складе достаточно"
            />
          </div>

          {/* Поставщик */}
          <div className="grid gap-2">
            <Label htmlFor="supplier">Поставщик</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
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

          {/* Оператор условия */}
          <div className="grid gap-2">
            <Label htmlFor="conditionOperator">Оператор</Label>
            <Select value={conditionOperator} onValueChange={setConditionOperator}>
              <SelectTrigger>
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

          {/* Значение условия */}
          <div className="grid gap-2">
            <Label htmlFor="conditionValue">Значение</Label>
            <Input
              id="conditionValue"
              type="number"
              min="0"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Цвета */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="backgroundColor">Цвет фона</Label>
              <div className="flex gap-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#ffffff"
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
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>

          {/* Активность */}
          <div className="flex items-center justify-between">
            <Label htmlFor="active">Активен</Label>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          {/* Предварительный просмотр */}
          <div className="grid gap-2">
            <Label>Предварительный просмотр</Label>
            <div className="p-3 rounded-lg border" style={{ backgroundColor, color: textColor }}>
              <p className="text-sm font-medium">{statusName || "Название статуса"}</p>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit}>
            {status ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
