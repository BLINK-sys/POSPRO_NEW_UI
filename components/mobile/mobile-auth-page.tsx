"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction, registerAction } from "@/app/actions/auth"
import { toast } from "@/hooks/use-toast"

type OrgType = "individual" | "ip" | "too"

export default function MobileAuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Register state
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [orgType, setOrgType] = useState<OrgType>("individual")
  const [fullName, setFullName] = useState("")
  const [ipName, setIpName] = useState("")
  const [tooName, setTooName] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("email", email)
      formData.append("password", password)
      const result = await loginAction({ success: false }, formData)
      if (result.success) {
        router.push("/")
        router.refresh()
      } else {
        toast({ title: "Ошибка", description: result.error || "Неверные данные", variant: "destructive" })
      }
    } catch {
      toast({ title: "Ошибка входа", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!regEmail || !regPassword) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("email", regEmail)
      formData.append("password", regPassword)
      formData.append("phone", regPhone)
      formData.append("organization_type", orgType)
      formData.append("delivery_address", deliveryAddress)
      if (orgType === "individual") formData.append("full_name", fullName)
      if (orgType === "ip") formData.append("ip_name", ipName)
      if (orgType === "too") formData.append("too_name", tooName)

      const result = await registerAction({ success: false }, formData)
      if (result.success) {
        toast({ title: "Успех!", description: "Вы успешно зарегистрированы. Теперь можете войти." })
        setMode("login")
      } else {
        toast({ title: "Ошибка регистрации", description: result.error || "Проверьте данные", variant: "destructive" })
      }
    } catch {
      toast({ title: "Ошибка регистрации", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleGuestLogin = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("email", "guest@pospro.kz")
      formData.append("password", "guest123")
      const result = await loginAction({ success: false }, formData)
      if (result.success) {
        router.push("/")
        router.refresh()
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6">
      {/* Переключатель */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            mode === "login" ? "bg-white shadow-sm text-black" : "text-gray-500"
          }`}
        >
          Вход
        </button>
        <button
          onClick={() => setMode("register")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            mode === "register" ? "bg-white shadow-sm text-black" : "text-gray-500"
          }`}
        >
          Регистрация
        </button>
      </div>

      {mode === "login" ? (
        /* ======= ФОРМА ВХОДА ======= */
        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-1.5 block">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="h-11 rounded-lg"
            />
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">Пароль</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="h-11 rounded-lg"
            />
          </div>
          <Button
            className="w-full bg-brand-yellow text-black hover:bg-yellow-500 font-bold py-2.5 rounded-xl h-11"
            disabled={loading || !email || !password}
            onClick={handleLogin}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Войти
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl h-11"
            disabled={loading}
            onClick={handleGuestLogin}
          >
            Войти как гость
          </Button>
        </div>
      ) : (
        /* ======= ФОРМА РЕГИСТРАЦИИ ======= */
        <div className="space-y-4">
          {/* Тип организации */}
          <div>
            <Label className="text-sm mb-1.5 block">Тип</Label>
            <div className="flex gap-2">
              {([
                { value: "individual" as OrgType, label: "Физ. лицо" },
                { value: "ip" as OrgType, label: "ИП" },
                { value: "too" as OrgType, label: "ТОО" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setOrgType(opt.value)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    orgType === opt.value
                      ? "bg-brand-yellow text-black border-brand-yellow"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">Email</Label>
            <Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="email@example.com" className="h-11 rounded-lg" />
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">Телефон</Label>
            <Input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+7 (___) ___-__-__" className="h-11 rounded-lg" />
          </div>

          {orgType === "individual" && (
            <div>
              <Label className="text-sm mb-1.5 block">ФИО</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" className="h-11 rounded-lg" />
            </div>
          )}

          {orgType === "ip" && (
            <div>
              <Label className="text-sm mb-1.5 block">Название ИП</Label>
              <Input value={ipName} onChange={(e) => setIpName(e.target.value)} placeholder="ИП Иванов" className="h-11 rounded-lg" />
            </div>
          )}

          {orgType === "too" && (
            <div>
              <Label className="text-sm mb-1.5 block">Название ТОО</Label>
              <Input value={tooName} onChange={(e) => setTooName(e.target.value)} placeholder="ТОО 'Компания'" className="h-11 rounded-lg" />
            </div>
          )}

          <div>
            <Label className="text-sm mb-1.5 block">Адрес доставки</Label>
            <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Город, улица, дом" className="h-11 rounded-lg" />
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">Пароль</Label>
            <Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Минимум 6 символов" className="h-11 rounded-lg" />
          </div>

          <Button
            className="w-full bg-brand-yellow text-black hover:bg-yellow-500 font-bold py-2.5 rounded-xl h-11"
            disabled={loading || !regEmail || !regPassword}
            onClick={handleRegister}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Зарегистрироваться
          </Button>
        </div>
      )}
    </div>
  )
}
