"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2, Plus, Edit, Trash2, Save, X, Search } from "lucide-react"
import {
  getCharacteristicsList,
  createCharacteristic,
  updateCharacteristic,
  deleteCharacteristic,
  type CharacteristicsListItem
} from "@/app/actions/characteristics-list"
import { cn } from "@/lib/utils"

const FOCUS_NO_RING =
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  FOCUS_NO_RING
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface CharacteristicsListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CharacteristicsListDialog({ open, onOpenChange }: CharacteristicsListDialogProps) {
  const [characteristics, setCharacteristics] = useState<CharacteristicsListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    characteristic_key: '',
    unit_of_measurement: ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [characteristicToDelete, setCharacteristicToDelete] = useState<CharacteristicsListItem | null>(null)
  const { toast } = useToast()

  // Фильтрация по поиску
  const filteredCharacteristics = characteristics.filter(char =>
    char.characteristic_key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Загрузка списка характеристик
  const loadCharacteristics = async () => {
    setLoading(true)
    try {
      const result = await getCharacteristicsList()
      if (result.success && result.data) {
        setCharacteristics(result.data)
      } else {
        toast({
          title: "Ошибка",
          description: result.message || "Не удалось загрузить справочник характеристик",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке данных",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      // Принудительно обновляем данные при открытии диалога
      loadCharacteristics()
    }
  }, [open])

  // Обработка создания новой характеристики
  const handleCreate = async () => {
    if (!formData.characteristic_key.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите ключ характеристики",
        variant: "destructive"
      })
      return
    }

    const newCharacteristic = {
      id: Date.now(), // Временный ID для оптимистичного обновления
      characteristic_key: formData.characteristic_key.trim(),
      unit_of_measurement: formData.unit_of_measurement.trim()
    }

    // Оптимистичное обновление - добавляем в начало списка
    setCharacteristics(prev => [newCharacteristic, ...prev])
    setFormData({ characteristic_key: '', unit_of_measurement: '' })
    setIsCreating(false)

    try {
      const result = await createCharacteristic({
        characteristic_key: newCharacteristic.characteristic_key,
        unit_of_measurement: newCharacteristic.unit_of_measurement
      })

      if (result.success && result.data) {
        // Заменяем временную характеристику на реальную с сервера
        setCharacteristics(prev => 
          prev.map(char => 
            char.id === newCharacteristic.id ? result.data! : char
          )
        )
        toast({
          title: "Успешно",
          description: "Характеристика создана"
        })
      } else {
        // Откатываем изменения при ошибке
        setCharacteristics(prev => prev.filter(char => char.id !== newCharacteristic.id))
        toast({
          title: "Ошибка",
          description: result.message || "Не удалось создать характеристику",
          variant: "destructive"
        })
      }
    } catch (error) {
      // Откатываем изменения при ошибке
      setCharacteristics(prev => prev.filter(char => char.id !== newCharacteristic.id))
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при создании характеристики",
        variant: "destructive"
      })
    }
  }

  // Обработка обновления характеристики
  const handleUpdate = async (id: number) => {
    if (!formData.characteristic_key.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите ключ характеристики",
        variant: "destructive"
      })
      return
    }

    // Сохраняем старые данные для отката
    const oldCharacteristic = characteristics.find(char => char.id === id)
    if (!oldCharacteristic) return

    const updatedData = {
      characteristic_key: formData.characteristic_key.trim(),
      unit_of_measurement: formData.unit_of_measurement.trim()
    }

    // Оптимистичное обновление - обновляем локально
    setCharacteristics(prev => 
      prev.map(char => 
        char.id === id 
          ? { ...char, ...updatedData }
          : char
      )
    )
    setEditingId(null)
    setFormData({ characteristic_key: '', unit_of_measurement: '' })

    try {
      const result = await updateCharacteristic(id, updatedData)

      if (result.success) {
        toast({
          title: "Успешно",
          description: "Характеристика обновлена"
        })
      } else {
        // Откатываем изменения при ошибке
        setCharacteristics(prev => 
          prev.map(char => 
            char.id === id ? oldCharacteristic : char
          )
        )
        toast({
          title: "Ошибка",
          description: result.message || "Не удалось обновить характеристику",
          variant: "destructive"
        })
      }
    } catch (error) {
      // Откатываем изменения при ошибке
      setCharacteristics(prev => 
        prev.map(char => 
          char.id === id ? oldCharacteristic : char
        )
      )
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при обновлении характеристики",
        variant: "destructive"
      })
    }
  }

  // Обработка удаления характеристики
  const handleDelete = async () => {
    if (!characteristicToDelete) return

    const id = characteristicToDelete.id
    // Сохраняем удаляемую характеристику для отката
    const deletedCharacteristic = characteristics.find(char => char.id === id)
    if (!deletedCharacteristic) return

    // Оптимистичное обновление - удаляем локально
    setCharacteristics(prev => prev.filter(char => char.id !== id))
    setDeleteDialogOpen(false)
    setCharacteristicToDelete(null)

    try {
      const result = await deleteCharacteristic(id)
      if (result.success) {
        toast({
          title: "Успешно",
          description: "Характеристика удалена"
        })
      } else {
        // Откатываем изменения при ошибке
        setCharacteristics(prev => [...prev, deletedCharacteristic].sort((a, b) => b.id - a.id))
        toast({
          title: "Ошибка",
          description: result.message || "Не удалось удалить характеристику",
          variant: "destructive"
        })
      }
    } catch (error) {
      // Откатываем изменения при ошибке
      setCharacteristics(prev => [...prev, deletedCharacteristic].sort((a, b) => b.id - a.id))
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при удалении характеристики",
        variant: "destructive"
      })
    }
  }

  // Открыть диалог удаления
  const openDeleteDialog = (characteristic: CharacteristicsListItem) => {
    setCharacteristicToDelete(characteristic)
    setDeleteDialogOpen(true)
  }

  // Начать редактирование
  const startEdit = (characteristic: CharacteristicsListItem) => {
    setEditingId(characteristic.id)
    setFormData({
      characteristic_key: characteristic.characteristic_key,
      unit_of_measurement: characteristic.unit_of_measurement || ''
    })
  }

  // Отменить редактирование
  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({ characteristic_key: '', unit_of_measurement: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] h-[90vh] max-w-none flex flex-col">
        <DialogHeader>
          <DialogTitle>Справочник характеристик</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Поиск + кнопка добавления */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по наименованию..."
                className={cn("pl-9", SOFT_CONTROL)}
              />
            </div>
            <Button
              onClick={() => setIsCreating(true)}
              disabled={isCreating || editingId !== null}
              className={PRIMARY_BTN}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить характеристику
            </Button>
          </div>

          {/* Форма создания */}
          {isCreating && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="characteristic_key">Ключ характеристики *</Label>
                  <Input
                    id="characteristic_key"
                    value={formData.characteristic_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, characteristic_key: e.target.value }))}
                    placeholder="Например: ВЕС"
                    className={SOFT_CONTROL}
                  />
                </div>
                <div>
                  <Label htmlFor="unit_of_measurement">Единица измерения</Label>
                  <Input
                    id="unit_of_measurement"
                    value={formData.unit_of_measurement}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit_of_measurement: e.target.value }))}
                    placeholder="Например: кг"
                    className={SOFT_CONTROL}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleCreate}
                  disabled={loading}
                  className={PRIMARY_BTN}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Создать
                </Button>
                <Button variant="outline" onClick={cancelEdit} className={SECONDARY_BTN}>
                  <X className="mr-2 h-4 w-4" />
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {/* Список характеристик в 2 колонки */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredCharacteristics.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-500">
                {searchQuery ? `Ничего не найдено по запросу "${searchQuery}"` : 'Справочник характеристик пуст'}
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredCharacteristics.map((characteristic) => (
                  <div
                    key={characteristic.id}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                  >
                    <div className="space-y-1">
                      {/* Ключ характеристики */}
                      {editingId === characteristic.id ? (
                        <Input
                          value={formData.characteristic_key}
                          onChange={(e) => setFormData(prev => ({ ...prev, characteristic_key: e.target.value }))}
                          placeholder="Например: ВЕС"
                          autoFocus
                          className={cn("h-7 text-xs", SOFT_CONTROL)}
                        />
                      ) : (
                        <div className="text-sm font-semibold truncate" title={characteristic.characteristic_key}>
                          {characteristic.characteristic_key}
                        </div>
                      )}

                      {/* Единица измерения */}
                      {editingId === characteristic.id ? (
                        <Input
                          value={formData.unit_of_measurement}
                          onChange={(e) => setFormData(prev => ({ ...prev, unit_of_measurement: e.target.value }))}
                          placeholder="Например: кг"
                          className={cn("h-7 text-xs", SOFT_CONTROL)}
                        />
                      ) : (
                        <div className="text-xs text-gray-500">
                          {characteristic.unit_of_measurement || '—'}
                        </div>
                      )}

                      {/* Действия */}
                      <div className="flex gap-1 justify-end">
                        {editingId === characteristic.id ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-green-600 hover:bg-green-50" onClick={() => handleUpdate(characteristic.id)} disabled={loading}>
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100" onClick={cancelEdit}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-blue-600 hover:bg-blue-50" onClick={() => startEdit(characteristic)} disabled={editingId !== null || isCreating}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-red-600 hover:bg-red-50" onClick={() => openDeleteDialog(characteristic)} disabled={editingId !== null || isCreating}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className={SECONDARY_BTN}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить характеристику?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить характеристику "{characteristicToDelete?.characteristic_key}"?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={SECONDARY_BTN}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-[0_2px_6px_rgba(220,38,38,0.30)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.40)] transition-shadow"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
