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
import { useAuth } from "@/context/auth-context"
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
  const { user: currentUser, refreshUser } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<UserActionState>({ success: false })

  const isEditMode = !!user

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await saveSystemUser(state, formData)
        setState(result)

        if (result.success) {
          // Если редактировали себя — обновить права в контексте
          if (user && currentUser && user.id === currentUser.id) {
            await refreshUser()
          }
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
              <Input name="full_name" defaultValue={user?.full_name ?? ""} required className={SOFT_CONTROL} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input name="email" type="email" defaultValue={user?.email ?? ""} required className={SOFT_CONTROL} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input name="phone" type="tel" defaultValue={user?.phone ?? ""} required className={SOFT_CONTROL} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                name="password"
                type="password"
                placeholder={isEditMode ? "Оставьте пустым, чтобы не менять" : ""}
                required={!isEditMode}
                className={SOFT_CONTROL}
              />
            </div>
            <div className="space-y-2">
              <Label>Права доступа</Label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {Object.entries(accessTranslations).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`access_${key}`}
                      name={`access_${key}`}
                      defaultChecked={user?.access[key] ?? false}
                      className="data-[state=checked]:bg-brand-yellow data-[state=checked]:border-brand-yellow data-[state=checked]:text-black"
                    />
                    <Label htmlFor={`access_${key}`} className="font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className={SECONDARY_BTN}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending} className={PRIMARY_BTN}>
              {isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
