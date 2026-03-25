"use client"

import { useState, useTransition } from "react"
import {
  type Currency,
  createCurrency,
  updateCurrency,
  deleteCurrency,
} from "@/app/actions/currencies"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Trash2, Plus } from "lucide-react"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"

interface CurrenciesManagementProps {
  initialCurrencies: Currency[]
}

export function CurrenciesManagement({ initialCurrencies }: CurrenciesManagementProps) {
  const [currencies, setCurrencies] = useState<Currency[]>(initialCurrencies)
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingCurrency, setDeletingCurrency] = useState<Currency | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    rate_to_tenge: 1,
  })

  const openCreate = () => {
    setFormData({ name: "", code: "", rate_to_tenge: 1 })
    setIsCreating(true)
  }

  const openEdit = (currency: Currency) => {
    setFormData({
      name: currency.name,
      code: currency.code,
      rate_to_tenge: currency.rate_to_tenge,
    })
    setEditingCurrency(currency)
  }

  const handleSave = () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({ variant: "destructive", title: "Ошибка", description: "Заполните название и код" })
      return
    }

    startTransition(async () => {
      const data = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        rate_to_tenge: Number(formData.rate_to_tenge),
      }

      const result = editingCurrency
        ? await updateCurrency(editingCurrency.id, data)
        : await createCurrency(data)

      if (result.success && result.data) {
        toast({ title: "Успех!", description: result.message })
        if (editingCurrency) {
          setCurrencies(currencies.map((c) => (c.id === editingCurrency.id ? result.data! : c)))
        } else {
          setCurrencies([...currencies, result.data])
        }
        setIsCreating(false)
        setEditingCurrency(null)
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleDelete = () => {
    if (!deletingCurrency) return
    startTransition(async () => {
      const result = await deleteCurrency(deletingCurrency.id)
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
        setCurrencies(currencies.filter((c) => c.id !== deletingCurrency.id))
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
      setDeletingCurrency(null)
    })
  }

  const dialogOpen = isCreating || !!editingCurrency

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Добавить валюту
        </Button>
      </div>

      {currencies.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Код</TableHead>
              <TableHead className="text-right">Курс к тенге</TableHead>
              <TableHead className="text-right w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currencies.map((currency) => (
              <TableRow key={currency.id}>
                <TableCell className="font-medium">{currency.name}</TableCell>
                <TableCell>{currency.code}</TableCell>
                <TableCell className="text-right">
                  {currency.rate_to_tenge.toLocaleString("ru-RU")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(currency)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingCurrency(currency)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center text-gray-500 py-8">
          Нет валют. Добавьте первую валюту для работы со складами.
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreating(false)
          setEditingCurrency(null)
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCurrency ? "Редактировать валюту" : "Добавить валюту"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Китайский юань"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Код валюты <span className="text-red-500">*</span></Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="CNY"
                maxLength={10}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Курс к тенге</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.rate_to_tenge}
                onChange={(e) => setFormData({ ...formData, rate_to_tenge: parseFloat(e.target.value) || 0 })}
                placeholder="68.5"
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsCreating(false); setEditingCurrency(null) }}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Сохранение..." : editingCurrency ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        open={!!deletingCurrency}
        onOpenChange={(open) => !open && setDeletingCurrency(null)}
        onConfirm={handleDelete}
        title={`Удалить валюту "${deletingCurrency?.name}"?`}
        description="Это действие необратимо. Валюту нельзя удалить, если она используется в складах."
      />
    </div>
  )
}
