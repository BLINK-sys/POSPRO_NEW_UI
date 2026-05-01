"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Wand2, MessageSquare, ShieldCheck, Check, AlertCircle } from "lucide-react"
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

// Stable JSON of the editable fields only — used both as the auto-save
// PUT body AND as the snapshot for change detection (see savedSnapshotRef).
// Audit fields are deliberately excluded so the server's audit echo
// doesn't look like a "user-initiated change".
function serializePayload(s: SettingsBody): string {
  return JSON.stringify({
    allow_guest: s.allow_guest,
    allow_registered: s.allow_registered,
    allow_wholesale: s.allow_wholesale,
    allowed_system_user_ids: s.allowed_system_user_ids,
    allowed_product_import_user_ids: s.allowed_product_import_user_ids,
    allowed_settings_admin_user_ids: s.allowed_settings_admin_user_ids,
  })
}

export default function AdminAIConsultantPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SettingsBody | null>(null)
  const [systemUsers, setSystemUsers] = useState<SystemUserOption[]>([])
  // Auto-save state machine. `idle` shows hint text, `saving` shows
  // spinner, `saved` shows green check for ~1.5s before reverting, `error`
  // sticks until next change so the operator can see something went wrong.
  type SaveState = "idle" | "saving" | "saved" | "error"
  const [saveState, setSaveState] = useState<SaveState>("idle")
  // Snapshot of the last successfully-saved payload (JSON) — lets us skip
  // re-saving when the server just echoed back what we already had, which
  // would otherwise infinite-loop the auto-save effect.
  const savedSnapshotRef = useRef<string>("")

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
        // Seed the snapshot with what we just loaded so the auto-save
        // effect doesn't fire on initial render.
        savedSnapshotRef.current = serializePayload(s)
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

  // Auto-save with 600ms debounce. Fires whenever the editable parts of
  // `settings` differ from the last successfully-saved snapshot. The
  // snapshot guard prevents the effect from looping when the server
  // echoes back what we just sent (audit fields like updated_at change
  // but the payload doesn't).
  useEffect(() => {
    if (!settings) return
    const payload = serializePayload(settings)
    if (payload === savedSnapshotRef.current) return

    setSaveState("saving")
    const timer = window.setTimeout(async () => {
      try {
        const resp = await fetch("/api/ai-consultant/admin-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
        savedSnapshotRef.current = payload
        // Pull fresh audit info from the server (updated_at /
        // updated_by_email) without overwriting the editable fields,
        // which would re-trigger this effect via reference change.
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                updated_at: data.settings.updated_at,
                updated_by_email: data.settings.updated_by_email,
              }
            : prev,
        )
        // Re-snapshot after audit-field merge so the next change can
        // correctly compare against the new state.
        savedSnapshotRef.current = payload
        setSaveState("saved")
        window.setTimeout(() => {
          setSaveState((s) => (s === "saved" ? "idle" : s))
        }, 1500)
      } catch (e: any) {
        console.error("Auto-save settings:", e)
        setSaveState("error")
        toast({
          title: "Не удалось сохранить",
          description: e?.message || "Попробуйте ещё раз",
          variant: "destructive",
        })
      }
    }, 600)

    return () => window.clearTimeout(timer)
  }, [settings, toast])

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
        {/* Custom tab styling — shadcn defaults blend the inactive tabs
            into the gray TabsList background, making it unclear they're
            buttons. We give every trigger a white card with shadow, and
            the active one becomes brand-yellow + stronger shadow + ring. */}
        <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger
            value="consultant"
            className="gap-2 whitespace-normal text-left bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)] hover:border-gray-300 data-[state=active]:bg-brand-yellow data-[state=active]:border-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_8px_24px_rgba(0,0,0,0.18)] data-[state=active]:ring-2 data-[state=active]:ring-brand-yellow/30 px-4 py-2.5 transition-shadow"
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            AI Консультант — на клиентской части для подбора товара
          </TabsTrigger>
          <TabsTrigger
            value="import"
            className="gap-2 whitespace-normal text-left bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)] hover:border-gray-300 data-[state=active]:bg-brand-yellow data-[state=active]:border-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_8px_24px_rgba(0,0,0,0.18)] data-[state=active]:ring-2 data-[state=active]:ring-brand-yellow/30 px-4 py-2.5 transition-shadow"
          >
            <Wand2 className="h-4 w-4 flex-shrink-0" />
            PosPro AI — помощник импорта товаров
          </TabsTrigger>
          <TabsTrigger
            value="access"
            className="gap-2 whitespace-normal text-left bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)] hover:border-gray-300 data-[state=active]:bg-brand-yellow data-[state=active]:border-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_8px_24px_rgba(0,0,0,0.18)] data-[state=active]:ring-2 data-[state=active]:ring-brand-yellow/30 px-4 py-2.5 transition-shadow"
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            Доступ к настройкам (этот раздел)
          </TabsTrigger>
        </TabsList>

        {/* ─────────────  AI Консультант  ───────────── */}
        <TabsContent value="consultant" className="space-y-6 mt-4">
          <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
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
          <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
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
          <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
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

      {/* Audit info + auto-save status — no manual Save button. Each
          change in any tab triggers a debounced PUT 600ms after the last
          edit. Status indicator on the right reflects the request state. */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-400">
          {settings.updated_at
            ? `Обновлено: ${new Date(settings.updated_at).toLocaleString("ru")}${
                settings.updated_by_email ? ` · ${settings.updated_by_email}` : ""
              }`
            : "Ещё не сохранялось"}
        </p>
        <SaveStatusIndicator state={saveState} />
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
    <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
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

// Visual indicator for the auto-save state. Replaces what used to be a
// manual "Сохранить" button. Renders a small chip on the right of the
// audit footer.
function SaveStatusIndicator({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error"
}) {
  if (state === "idle") {
    return (
      <span className="text-xs text-gray-400">
        Изменения сохраняются автоматически
      </span>
    )
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Сохраняем…
      </span>
    )
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
        <Check className="h-3.5 w-3.5" />
        Сохранено
      </span>
    )
  }
  // error
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <AlertCircle className="h-3.5 w-3.5" />
      Не удалось сохранить
    </span>
  )
}
