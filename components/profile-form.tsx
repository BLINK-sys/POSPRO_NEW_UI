"use client"

import { useState, useTransition } from "react"
import { updateProfileAction } from '../app/actions/auth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../components/ui/use-toast'

// Определяем тип для начальных данных
interface UserProfile {
  role: "admin" | "client"
  organizationType?: "individual" | "ip" | "too"
  email: string
  phone?: string
  deliveryAddress?: string
  fullName?: string
  iin?: string
  ipName?: string
  bin?: string
  tooName?: string
  [key: string]: any
}

export function ProfileForm({ initialData }: { initialData: UserProfile }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<{ success: boolean; message?: string; error?: string }>({ success: false })

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await updateProfileAction(formData)
        setState(result)
        
        if (result.success) {
          toast({
            title: "Успех!",
            description: result.message,
          })
        } else {
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: result.error,
          })
        }
      } catch (error) {
        console.error("Error updating profile:", error)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Произошла ошибка при обновлении профиля",
        })
      }
    })
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      handleSubmit(formData)
    }} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={initialData.email} disabled />
        <p className="text-sm text-muted-foreground">Email нельзя изменить.</p>
      </div>

      {/* Поля для всех пользователей */}
      <div className="space-y-2">
        <Label htmlFor="phone">Номер телефона</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={initialData.phone} />
      </div>

      {/* Поля для админа */}
      {initialData.role === "admin" && (
        <div className="space-y-2">
          <Label htmlFor="fullName">Полное имя</Label>
          <Input id="fullName" name="fullName" defaultValue={initialData.fullName} />
        </div>
      )}

      {/* Поля для клиента */}
      {initialData.role === "client" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="deliveryAddress">Адрес доставки</Label>
            <Input id="deliveryAddress" name="deliveryAddress" defaultValue={initialData.deliveryAddress} />
          </div>

          {initialData.organizationType === "individual" && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Полное имя (ФИО)</Label>
              <Input id="fullName" name="fullName" defaultValue={initialData.fullName} />
            </div>
          )}

          {initialData.organizationType === "ip" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ipName">Название ИП</Label>
                <Input id="ipName" name="ipName" defaultValue={initialData.ipName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iin">ИИН</Label>
                <Input id="iin" name="iin" defaultValue={initialData.iin} maxLength={12} />
              </div>
            </>
          )}

          {initialData.organizationType === "too" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tooName">Название ТОО</Label>
                <Input id="tooName" name="tooName" defaultValue={initialData.tooName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin">БИН</Label>
                <Input id="bin" name="bin" defaultValue={initialData.bin} maxLength={12} />
              </div>
            </>
          )}
        </>
      )}

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium">Смена пароля</h3>
        <p className="text-sm text-muted-foreground mb-4">Оставьте поле пустым, если не хотите менять пароль.</p>
        <div className="space-y-2">
          <Label htmlFor="password">Новый пароль</Label>
          <Input id="password" name="password" type="password" />
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="bg-brand-yellow text-black hover:bg-yellow-500">
        {isPending ? "Сохранение..." : "Сохранить изменения"}
      </Button>
    </form>
  )
}
