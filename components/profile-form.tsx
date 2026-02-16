"use client"

import { useState, useTransition } from "react"
import { updateProfileAction } from "@/app/actions/auth"
import type { User } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { User as UserIcon, Phone, Smile, Lock, Eye, EyeOff, Mail, MapPin, FileText, Building } from "lucide-react"

export function ProfileForm({ initialData }: { initialData: User }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await updateProfileAction(formData)

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

  const orgType = initialData.organization_type

  return (
    <div className="bg-gray-100 rounded-lg p-6">
      <form onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        handleSubmit(formData)
      }} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Левая колонка - Личные данные */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Личные данные</h3>

            {/* ФИО для физических лиц */}
            {initialData.role === "client" && orgType === "individual" && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm text-gray-600">ФИО</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="fullName"
                    name="fullName"
                    defaultValue={initialData.full_name}
                    className="pl-10 bg-white border-gray-300"
                  />
                </div>
              </div>
            )}

            {/* Название ИП для ИП */}
            {initialData.role === "client" && orgType === "ip" && (
              <div className="space-y-2">
                <Label htmlFor="ipName" className="text-sm text-gray-600">Название ИП</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="ipName"
                    name="ipName"
                    defaultValue={initialData.ip_name}
                    className="pl-10 bg-white border-gray-300"
                  />
                </div>
              </div>
            )}

            {/* Название ТОО для ТОО */}
            {initialData.role === "client" && orgType === "too" && (
              <div className="space-y-2">
                <Label htmlFor="tooName" className="text-sm text-gray-600">Название ТОО</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="tooName"
                    name="tooName"
                    defaultValue={initialData.too_name}
                    className="pl-10 bg-white border-gray-300"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-gray-600">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={initialData.email}
                  disabled
                  className="pl-10 bg-white border-gray-300"
                />
              </div>
              <p className="text-xs text-gray-500">E-mail нельзя изменить</p>
            </div>

            {/* ИИН для ИП */}
            {initialData.role === "client" && orgType === "ip" && (
              <div className="space-y-2">
                <Label htmlFor="iin" className="text-sm text-gray-600">ИИН</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="iin"
                    name="iin"
                    defaultValue={initialData.iin}
                    maxLength={12}
                    className="pl-10 bg-white border-gray-300"
                  />
                </div>
              </div>
            )}

            {/* БИН для ТОО */}
            {initialData.role === "client" && orgType === "too" && (
              <div className="space-y-2">
                <Label htmlFor="bin" className="text-sm text-gray-600">БИН</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="bin"
                    name="bin"
                    defaultValue={initialData.bin}
                    maxLength={12}
                    className="pl-10 bg-white border-gray-300"
                  />
                </div>
              </div>
            )}

            {/* Телефон */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm text-gray-600">Номер телефона</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={initialData.phone}
                  className="pl-10 bg-white border-gray-300"
                />
              </div>
            </div>

            {/* Адрес доставки для клиентов */}
            {initialData.role === "client" && (
              <div className="space-y-2">
                <Label htmlFor="deliveryAddress" className="text-sm text-gray-600">Адрес доставки</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="deliveryAddress"
                    name="deliveryAddress"
                    defaultValue={initialData.delivery_address}
                    placeholder="Введите адрес доставки"
                    className="pl-10 bg-white border-gray-300"
                  />
                </div>
              </div>
            )}

            {/* Полное имя для админов */}
            {initialData.role === "admin" && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm text-gray-600">Полное Имя</Label>
                <div className="relative">
                  <Smile className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="fullName"
                    name="fullName"
                    defaultValue={initialData.full_name}
                    className="pl-10 bg-white border-gray-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Правая колонка - Управление паролем */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Управление паролем</h3>

            {/* Пароль */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-gray-600">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="pl-10 pr-10 bg-white border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Оставьте поле пустым, если не хотите менять пароль</p>
            </div>

            {/* Повторить пароль */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm text-gray-600">Повторите новый пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className="pl-10 pr-10 bg-white border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопка сохранения */}
        <div className="flex justify-center pt-6">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-brand-yellow text-black hover:bg-yellow-500 px-8 py-2 rounded-lg font-medium"
          >
            {isPending ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      </form>
    </div>
  )
}
