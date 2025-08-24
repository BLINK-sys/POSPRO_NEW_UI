"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loginAction, registerAction } from "@/app/actions/auth"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

type OrganizationType = "individual" | "ip" | "too"

interface ActionState {
  error?: string
  success?: boolean
  message?: string
}

export function AuthForm() {
  const [organizationType, setOrganizationType] = useState<OrganizationType>("individual")
  const [isPending, startTransition] = useTransition()
  const [loginState, setLoginState] = useState<ActionState>({ success: false })
  const [registerState, setRegisterState] = useState<ActionState>({ success: false })
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (loginState.success) {
      router.push("/")
      router.refresh()
    }
    if (loginState.error) {
      toast({ variant: "destructive", title: "Ошибка входа", description: loginState.error })
    }
  }, [loginState, router, toast])

  useEffect(() => {
    if (registerState.success) {
      toast({ title: "Успех!", description: "Вы успешно зарегистрированы. Теперь можете войти." })
    }
    if (registerState.error) {
      toast({ variant: "destructive", title: "Ошибка регистрации", description: registerState.error })
    }
  }, [registerState, toast])

  const handleLogin = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await loginAction({ error: undefined, success: false }, formData)
        setLoginState(result)
      } catch (error) {
        setLoginState({ error: "Произошла ошибка при входе", success: false })
      }
    })
  }

  const handleRegister = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await registerAction({ error: undefined, success: false }, formData)
        setRegisterState(result)
      } catch (error) {
        setRegisterState({ error: "Произошла ошибка при регистрации", success: false })
      }
    })
  }

  const handleTypeChange = (value: string) => {
    setOrganizationType(value as OrganizationType)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Авторизация
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Войдите в аккаунт или создайте новый
          </p>
        </div>
        
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card>
              <CardContent className="pt-6">
                <form action={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" placeholder="m@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Пароль</Label>
                    <Input id="login-password" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full bg-brand-yellow text-black hover:bg-yellow-500" disabled={isPending}>
                    {isPending ? "Вход..." : "Войти"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="register">
            <Card>
              <CardContent className="pt-6">
                <form action={handleRegister} className="space-y-6">
                  <div className="space-y-2">
                    <Label>Тип организации</Label>
                    <RadioGroup
                      name="organizationType"
                      defaultValue="individual"
                      onValueChange={handleTypeChange}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="individual" id="individual" />
                        <Label htmlFor="individual">Физ. лицо</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ip" id="ip" />
                        <Label htmlFor="ip">ИП</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="too" id="too" />
                        <Label htmlFor="too">ТОО</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input name="email" type="email" placeholder="m@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Номер телефона</Label>
                    <Input name="phone" type="tel" placeholder="+7 777 123 45 67" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryAddress">Адрес доставки</Label>
                    <Input name="deliveryAddress" placeholder="г. Алматы, ул. Примерная, д. 1" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <Input name="password" type="password" required />
                  </div>

                  {organizationType === "individual" && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Полное имя (ФИО)</Label>
                      <Input name="fullName" placeholder="Иванов Иван Иванович" />
                    </div>
                  )}

                  {organizationType === "ip" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="iin">ИИН (12 цифр)</Label>
                        <Input name="iin" placeholder="123456789012" maxLength={12} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ipName">Название ИП</Label>
                        <Input name="ipName" placeholder="ИП Иванов И.И." />
                      </div>
                    </>
                  )}

                  {organizationType === "too" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="bin">БИН (12 цифр)</Label>
                        <Input name="bin" placeholder="123456789012" maxLength={12} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tooName">Название ТОО</Label>
                        <Input name="tooName" placeholder="ТОО 'Рога и копыта'" />
                      </div>
                    </>
                  )}

                  <Button type="submit" className="w-full bg-brand-yellow text-black hover:bg-yellow-500" disabled={isPending}>
                    {isPending ? "Регистрация..." : "Зарегистрироваться"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
