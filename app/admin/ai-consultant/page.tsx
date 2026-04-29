"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"

const OWNER_EMAIL = "bocan.anton@mail.ru"

interface SystemUserOption {
  id: number
  email: string
  full_name: string
}

interface SettingsBody {
  allow_guest: boolean
  allow_registered: boolean
  allow_wholesale: boolean
  allowed_system_user_ids: number[]
  updated_at?: string | null
  updated_by_email?: string | null
}

export default function AdminAIConsultantPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SettingsBody | null>(null)
  const [systemUsers, setSystemUsers] = useState<SystemUserOption[]>([])

  // Owner check on the client too — backend enforces it, but redirecting
  // away early avoids flashing the form to non-owners.
  useEffect(() => {
    if (user && (user.email || "").toLowerCase() !== OWNER_EMAIL) {
      router.replace("/admin")
    }
  }, [user, router])

  useEffect(() => {
    let cancelled = false
    fetch("/api/ai-consultant/admin-settings", { cache: "no-store" })
      .then(async (resp) => {
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
        return data
      })
      .then((data) => {
        if (cancelled) return
        setSettings(data.settings)
        setSystemUsers(data.system_users || [])
      })
      .catch((e) => {
        console.error("Load AI consultant settings:", e)
        toast({
          title: "Не удалось загрузить настройки",
          description: e?.message || "Попробуйте обновить страницу",
          variant: "destructive",
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  const updateField = <K extends keyof SettingsBody>(key: K, value: SettingsBody[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const toggleSystemUser = (id: number) => {
    if (!settings) return
    const current = new Set(settings.allowed_system_user_ids)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    updateField("allowed_system_user_ids", Array.from(current).sort((a, b) => a - b))
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const resp = await fetch("/api/ai-consultant/admin-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allow_guest: settings.allow_guest,
          allow_registered: settings.allow_registered,
          allow_wholesale: settings.allow_wholesale,
          allowed_system_user_ids: settings.allowed_system_user_ids,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      setSettings(data.settings)
      toast({ title: "Настройки сохранены" })
    } catch (e: any) {
      console.error("Save AI consultant settings:", e)
      toast({
        title: "Не удалось сохранить",
        description: e?.message || "Попробуйте ещё раз",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-24 text-gray-500">
        Не удалось загрузить настройки
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-brand-yellow/30">
          <Sparkles className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Консультант</h1>
          <p className="text-sm text-gray-500">
            Управление доступом к странице <code>/ai</code>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Группы пользователей</CardTitle>
          <CardDescription>
            Включите доступ для нужных категорий клиентов магазина
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-2 border-b">
            <div>
              <Label className="font-medium">Гость</Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Любой пользователь без авторизации
              </p>
            </div>
            <Switch
              checked={settings.allow_guest}
              onCheckedChange={(v) => updateField("allow_guest", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-2 border-b">
            <div>
              <Label className="font-medium">Зарегистрированный пользователь</Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Все клиенты с обычным аккаунтом (не оптовики)
              </p>
            </div>
            <Switch
              checked={settings.allow_registered}
              onCheckedChange={(v) => updateField("allow_registered", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="font-medium">
                Зарегистрированный пользователь оптовик
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Клиенты с флагом «оптовик»
              </p>
            </div>
            <Switch
              checked={settings.allow_wholesale}
              onCheckedChange={(v) => updateField("allow_wholesale", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Системные пользователи</CardTitle>
          <CardDescription>
            Точечная выдача доступа для сотрудников. Владелец (
            <code>{OWNER_EMAIL}</code>) видит страницу всегда
          </CardDescription>
        </CardHeader>
        <CardContent>
          {systemUsers.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Нет системных пользователей</p>
          ) : (
            <div className="space-y-1">
              {systemUsers.map((u) => {
                const isOwner = u.email.toLowerCase() === OWNER_EMAIL
                const checked = isOwner || settings.allowed_system_user_ids.includes(u.id)
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between gap-3 px-2 py-2 rounded-lg ${
                      isOwner ? "bg-brand-yellow/10" : "hover:bg-gray-50 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => !isOwner && toggleSystemUser(u.id)}
                        disabled={isOwner}
                        className="data-[state=checked]:bg-brand-yellow data-[state=checked]:border-brand-yellow"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.full_name || u.email}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                    </div>
                    {isOwner && (
                      <span className="text-[11px] text-gray-500 px-2 py-0.5 rounded-full bg-brand-yellow/40 flex-shrink-0">
                        Владелец
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-400">
          {settings.updated_at
            ? `Обновлено: ${new Date(settings.updated_at).toLocaleString("ru")}${
                settings.updated_by_email ? ` · ${settings.updated_by_email}` : ""
              }`
            : "Ещё не сохранялось"}
        </p>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-yellow hover:bg-yellow-500 text-black gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
      </div>
    </div>
  )
}
