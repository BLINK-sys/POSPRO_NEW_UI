"use client"

import { useEffect, useState, useTransition } from "react"
import type { SystemUser, UserActionState } from "@/app/actions/users"
import { saveSystemUser } from "@/app/actions/users"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

interface SystemUserEditDialogProps {
  user?: SystemUser | null
  onClose: () => void
}

const accessTranslations: Record<string, string> = {
  orders: "Заказы",
  catalog: "Каталог",
  clients: "Клиенты",
  users: "Пользователи",
  settings: "Настройки",
  dashboard: "Дашборд",
  brands: "Бренды",
  statuses: "Статусы",
  pages: "Страницы",
}

export function SystemUserEditDialog({ user, onClose }: SystemUserEditDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<UserActionState>({ success: false })

  const isEditMode = !!user

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await saveSystemUser(state, formData)
        setState(result)
        
        if (result.success) {
          toast({ title: "Успех!", description: result.message })
          onClose()
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.error })
        }
      } catch (error) {
        console.error("Error saving system user:", error)
        toast({ variant: "destructive", title: "Ошибка", description: "Произошла ошибка при сохранении пользователя" })
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Редактировать пользователя" : "Создать пользователя"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Измените данные и права доступа." : "Заполните данные для нового пользователя."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          handleSubmit(formData)
        }}>
          {isEditMode && <input type="hidden" name="id" value={user.id} />}
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Полное имя</Label>
              <Input name="full_name" defaultValue={user?.full_name ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input name="email" type="email" defaultValue={user?.email ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input name="phone" type="tel" defaultValue={user?.phone ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                name="password"
                type="password"
                placeholder={isEditMode ? "Оставьте пустым, чтобы не менять" : ""}
                required={!isEditMode}
              />
            </div>
            <div className="space-y-2">
              <Label>Права доступа</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-4">
                {Object.entries(accessTranslations).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox id={`access_${key}`} name={`access_${key}`} defaultChecked={user?.access[key] ?? false} />
                    <Label htmlFor={`access_${key}`} className="font-normal">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
