"use client"

import { useState, useTransition } from "react"
import { type Supplier, createSupplier, updateSupplier } from "@/app/actions/suppliers"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "./ui/use-toast"
import { cn } from "@/lib/utils"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface SupplierEditDialogProps {
  supplier?: Supplier | null
  onClose: () => void
  onSaved: (supplier: Supplier, isNew: boolean) => void
}

export function SupplierEditDialog({ supplier, onClose, onSaved }: SupplierEditDialogProps) {
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    contact_person: supplier?.contact_person || "",
    phone: supplier?.phone || "",
    email: supplier?.email || "",
    address: supplier?.address || "",
    description: supplier?.description || "",
  })
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Название поставщика обязательно для заполнения",
      })
      return
    }

    startTransition(async () => {
      const data = {
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        description: formData.description.trim() || null,
      }

      const result = supplier
        ? await updateSupplier(supplier.id, data)
        : await createSupplier(data as Omit<Supplier, "id">)

      if (result.success && result.data) {
        toast({
          title: "Успех!",
          description: result.message || (supplier ? "Поставщик обновлен" : "Поставщик создан"),
        })
        onSaved(result.data, !supplier)
        onClose()
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: result.error || "Не удалось сохранить поставщика",
        })
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Редактировать поставщика" : "Создать поставщика"}</DialogTitle>
          <DialogDescription>
            {supplier
              ? "Внесите изменения в информацию о поставщике"
              : "Заполните информацию о новом поставщике"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Название <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ООО Поставщик"
              required
              disabled={isPending}
              className={SOFT_CONTROL}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">Контактное лицо</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Иванов И.И."
                disabled={isPending}
                className={SOFT_CONTROL}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (999) 123-45-67"
                disabled={isPending}
                className={SOFT_CONTROL}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="supplier@example.com"
              disabled={isPending}
              className={SOFT_CONTROL}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Адрес</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="г. Москва, ул. Примерная, д. 1"
              rows={2}
              disabled={isPending}
              className={SOFT_CONTROL}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Дополнительная информация о поставщике"
              rows={3}
              disabled={isPending}
              className={SOFT_CONTROL}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className={SECONDARY_BTN}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending} className={PRIMARY_BTN}>
              {isPending ? "Сохранение..." : supplier ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

