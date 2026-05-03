"use client"

import { useState, useTransition } from "react"
import {
  type Warehouse,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "@/app/actions/warehouses"
import type { Supplier } from "@/app/actions/suppliers"
import type { Currency } from "@/app/actions/currencies"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { Pencil, Trash2, Plus, MapPin, Coins, Package, Calculator } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface WarehousesManagementProps {
  initialWarehouses: Warehouse[]
  suppliers: Supplier[]
  currencies: Currency[]
}

export function WarehousesManagement({
  initialWarehouses,
  suppliers,
  currencies,
}: WarehousesManagementProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null)
  const [filterSupplierId, setFilterSupplierId] = useState<string>("all")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const [formData, setFormData] = useState({
    supplier_id: "",
    name: "",
    city: "",
    address: "",
    currency_id: "",
  })

  const openCreate = () => {
    setFormData({ supplier_id: "", name: "", city: "", address: "", currency_id: "" })
    setIsCreating(true)
  }

  const openEdit = (warehouse: Warehouse) => {
    setFormData({
      supplier_id: String(warehouse.supplier_id),
      name: warehouse.name,
      city: warehouse.city || "",
      address: warehouse.address || "",
      currency_id: String(warehouse.currency_id),
    })
    setEditingWarehouse(warehouse)
  }

  const handleSave = () => {
    if (!formData.name.trim() || !formData.supplier_id || !formData.currency_id) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Заполните название, поставщика и валюту",
      })
      return
    }

    startTransition(async () => {
      const data = {
        supplier_id: Number(formData.supplier_id),
        name: formData.name.trim(),
        city: formData.city.trim() || undefined,
        address: formData.address.trim() || undefined,
        currency_id: Number(formData.currency_id),
      }

      const result = editingWarehouse
        ? await updateWarehouse(editingWarehouse.id, data)
        : await createWarehouse(data)

      if (result.success && result.data) {
        toast({ title: "Успех!", description: result.message })
        if (editingWarehouse) {
          setWarehouses(warehouses.map((w) => (w.id === editingWarehouse.id ? { ...result.data!, product_count: editingWarehouse.product_count, has_formula: editingWarehouse.has_formula } : w)))
        } else {
          setWarehouses([...warehouses, { ...result.data, product_count: 0, has_formula: false }])
        }
        setIsCreating(false)
        setEditingWarehouse(null)
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
    })
  }

  const handleDelete = () => {
    if (!deletingWarehouse) return
    startTransition(async () => {
      const result = await deleteWarehouse(deletingWarehouse.id)
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
        setWarehouses(warehouses.filter((w) => w.id !== deletingWarehouse.id))
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
      setDeletingWarehouse(null)
    })
  }

  const filteredWarehouses = filterSupplierId === "all"
    ? warehouses
    : warehouses.filter((w) => w.supplier_id === Number(filterSupplierId))

  const dialogOpen = isCreating || !!editingWarehouse

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={filterSupplierId} onValueChange={setFilterSupplierId}>
          <SelectTrigger className={cn("w-[250px] h-10", SOFT_CONTROL)}>
            <SelectValue placeholder="Все поставщики" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все поставщики</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className={cn("flex items-center gap-2", PRIMARY_BTN)}>
          <Plus className="h-4 w-4" />
          Добавить склад
        </Button>
      </div>

      {filteredWarehouses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWarehouses.map((warehouse) => (
            <Card
              key={warehouse.id}
              className="cursor-pointer rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all"
              onClick={() => router.push(`/admin/suppliers/warehouses/${warehouse.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">
                    <span className="text-xs text-gray-400 font-normal mr-1">#{warehouse.id}</span>
                    {warehouse.name}
                  </h3>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(warehouse)}
                      className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                      title="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingWarehouse(warehouse)}
                      className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-2">{warehouse.supplier_name}</p>
                {warehouse.city && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                    <MapPin className="h-3 w-3" />
                    {warehouse.city}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {warehouse.currency && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {warehouse.currency.code} ({warehouse.currency.rate_to_tenge} тг)
                    </Badge>
                  )}
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {warehouse.product_count || 0}
                  </Badge>
                  {warehouse.has_formula && (
                    <Badge className="flex items-center gap-1 bg-green-100 text-green-700 border border-green-200 hover:bg-green-100">
                      <Calculator className="h-3 w-3" />
                      Формула
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardContent className="text-center text-gray-500 py-12">
            {filterSupplierId !== "all"
              ? "У этого поставщика нет складов."
              : "Нет складов. Создайте первый склад."}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) { setIsCreating(false); setEditingWarehouse(null) }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingWarehouse ? "Редактировать склад" : "Добавить склад"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Поставщик <span className="text-red-500">*</span></Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(val) => setFormData({ ...formData, supplier_id: val })}
                disabled={isPending}
              >
                <SelectTrigger className={SOFT_CONTROL}>
                  <SelectValue placeholder="Выберите поставщика" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Название склада <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Склад Гуанчжоу"
                disabled={isPending}
                className={SOFT_CONTROL}
              />
            </div>
            <div className="space-y-2">
              <Label>Город</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Гуанчжоу"
                disabled={isPending}
                className={SOFT_CONTROL}
              />
            </div>
            <div className="space-y-2">
              <Label>Адрес</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Адрес склада"
                disabled={isPending}
                className={SOFT_CONTROL}
              />
            </div>
            <div className="space-y-2">
              <Label>Валюта <span className="text-red-500">*</span></Label>
              <Select
                value={formData.currency_id}
                onValueChange={(val) => setFormData({ ...formData, currency_id: val })}
                disabled={isPending}
              >
                <SelectTrigger className={SOFT_CONTROL}>
                  <SelectValue placeholder="Выберите валюту" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.code}) — {c.rate_to_tenge} тг
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsCreating(false); setEditingWarehouse(null) }}
              disabled={isPending}
              className={SECONDARY_BTN}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isPending} className={PRIMARY_BTN}>
              {isPending ? "Сохранение..." : editingWarehouse ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        open={!!deletingWarehouse}
        onOpenChange={(open) => !open && setDeletingWarehouse(null)}
        onConfirm={handleDelete}
        title={`Удалить склад "${deletingWarehouse?.name}"?`}
        description="Все формулы и себестоимости товаров на этом складе будут удалены. Это действие необратимо."
      />
    </div>
  )
}
