"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { updateProfileAction } from "@/app/actions/auth"
import { toast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"

export default function MobileProfileSettings() {
  const { user } = useAuth()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  if (!user) {
    router.push("/auth")
    return null
  }

  const orgType = user.organization_type

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await updateProfileAction(formData)
        if (result.success) {
          toast({ title: "Успех!", description: result.message })
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.error })
        }
      } catch {
        toast({ variant: "destructive", title: "Ошибка", description: "Произошла ошибка при обновлении профиля" })
      }
    })
  }

  return (
    <div className="pb-6">
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Настройки профиля</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit(new FormData(e.currentTarget))
        }}
        className="px-4 pt-4 space-y-4"
      >
        {/* Личные данные */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Личные данные</h3>

          {/* ФИО / Название ИП / Название ТОО — только для клиентов */}
          {user.role === "client" && orgType === "individual" && (
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">ФИО</Label>
              <Input name="fullName" defaultValue={user.full_name} className="h-10 bg-white" />
            </div>
          )}
          {user.role === "client" && orgType === "ip" && (
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">Название ИП</Label>
              <Input name="ipName" defaultValue={user.ip_name} className="h-10 bg-white" />
            </div>
          )}
          {user.role === "client" && orgType === "too" && (
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">Название ТОО</Label>
              <Input name="tooName" defaultValue={user.too_name} className="h-10 bg-white" />
            </div>
          )}

          {/* Полное имя — для админов */}
          {user.role === "admin" && (
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">Полное имя</Label>
              <Input name="fullName" defaultValue={user.full_name} className="h-10 bg-white" />
            </div>
          )}

          {/* Email */}
          <div className="space-y-1">
            <Label className="text-sm text-gray-600">E-mail</Label>
            <Input name="email" type="email" defaultValue={user.email} disabled className="h-10 bg-gray-50 text-gray-500" />
            <p className="text-xs text-gray-400">E-mail нельзя изменить</p>
          </div>

          {/* Телефон */}
          <div className="space-y-1">
            <Label className="text-sm text-gray-600">Номер телефона</Label>
            <Input name="phone" type="tel" defaultValue={user.phone} className="h-10 bg-white" />
          </div>

          {/* ИИН для ИП */}
          {user.role === "client" && orgType === "ip" && (
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">ИИН</Label>
              <Input name="iin" defaultValue={user.iin} maxLength={12} className="h-10 bg-white" />
            </div>
          )}

          {/* БИН для ТОО */}
          {user.role === "client" && orgType === "too" && (
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">БИН</Label>
              <Input name="bin" defaultValue={user.bin} maxLength={12} className="h-10 bg-white" />
            </div>
          )}

          {/* Адрес доставки — только для клиентов */}
          {user.role === "client" && (
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">Адрес доставки</Label>
              <Input name="deliveryAddress" defaultValue={user.delivery_address} placeholder="Укажите адрес" className="h-10 bg-white" />
            </div>
          )}
        </div>

        {/* Смена пароля */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Смена пароля</h3>

          <div className="space-y-1">
            <Label className="text-sm text-gray-600">Новый пароль</Label>
            <div className="relative">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                className="h-10 bg-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">Оставьте пустым, если не хотите менять</p>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-gray-600">Повторите пароль</Label>
            <div className="relative">
              <Input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className="h-10 bg-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Кнопка сохранения */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-brand-yellow text-black hover:bg-yellow-500 rounded-xl h-11 font-medium"
          >
            {isPending ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      </form>
    </div>
  )
}
