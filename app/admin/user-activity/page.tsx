"use client"

/**
 * /admin/user-activity — owner-only страница с таблицей системных
 * пользователей: онлайн / оффлайн и время последней активности.
 *
 * Гейт такой же как у /admin/kp-management — только owner
 * (`SystemUser.is_owner=TRUE`). Если зашёл не-owner — silent редирект на /admin.
 *
 * Данные дёргаем GET /api/admin/system-users/presence каждые 30 сек.
 * Heartbeat пишется из admin-layout раз в 60 сек, «онлайн» = был активен
 * в последние 120 сек (бэк отдаёт `online_threshold_seconds`).
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Activity, ShieldCheck, Crown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface PresenceUser {
  id: number
  full_name: string
  email: string
  is_owner: boolean
  last_seen: string | null
  is_online: boolean
}

interface PresenceResponse {
  success?: boolean
  users?: PresenceUser[]
  online_threshold_seconds?: number
  server_time?: string
  error?: string
}

const REFRESH_INTERVAL_MS = 30_000

function formatLastSeen(iso: string | null): string {
  if (!iso) return "никогда"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"

  const now = Date.now()
  const diffSec = Math.max(0, Math.round((now - d.getTime()) / 1000))

  if (diffSec < 60) return `${diffSec} сек назад`
  if (diffSec < 3600) {
    const m = Math.round(diffSec / 60)
    return `${m} мин назад`
  }
  if (diffSec < 86_400) {
    const h = Math.round(diffSec / 3600)
    return `${h} ч назад`
  }
  // Старше суток — показываем точную дату-время в локали
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function UserActivityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // tick — счётчик для перерисовки относительных меток времени,
  // даже если данные с бэка не менялись.
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch("/api/admin/system-users/presence", { cache: "no-store" })
        if (cancelled) return
        if (res.status === 403) {
          setForbidden(true)
          return
        }
        const data: PresenceResponse = await res.json()
        if (cancelled) return
        if (data.success && data.users) {
          setUsers(data.users)
          setError(null)
        } else {
          setError(data.error || "Не удалось загрузить")
        }
      } catch {
        if (!cancelled) setError("Не удалось загрузить")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const id = setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Тикер для пересчёта «N мин назад» каждую секунду — даже без перезагрузки данных
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (forbidden) router.replace("/admin")
  }, [forbidden, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const onlineCount = users.filter((u) => u.is_online).length

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100">
          <Activity className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Активность пользователей</h1>
          <p className="text-sm text-gray-500">
            Кто сейчас сидит в админке и когда последний раз был активен
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Системные пользователи</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              онлайн: {onlineCount} из {users.length}
            </span>
          </CardTitle>
          <CardDescription>
            «Онлайн» = был активен в последние 2 минуты (heartbeat раз в 60 сек,
            пока админ-вкладка открыта). Данные обновляются каждые 30 сек.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 mb-4">
              {error}
            </div>
          )}

          {users.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Нет системных пользователей</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Статус</th>
                    <th className="text-left px-4 py-2.5 font-medium">Пользователь</th>
                    <th className="text-left px-4 py-2.5 font-medium">Роль</th>
                    <th className="text-left px-4 py-2.5 font-medium">Последняя активность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        {u.is_online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            онлайн
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                            <span className="inline-flex rounded-full h-2 w-2 bg-gray-300"></span>
                            оффлайн
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{u.full_name || u.email}</div>
                          {u.full_name && (
                            <div className="text-xs text-gray-500 truncate">{u.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_owner ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            <Crown className="h-3 w-3" />
                            владелец
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                            <ShieldCheck className="h-3 w-3" />
                            системный
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatLastSeen(u.last_seen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
