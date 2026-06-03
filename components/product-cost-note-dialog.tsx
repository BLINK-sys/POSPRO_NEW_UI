"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

interface ProductCostNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValue?: string | null
  // Контекст: имя склада + поставщика, чтобы оператор понимал к чему
  // привязана заметка. Опциональны — для «нового» (ещё не добавленного)
  // склада-себестоимости можно показать имя склада из selecta.
  warehouseLabel?: string
  // Сохранение. Если не задано — диалог чисто read-only / редактирует
  // локальный стейт через onOpenChange + initialValue extern.
  onSave: (value: string) => void
}

/**
 * Модалка для редактирования свободного примечания у строки
 * `ProductWarehouseCost`. Поддерживает переносы строк, многострочный
 * ввод. По Save отдаёт значение наверх.
 */
export function ProductCostNoteDialog({
  open,
  onOpenChange,
  initialValue,
  warehouseLabel,
  onSave,
}: ProductCostNoteDialogProps) {
  const [value, setValue] = useState(initialValue || "")

  // Синхронизируемся с initialValue при открытии (между открытиями
  // диалог может крутиться вокруг разных строк).
  useEffect(() => {
    if (open) setValue(initialValue || "")
  }, [open, initialValue])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Примечание</DialogTitle>
          {warehouseLabel && (
            <DialogDescription>
              Заметка к складу <b>{warehouseLabel}</b>. Видна только в админке.
            </DialogDescription>
          )}
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Например: цена держится до 30.07, отгрузка только под заказ, поставщик скоро поднимет курс…"
          rows={8}
          className="resize-y min-h-[180px] font-normal"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              onSave(value)
              onOpenChange(false)
            }}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
