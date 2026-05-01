"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, Sparkles, Wand2, MessageSquare, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  allowed_product_import_user_ids: number[]
  allowed_settings_admin_user_ids: number[]
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

  // Access check: backend returns 403 for non-admins. If we get there,
  // redirect to /admin. Owner OR opted-in system users can stay.
  useEffect(() => {
    let cancelled = false
    fetch("/api/ai-consultant/settings-admin-access", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (!d?.has_access) router.replace("/admin")
      })
      .catch(() => {})
    return () => {
      cancelled = true
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
        // Backfill missing lists for older backends without the columns
        const s: SettingsBody = {
          ...data.settings,
          allowed_product_import_user_ids:
            data.settings.allowed_product_import_user_ids ?? [],
          allowed_settings_admin_user_ids:
            data.settings.allowed_settings_admin_user_ids ?? [],
        }
        setSettings(s)
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

  const toggleListMember = (
    listKey:
      | "allowed_system_user_ids"
      | "allowed_product_import_user_ids"
      | "allowed_settings_admin_user_ids",
    id: number,
  ) => {
    if (!settings) return
    const current = new Set(settings[listKey])
    if (current.has(id)) current.delete(id)
    else current.add(id)
    updateField(listKey, Array.from(current).sort((a, b) => a - b))
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      // Send all four lists — backend permits any settings-admin to
      // change any of them (granted admins are equals to the owner per
      // product spec).
      const body = {
        allow_guest: settings.allow_guest,
        allow_registered: settings.allow_registered,
        allow_wholesale: settings.allow_wholesale,
        allowed_system_user_ids: settings.allowed_system_user_ids,
        allowed_product_import_user_ids: settings.allowed_product_import_user_ids,
        allowed_settings_admin_user_ids: settings.allowed_settings_admin_user_ids,
      }
      const resp = await fetch("/api/ai-consultant/admin-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      setSettings({
        ...data.settings,
        allowed_product_import_user_ids:
          data.settings.allowed_product_import_user_ids ?? [],
        allowed_settings_admin_user_ids:
          data.settings.allowed_settings_admin_user_ids ?? [],
      })
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
          <h1 className="text-2xl font-semibold">AI настройки</h1>
          <p className="text-sm text-gray-500">
            Управление доступом к AI-возможностям магазина
          </p>
        </div>
      </div>

      <Tabs defaultValue="consultant">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="consultant" className="gap-2 whitespace-normal text-left">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            AI Консультант — на клиентской части для подбора товара
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2 whitespace-normal text-left">
            <Wand2 className="h-4 w-4 flex-shrink-0" />
            PosPro AI — помощник импорта товаров
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2 whitespace-normal text-left">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            Доступ к настройкам (этот раздел)
          </TabsTrigger>
        </TabsList>

        {/* ─────────────  AI Консультант  ───────────── */}
        <TabsContent value="consultant" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Группы пользователей</CardTitle>
              <CardDescription>
                Включите доступ к странице <strong>PosPro AI Chat</strong> для нужных категорий пользователей.
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

          <SystemUsersCard
            title="Системные пользователи (AI Консультант)"
            description="Точечная выдача доступа к странице PosPro AI Chat."
            systemUsers={systemUsers}
            allowedIds={settings.allowed_system_user_ids}
            onToggle={(id) => toggleListMember("allowed_system_user_ids", id)}
          />
        </TabsContent>

        {/* ─────────────  Импорт товаров  ───────────── */}
        <TabsContent value="import" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>PosPro AI — импорт товаров с сайтов-доноров</CardTitle>
              <CardDescription>
                В форме создания товара появляется кнопка «🔗 PosPro AI помощник» —
                она вставляет название, описание, фото и характеристики, спарсенные
                с указанной страницы. Доступ выдаётся точечно системным пользователям.
              </CardDescription>
            </CardHeader>
          </Card>

          <SystemUsersCard
            title="Системные пользователи (Импорт товаров)"
            description="Кому показывать кнопку «PosPro AI помощник» в форме создания товара."
            systemUsers={systemUsers}
            allowedIds={settings.allowed_product_import_user_ids}
            onToggle={(id) => toggleListMember("allowed_product_import_user_ids", id)}
          />
        </TabsContent>

        {/* ─────────────  Доступ к настройкам  ───────────── */}
        <TabsContent value="access" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Доступ к разделу «AI настройки»</CardTitle>
              <CardDescription>
                Кто может открыть этот раздел и менять настройки.
              </CardDescription>
            </CardHeader>
          </Card>

          <SystemUsersCard
            title="Системные пользователи (Доступ к настройкам)"
            description="Кому показывать пункт «AI настройки» в админ-сайдбаре."
            systemUsers={systemUsers}
            allowedIds={settings.allowed_settings_admin_user_ids}
            onToggle={(id) => toggleListMember("allowed_settings_admin_user_ids", id)}
          />
        </TabsContent>
      </Tabs>

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

// Reusable list-of-system-users card with checkboxes. The owner row is
// hidden entirely — owner is a permanent role independent of any list.
function SystemUsersCard({
  title,
  description,
  systemUsers,
  allowedIds,
  onToggle,
}: {
  title: string
  description: string
  systemUsers: SystemUserOption[]
  allowedIds: number[]
  onToggle: (id: number) => void
}) {
  const visibleUsers = systemUsers.filter(
    (u) => u.email.toLowerCase() !== OWNER_EMAIL,
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {visibleUsers.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Нет системных пользователей</p>
        ) : (
          <div className="space-y-1">
            {visibleUsers.map((u) => {
              const checked = allowedIds.includes(u.id)
              return (
                <label
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(u.id)}
                      className="data-[state=checked]:bg-brand-yellow data-[state=checked]:border-brand-yellow"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {u.full_name || u.email}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{u.email}</div>
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
