"use client"

/**
 * /admin/kp-management — страница управления super-admin доступом к КП.
 *
 * Видит только owner (`SystemUser.is_owner=TRUE`). Здесь можно отметить
 * системных пользователей которым выдаётся «глобальный» просмотр всех КП
 * всех менеджеров (как у owner'а). Owner всегда включён неявно — в списке
 * не показывается, его флаг нельзя снять.
 *
 * UX по образцу /admin/ai-consultant — список карточек с чекбоксами, после
 * каждой правки делаем PUT на бэк.
 */

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Share2, Check, AlertCircle, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  getKpSuperAdminConfig,
  updateKpSuperAdminConfig,
} from "@/app/actions/kp-share"

interface SystemUserRow {
  id: number
  email: string
  full_name: string
  is_owner: boolean
}

export default function KpManagementPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [systemUsers, setSystemUsers] = useState<SystemUserRow[]>([])
  const [allowedIds, setAllowedIds] = useState<Set<number>>(new Set())
  const [forbidden, setForbidden] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [_, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getKpSuperAdminConfig().then((res) => {
      if (cancelled) return
      if (!res.success) {
        // 403 → юзер не owner; редирект в /admin
        setForbidden(true)
        setLoading(false)
        return
      }
      setSystemUsers(res.system_users || [])
      setAllowedIds(new Set(res.access?.allowed_user_ids || []))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (forbidden) router.replace("/admin")
  }, [forbidden, router])

  const toggle = (uid: number) => {
    setAllowedIds((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      // Сохраняем сразу — UX как у /admin/ai-consultant
      const ids = Array.from(next)
      startTransition(async () => {
        setSaveState("saving")
        const res = await updateKpSuperAdminConfig(ids)
        if (res.success) {
          setSaveState("saved")
          setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500)
        } else {
          setSaveState("error")
          toast({
            variant: "destructive",
            title: "Не удалось сохранить",
            description: res.error,
          })
        }
      })
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  // Owner'а скрываем из списка — его права не настраиваются галочкой
  const visibleUsers = systemUsers.filter((u) => !u.is_owner)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
          <Share2 className="h-5 w-5 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Управление КП</h1>
          <p className="text-sm text-gray-500">
            Кому выдан полный доступ ко ВСЕМ коммерческим предложениям
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle>Кто видит все КП всех пользователей</CardTitle>
          <CardDescription>
            Эти системные пользователи видят все сохранённые и подписанные КП
            всех менеджеров с правом редактирования (но не удаления чужого).
            Без отдельного шаринга от менеджеров. Включает фильтр «По
            пользователю» в списке КП.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Владелец системы всегда имеет полный доступ ко всем КП — этот
            список выдаёт те же права другим системным пользователям.
          </div>

          {visibleUsers.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Нет других системных пользователей</p>
          ) : (
            <div className="space-y-2">
              {visibleUsers.map((u) => {
                const checked = allowedIds.has(u.id)
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all bg-white ${
                      checked
                        ? "border-blue-400 shadow-[0_2px_6px_rgba(59,130,246,0.20)]"
                        : "border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(u.id)}
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white"
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

      <div className="flex items-center justify-end">
        <SaveStatus state={saveState} />
      </div>
    </div>
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
