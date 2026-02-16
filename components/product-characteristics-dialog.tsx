"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  type Characteristic,
  getCharacteristics,
  addCharacteristic,
  deleteCharacteristic,
  reorderCharacteristics,
} from "@/app/actions/products"
import { getCharacteristicsList, type CharacteristicsListItem } from "@/app/actions/characteristics-list"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Trash2, GripVertical, Edit, Check, X } from "lucide-react"

interface ProductCharacteristicsDialogProps {
  productId: number
  onClose: () => void
}

interface EditableCharacteristic extends Characteristic {
  isEditing?: boolean
  tempCharacteristicId?: number
  tempValue?: string
  isNew?: boolean // Флаг для новых характеристик
}

function SortableCharacteristicItem({
  char,
  onDelete,
  onEdit,
  onSave,
  onCancel,
  onTempUpdate,
  isPending,
  characteristicsList,
}: {
  char: EditableCharacteristic
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onSave: (id: number) => void
  onCancel: (id: number) => void
  onTempUpdate: (id: number, field: "characteristicId" | "value", value: string | number) => void
  isPending: boolean
  characteristicsList: CharacteristicsListItem[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: char.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
      <Button {...attributes} {...listeners} variant="ghost" size="icon" className="cursor-grab" disabled={char.isNew}>
        <GripVertical className="h-5 w-5" />
      </Button>

      {char.isEditing ? (
        <>
          <Select
            value={char.tempCharacteristicId?.toString() || ""}
            onValueChange={(value) => onTempUpdate(char.id, "characteristicId", parseInt(value))}
            disabled={isPending}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Выберите характеристику" />
            </SelectTrigger>
            <SelectContent>
              {characteristicsList.map((item) => (
                <SelectItem key={item.id} value={item.id.toString()}>
                  {item.characteristic_key} {item.unit_of_measurement && `(${item.unit_of_measurement})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Значение"
            value={char.tempValue ?? char.value}
            onChange={(e) => onTempUpdate(char.id, "value", e.target.value)}
            className="flex-1"
            disabled={isPending}
          />
          <div className="text-sm text-gray-500 min-w-[60px]">
            {char.tempCharacteristicId ? 
              characteristicsList.find(cl => cl.id === char.tempCharacteristicId)?.unit_of_measurement || '' 
              : char.unit_of_measurement || ''}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSave(char.id)}
            className="text-green-600"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCancel(char.id)}
            className="text-gray-500"
            disabled={isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <div className="flex-1 px-3 py-2 text-sm">
            {char.key || <span className="text-gray-400">Без названия</span>}
          </div>
          <div className="flex-1 px-3 py-2 text-sm">
            {char.value || <span className="text-gray-400">Без значения</span>}
          </div>
          <div className="text-sm text-gray-500 min-w-[60px]">
            {char.unit_of_measurement || ''}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(char.id)}
            className="text-blue-600"
            disabled={isPending}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(char.id)}
            className="text-red-500"
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

export function ProductCharacteristicsDialog({ productId, onClose }: ProductCharacteristicsDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [characteristics, setCharacteristics] = useState<EditableCharacteristic[]>([])
  const [characteristicsList, setCharacteristicsList] = useState<CharacteristicsListItem[]>([])
  const [nextTempId, setNextTempId] = useState(-1) // Для временных ID новых характеристик
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const fetchChars = useCallback(async () => {
    if (isInitialLoading) {
      setIsInitialLoading(true)
    }
    const chars = await getCharacteristics(productId)
    setCharacteristics(chars.map((c) => ({ ...c, isEditing: false })))
    setIsInitialLoading(false)
  }, [productId, isInitialLoading])

  const fetchCharacteristicsList = useCallback(async () => {
    try {
      const result = await getCharacteristicsList()
      if (result.success && result.data) {
        setCharacteristicsList(result.data)
      }
    } catch (error) {
      console.error('Error fetching characteristics list:', error)
    }
  }, [])

  useEffect(() => {
    fetchChars()
    fetchCharacteristicsList()
  }, [fetchChars, fetchCharacteristicsList])

  const handleAdd = () => {
    const newOrder = characteristics.length > 0 ? Math.max(...characteristics.map((c) => c.sort_order)) + 1 : 1
    const newChar: EditableCharacteristic = {
      id: nextTempId,
      key: "",
      value: "",
      sort_order: newOrder,
      isEditing: true,
      isNew: true,
      tempCharacteristicId: undefined,
      tempValue: "",
    }

    setCharacteristics((prev) => [...prev, newChar])
    setNextTempId((prev) => prev - 1)
  }

  const handleDelete = (id: number) => {
    const char = characteristics.find((c) => c.id === id)

    if (char?.isNew) {
      // Если это новая несохраненная характеристика, просто удаляем локально
      setCharacteristics((prev) => prev.filter((c) => c.id !== id))
      return
    }

    // Если это существующая характеристика, удаляем на сервере
    startTransition(async () => {
      const result = await deleteCharacteristic(productId, id)
      if (result.success) {
        toast({ title: "Характеристика удалена" })
        await fetchChars()
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleEdit = (id: number) => {
    setCharacteristics((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isEditing: true, tempCharacteristicId: c.characteristic_id, tempValue: c.value } : c)),
    )
  }

  const handleSaveEdit = (id: number) => {
    const char = characteristics.find((c) => c.id === id)
    if (!char) return

    const characteristicId = char.tempCharacteristicId
    const value = char.tempValue || char.value

    if (!characteristicId) {
      toast({ variant: "destructive", title: "Ошибка", description: "Выберите характеристику из списка" })
      return
    }

    if (char.isNew) {
      // Создаем новую характеристику на сервере
      startTransition(async () => {
        try {
          const result = await addCharacteristic(productId, characteristicId, value)
          toast({ title: "Характеристика добавлена" })
          await fetchChars()
        } catch (error) {
          toast({ variant: "destructive", title: "Ошибка", description: "Не удалось добавить характеристику" })
        }
      })
    } else {
      // Обновляем существующую характеристику локально
      setCharacteristics((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                key: characteristicsList.find(cl => cl.id === characteristicId)?.characteristic_key || c.key,
                value,
                isEditing: false,
                tempCharacteristicId: undefined,
                tempValue: undefined,
              }
            : c,
        ),
      )
      toast({ title: "Изменения сохранены" })
    }
  }

  const handleCancelEdit = (id: number) => {
    const char = characteristics.find((c) => c.id === id)

    if (char?.isNew) {
      // Если это новая характеристика, удаляем её
      setCharacteristics((prev) => prev.filter((c) => c.id !== id))
    } else {
      // Если это существующая характеристика, просто отменяем редактирование
      setCharacteristics((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isEditing: false, tempCharacteristicId: undefined, tempValue: undefined } : c)),
      )
    }
  }

  const handleTempUpdate = (id: number, field: "characteristicId" | "value", value: string | number) => {
    setCharacteristics((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field === "characteristicId" ? "tempCharacteristicId" : "tempValue"]: value } : c)),
    )
  }


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      // Не разрешаем перетаскивание новых характеристик
      const activeChar = characteristics.find((c) => c.id === active.id)
      if (activeChar?.isNew) return

      const oldIndex = characteristics.findIndex((c) => c.id === active.id)
      const newIndex = characteristics.findIndex((c) => c.id === over.id)
      const newChars = Array.from(characteristics)
      const [movedItem] = newChars.splice(oldIndex, 1)
      newChars.splice(newIndex, 0, movedItem)
      setCharacteristics(newChars)
      
      // Сразу отправляем изменения на сервер
      startTransition(async () => {
        try {
          // Создаем payload для реордера (только существующие характеристики)
          const existingChars = newChars.filter((c) => !c.isNew)
          const orderPayload = existingChars.map((c, index) => ({ id: c.id, sort_order: index + 1 }))
          
          await reorderCharacteristics(productId, orderPayload)
          toast({ title: "Порядок характеристик обновлен" })
        } catch (error) {
          toast({ 
            variant: "destructive", 
            title: "Ошибка", 
            description: "Не удалось обновить порядок характеристик" 
          })
          // Откатываем изменения при ошибке
          await fetchChars()
        }
      })
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Характеристики товара</DialogTitle>
          <DialogDescription>Добавляйте, редактируйте, удаляйте и меняйте порядок характеристик.</DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {isInitialLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={characteristics.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {characteristics.map((char) => (
                    <SortableCharacteristicItem
                      key={char.id}
                      char={char}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onSave={handleSaveEdit}
                      onCancel={handleCancelEdit}
                      onTempUpdate={handleTempUpdate}
                      isPending={isPending}
                      characteristicsList={characteristicsList}
                    />
                  ))}
                  {characteristics.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Характеристик пока нет.</p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
        <DialogFooter className="flex justify-between">
          <Button onClick={handleAdd} disabled={isPending}>
            <Plus className="mr-2 h-4 w-4" /> Добавить
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
