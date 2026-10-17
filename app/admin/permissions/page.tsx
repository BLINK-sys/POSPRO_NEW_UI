"use client"

/**
 * /admin/permissions — «Спец права».
 *
 * Только для владельца системы (`SystemUser.is_owner=TRUE`). Здесь
 * настраиваются per-user флаги видимости CRM-сущностей:
 *   - is_owner            — сделать другого владельцем (осторожно)
 *   - can_see_all_deals   — видит все сделки, а не только свои
 *   - can_see_all_tasks   — видит все задачи
 *   - can_manage_pipelines — управляет воронками (стадии, порядок)
 *
 * Каждая галочка сразу PATCH'ится на бэк. Владелец не может снять флаг
 * is_owner сам с себя (бэк вернёт 400).
 */

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck, Check, AlertCircle, Crown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { crmGet, crmFetch } from "@/lib/crm-fetch"
import { useAuth } from "@/context/auth-context"

interface SystemUserRow {
  id: number
  email: string
  full_name: string
  is_owner: boolean
  can_see_all_deals: boolean
  can_see_all_tasks: boolean
  can_manage_pipelines: boolean
  can_manage_projects: boolean
}

type PermKey =
  | "is_owner"
  | "can_see_all_deals"
  | "can_see_all_tasks"
  | "can_manage_pipelines"
  | "can_manage_projects"

export default function PermissionsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { user: authUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<SystemUserRow[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [_, startTransition] = useTransition()

  const myEmail = (authUser?.email || "").toLowerCase()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const check = await fetch("/api/admin/kp-super-admin-access/check", {
          cache: "no-store",
        }).then((r) => r.json())
        if (cancelled) return
        if (!check?.is_owner) {
          setForbidden(true)
          setLoading(false)
          return
        }
        const list = await crmGet<SystemUserRow[]>("/api/system-users")
        if (cancelled) return
        setUsers(Array.isArray(list) ? list : [])
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setForbidden(true)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (forbidden) router.replace("/admin")
  }, [forbidden, router])

  const toggle = (uid: number, key: PermKey, next: boolean) => {
    // Себя как owner снять нельзя — блокируем на клиенте, бэк ещё раз проверит.
    const row = users.find((x) => x.id === uid)
    const isMe = !!(row && myEmail && row.email && row.email.toLowerCase() === myEmail)
    if (key === "is_owner" && isMe && !next) {
      toast({
        variant: "destructive",
        title: "Нельзя снять с себя роль владельца",
        description: "Передайте роль другому пользователю сначала.",
      })
      return
    }

    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, [key]: next } : u)))

    startTransition(async () => {
      setSaveState("saving")
      try {
        await crmFetch(`/api/system-users/${uid}/permissions`, {
          method: "PATCH",
          body: { [key]: next },
        })
        setSaveState("saved")
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500)
      } catch (err: any) {
        // Откатываем оптимистичное обновление
        setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, [key]: !next } : u)))
        setSaveState("error")
        toast({
          variant: "destructive",
          title: "Не удалось сохранить",
          description: err?.message || "Попробуйте ещё раз",
        })
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100">
          <ShieldCheck className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Спец права</h1>
          <p className="text-sm text-gray-500">
            Кто из системных пользователей может видеть чужие сделки/задачи и управлять воронками
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle>Пользователи и их права</CardTitle>
          <CardDescription>
            По умолчанию менеджер видит только те сделки/задачи, где он постановщик,
            ответственный, соисполнитель, наблюдатель или участник чата. Флажки
            ниже — исключения из этого правила.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-4 flex items-center gap-2">
            <Crown className="h-4 w-4 shrink-0" />
            Владелец системы видит и может всё — его флажки нужны только чтобы
            передать роль другому.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-medium">Пользователь</th>
                  <th className="py-2 px-2 font-medium text-center w-28">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3.5 w-3.5" />
                      Владелец
                    </span>
                  </th>
                  <th className="py-2 px-2 font-medium text-center w-32">Все сделки</th>
                  <th className="py-2 px-2 font-medium text-center w-32">Все задачи</th>
                  <th className="py-2 px-2 font-medium text-center w-32">Воронки</th>
                  <th className="py-2 px-2 font-medium text-center w-32">Проекты</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                      Нет системных пользователей
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isMe = !!(myEmail && u.email && u.email.toLowerCase() === myEmail)
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="py-3 pr-4">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-2">
                              {u.full_name || u.email}
                              {isMe && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  вы
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{u.email}</div>
                          </div>
                        </td>
                        <PermCell
                          checked={u.is_owner}
                          onChange={(v) => toggle(u.id, "is_owner", v)}
                          disabled={isMe && u.is_owner}
                          accent="amber"
                        />
                        <PermCell
                          checked={u.can_see_all_deals}
                          onChange={(v) => toggle(u.id, "can_see_all_deals", v)}
                          disabled={u.is_owner}
                          accent="blue"
                        />
                        <PermCell
                          checked={u.can_see_all_tasks}
                          onChange={(v) => toggle(u.id, "can_see_all_tasks", v)}
                          disabled={u.is_owner}
                          accent="blue"
                        />
                        <PermCell
                          checked={u.can_manage_pipelines}
                          onChange={(v) => toggle(u.id, "can_manage_pipelines", v)}
                          disabled={u.is_owner}
                          accent="blue"
                        />
                        <PermCell
                          checked={u.can_manage_projects}
                          onChange={(v) => toggle(u.id, "can_manage_projects", v)}
                          disabled={u.is_owner}
                          accent="blue"
                        />
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <SaveStatus state={saveState} />
      </div>
    </div>
  )
}

function PermCell({
  checked,
  onChange,
  disabled,
  accent,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  accent: "amber" | "blue"
}) {
  const cls =
    accent === "amber"
      ? "data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=checked]:text-white"
      : "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white"
  return (
    <td className="py-3 px-2 text-center">
      <div className="flex items-center justify-center">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChange(Boolean(v))}
          disabled={disabled}
          className={cls}
        />
      </div>
    </td>
  )
}

function SaveStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") {
    return <span className="text-xs text-gray-400">Изменения сохраняются автоматически</span>
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
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <AlertCircle className="h-3.5 w-3.5" />
      Ошибка
    </span>
  )
}
