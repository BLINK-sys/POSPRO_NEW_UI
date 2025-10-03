"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { loginAction, registerAction } from "@/app/actions/auth"
import { useToast } from "@/components/ui/use-toast"
import { motion, AnimatePresence } from "framer-motion"

export const dynamic = 'force-dynamic'

type OrganizationType = "individual" | "ip" | "too"
type AuthMode = "login" | "register"

interface ActionState {
  error?: string
  success?: boolean
  message?: string
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login")
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
      setMode("login")
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
    <div className="h-screen flex overflow-hidden">
      {/* Левая половина с изображением */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative">
        <div className="absolute inset-0 bg-black/20 z-10"></div>
        <img 
          src="/ui/login_screen.png" 
          alt="Login Screen" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Правая половина с формой */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 sm:px-6 lg:px-8 h-screen overflow-y-auto">
        <div className="max-w-md w-full space-y-3 py-4">
        <div className="text-center">
          <h2 className="text-xl font-extrabold text-gray-900">
            {mode === "login" ? "Вход в аккаунт" : "Создание аккаунта"}
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            {mode === "login" ? "Войдите в свой аккаунт" : "Создайте новый аккаунт"}
          </p>
        </div>

        {/* Кнопки переключения */}
        <div className="flex bg-gray-200 rounded-full p-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
              mode === "login"
                ? "bg-brand-yellow text-black shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Вход
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
              mode === "register"
                ? "bg-brand-yellow text-black shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Регистрация
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="pt-3">
                <form id="login-form" action={handleLogin} className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="login-email" className="text-sm">Email</Label>
                      <Input 
                        id="login-email" 
                        name="email" 
                        type="email" 
                        placeholder="info@pospro.kz" 
                        required 
                        className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                        style={{
                          outline: 'none !important',
                          boxShadow: 'none !important',
                          borderColor: 'rgb(209 213 219) !important'
                        }}
                        onFocus={(e) => {
                          e.target.style.outline = 'none'
                          e.target.style.boxShadow = 'none'
                          e.target.style.borderColor = 'rgb(209 213 219)'
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="login-password" className="text-sm">Пароль</Label>
                      <Input 
                        id="login-password" 
                        name="password" 
                        type="password" 
                        placeholder="Укажите пароль"
                        required 
                        className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                        style={{
                          outline: 'none !important',
                          boxShadow: 'none !important',
                          borderColor: 'rgb(209 213 219) !important'
                        }}
                        onFocus={(e) => {
                          e.target.style.outline = 'none'
                          e.target.style.boxShadow = 'none'
                          e.target.style.borderColor = 'rgb(209 213 219)'
                        }}
                      />
                    </div>
                  </form>
                  
                  <div className="mt-8">
                    <Button 
                      type="submit" 
                      form="login-form"
                      className="w-full bg-brand-yellow text-black hover:bg-yellow-500 rounded-full" 
                      disabled={isPending}
                    >
                      {isPending ? "Вход..." : "Войти"}
                    </Button>
                  </div>
                  
                  {/* Разделитель */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-100 text-gray-500">ИЛИ</span>
                    </div>
                  </div>
                  
                  {/* Кнопка "Войти как гость!" */}
                  <Button 
                    onClick={() => router.push("/")}
                    className="w-full bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-full"
                  >
                    Войти как гость!
                  </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="pt-3">
                <form id="register-form" action={handleRegister} className="space-y-4">
                    {/* Скрытое поле для типа организации */}
                    <input type="hidden" name="organizationType" value={organizationType} />
                    
                    {/* Тип организации - на всю ширину */}
                    <div className="space-y-3 text-center">
                      <Label className="text-sm">Тип организации</Label>
                      <div className="flex bg-gray-200 rounded-full p-1 max-w-md mx-auto">
                        <button
                          type="button"
                          onClick={() => handleTypeChange("individual")}
                          className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                            organizationType === "individual"
                              ? "bg-brand-yellow text-black shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          Физ. лицо
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTypeChange("ip")}
                          className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                            organizationType === "ip"
                              ? "bg-brand-yellow text-black shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          ИП
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTypeChange("too")}
                          className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                            organizationType === "too"
                              ? "bg-brand-yellow text-black shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          ТОО
                        </button>
                      </div>
                    </div>

                    {/* Двухколоночная компоновка */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Левая колонка */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="email" className="text-sm">Email</Label>
                          <Input 
                            name="email" 
                            type="email" 
                            placeholder="info@pospro.kz" 
                            required 
                            className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                            style={{
                              outline: 'none !important',
                              boxShadow: 'none !important',
                              borderColor: 'rgb(209 213 219) !important'
                            }}
                            onFocus={(e) => {
                              e.target.style.outline = 'none'
                              e.target.style.boxShadow = 'none'
                              e.target.style.borderColor = 'rgb(209 213 219)'
                            }}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="phone" className="text-sm">Номер телефона</Label>
                          <Input 
                            name="phone" 
                            type="tel" 
                            placeholder="+7 777 123 45 67" 
                            required 
                            className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                            style={{
                              outline: 'none !important',
                              boxShadow: 'none !important',
                              borderColor: 'rgb(209 213 219) !important'
                            }}
                            onFocus={(e) => {
                              e.target.style.outline = 'none'
                              e.target.style.boxShadow = 'none'
                              e.target.style.borderColor = 'rgb(209 213 219)'
                            }}
                          />
                        </div>

                        {organizationType === "individual" && (
                          <div className="space-y-1">
                            <Label htmlFor="fullName" className="text-sm">Полное имя (ФИО)</Label>
                            <Input 
                              name="fullName" 
                              placeholder="Иванов Иван Иванович" 
                              className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                              style={{
                                outline: 'none !important',
                                boxShadow: 'none !important',
                                borderColor: 'rgb(209 213 219) !important'
                              }}
                              onFocus={(e) => {
                                e.target.style.outline = 'none'
                                e.target.style.boxShadow = 'none'
                                e.target.style.borderColor = 'rgb(209 213 219)'
                              }}
                            />
                          </div>
                        )}

                        {organizationType === "ip" && (
                          <div className="space-y-1">
                            <Label htmlFor="ipName" className="text-sm">Название ИП</Label>
                            <Input 
                              name="ipName" 
                              placeholder="ИП PosPro" 
                              className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                              style={{
                                outline: 'none !important',
                                boxShadow: 'none !important',
                                borderColor: 'rgb(209 213 219) !important'
                              }}
                              onFocus={(e) => {
                                e.target.style.outline = 'none'
                                e.target.style.boxShadow = 'none'
                                e.target.style.borderColor = 'rgb(209 213 219)'
                              }}
                            />
                          </div>
                        )}

                        {organizationType === "too" && (
                          <div className="space-y-1">
                            <Label htmlFor="tooName" className="text-sm">Название ТОО</Label>
                            <Input 
                              name="tooName" 
                              placeholder="ТОО 'PosPro'" 
                              className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                              style={{
                                outline: 'none !important',
                                boxShadow: 'none !important',
                                borderColor: 'rgb(209 213 219) !important'
                              }}
                              onFocus={(e) => {
                                e.target.style.outline = 'none'
                                e.target.style.boxShadow = 'none'
                                e.target.style.borderColor = 'rgb(209 213 219)'
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Правая колонка */}
                      <div className="space-y-3">
                        {organizationType === "ip" && (
                          <div className="space-y-1">
                            <Label htmlFor="iin" className="text-sm">ИИН (12 цифр)</Label>
                            <Input 
                              name="iin" 
                              placeholder="123456789012" 
                              maxLength={12} 
                              className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                              style={{
                                outline: 'none !important',
                                boxShadow: 'none !important',
                                borderColor: 'rgb(209 213 219) !important'
                              }}
                              onFocus={(e) => {
                                e.target.style.outline = 'none'
                                e.target.style.boxShadow = 'none'
                                e.target.style.borderColor = 'rgb(209 213 219)'
                              }}
                            />
                          </div>
                        )}

                        {organizationType === "too" && (
                          <div className="space-y-1">
                            <Label htmlFor="bin" className="text-sm">БИН (12 цифр)</Label>
                            <Input 
                              name="bin" 
                              placeholder="123456789012" 
                              maxLength={12} 
                              className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                              style={{
                                outline: 'none !important',
                                boxShadow: 'none !important',
                                borderColor: 'rgb(209 213 219) !important'
                              }}
                              onFocus={(e) => {
                                e.target.style.outline = 'none'
                                e.target.style.boxShadow = 'none'
                                e.target.style.borderColor = 'rgb(209 213 219)'
                              }}
                            />
                          </div>
                        )}
                        
                        <div className="space-y-1">
                          <Label htmlFor="deliveryAddress" className="text-sm">Адрес доставки</Label>
                          <Input 
                            name="deliveryAddress" 
                            placeholder="Укажите адрес" 
                            required 
                            className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                            style={{
                              outline: 'none !important',
                              boxShadow: 'none !important',
                              borderColor: 'rgb(209 213 219) !important'
                            }}
                            onFocus={(e) => {
                              e.target.style.outline = 'none'
                              e.target.style.boxShadow = 'none'
                              e.target.style.borderColor = 'rgb(209 213 219)'
                            }}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="password" className="text-sm">Пароль</Label>
                          <Input 
                            name="password" 
                            type="password" 
                            placeholder="Укажите пароль"
                            required 
                            className="h-9 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                            style={{
                              outline: 'none !important',
                              boxShadow: 'none !important',
                              borderColor: 'rgb(209 213 219) !important'
                            }}
                            onFocus={(e) => {
                              e.target.style.outline = 'none'
                              e.target.style.boxShadow = 'none'
                              e.target.style.borderColor = 'rgb(209 213 219)'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                  </form>
                  
                  <div className="mt-8">
                    <Button 
                      type="submit" 
                      form="register-form"
                      className="w-full bg-brand-yellow text-black hover:bg-yellow-500 rounded-full" 
                      disabled={isPending}
                    >
                      {isPending ? "Регистрация..." : "Зарегистрироваться"}
                    </Button>
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
