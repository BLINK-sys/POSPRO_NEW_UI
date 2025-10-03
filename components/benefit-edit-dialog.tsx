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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { iconOptions } from "@/lib/icon-mapping"

interface Benefit {
  id: number
  icon: string
  title: string
  description: string
  order: number
}

interface BenefitEditDialogProps {
  benefit: Benefit | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Omit<Benefit, "id" | "order"> & { order?: number }) => void
}

export default function BenefitEditDialog({ benefit, open, onOpenChange, onSave }: BenefitEditDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState("shield")

  useEffect(() => {
    if (benefit) {
      setTitle(benefit.title)
      setDescription(benefit.description)
      setIcon(benefit.icon)
    } else {
      setTitle("")
      setDescription("")
      setIcon("shield")
    }
  }, [benefit, open])

  const handleSubmit = () => {
    onSave({ title, description, icon })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{benefit ? "Редактировать преимущество" : "Создать преимущество"}</DialogTitle>
          <DialogDescription>Заполните информацию о преимуществе.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Заголовок</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="icon">Иконка</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите иконку" />
              </SelectTrigger>
              <SelectContent>
                {iconOptions.map(({ value, label, icon: IconComponent }) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center">
                      <IconComponent className="h-4 w-4 mr-2" />
                      <span>{label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
