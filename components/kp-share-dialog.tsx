"use client"

/**
 * Модалка «Поделиться КП».
 *
 * Двухколоночный layout:
 *  - Слева: список ВСЕХ системных пользователей с поиском. Уже расшаренные
 *    подсвечены и не дают «добавить» повторно (показывают «уже выдан»).
 *    Внизу — выбор уровня доступа (Только просмотр / Полный доступ),
 *    применяется к новым шарам.
 *  - Справа: кому уже выдан доступ. Уровень можно сменить on the fly,
 *    отозвать — крестиком.
 *
 * Открывается из карточки КП на странице /kp.
 */

import { useEffect, useMemo, useState } from "react"
import { Loader2, Share2, Trash2, Plus, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  type KpAccessLevel,
  type KpShareEntry,
  type KpShareTarget,
  getKpShares,
  shareKp,
  revokeKpShare,
  getKpShareTargets,
} from "@/app/actions/kp-share"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  kpId: number
  kpName: string
}

// Соответствие классу `SOFT_CONTROL` — убирает синюю рамку фокуса у инпутов
// и select-trigger'ов, оставляя только тонкую тень и серый бордер на :hover.
const SOFT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"

const ACCESS_LABEL: Record<KpAccessLevel, string> = {
  view: "Только просмотр",
  edit: "Полный доступ",
}

export function KpShareDialog({ open, onOpenChange, kpId, kpName }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [shares, setShares] = useState<KpShareEntry[]>([])
  const [targets, setTargets] = useState<KpShareTarget[]>([])
  const [search, setSearch] = useState("")
  const [accessLevel, setAccessLevel] = useState<KpAccessLevel>("view")
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch("")
    Promise.all([getKpShares(kpId), getKpShareTargets()])
      .then(([sharesRes, targetsList]) => {
        if (sharesRes.success) setShares(sharesRes.shares || [])
        setTargets(targetsList)
      })
      .finally(() => setLoading(false))
  }, [open, kpId])

  // Map для быстрой проверки кому уже выдано (для подсветки слева)
  const sharedById = useMemo(() => {
    const m = new Map<number, KpShareEntry>()
    for (const s of shares) m.set(s.shared_with_user_id, s)
    return m
  }, [shares])

  // Левая колонка — фильтр по поиску, но НЕ исключаем уже расшаренных:
  // юзер должен видеть всех в одном списке, чтобы не запутаться кому уже
  // выдано (бейдж справа от имени) vs кому ещё нет (кнопка «+»).
  const leftList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return targets
    return targets.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [targets, search])

  const handleAdd = async (userId: number) => {
    setBusyId(userId)
    try {
      const res = await shareKp(kpId, userId, accessLevel)
      if (!res.success) {
        toast({ variant: "destructive", title: "Не удалось поделиться", description: res.error })
        return
      }
      const fresh = await getKpShares(kpId)
      if (fresh.success) setShares(fresh.shares || [])
      toast({ title: "Готово", description: "Доступ выдан" })
    } finally {
      setBusyId(null)
    }
  }

  const handleRevoke = async (userId: number) => {
    setBusyId(userId)
    try {
      const res = await revokeKpShare(kpId, userId)
      if (!res.success) {
        toast({ variant: "destructive", title: "Не удалось отозвать", description: res.error })
        return
      }
      setShares((prev) => prev.filter((s) => s.shared_with_user_id !== userId))
    } finally {
      setBusyId(null)
    }
  }

  const handleChangeLevel = async (userId: number, newLevel: KpAccessLevel) => {
    const res = await shareKp(kpId, userId, newLevel)
    if (!res.success) {
      toast({ variant: "destructive", title: "Не удалось обновить", description: res.error })
      return
    }
    setShares((prev) =>
      prev.map((s) =>
        s.shared_with_user_id === userId ? { ...s, access_level: newLevel } : s,
      ),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            Поделиться КП
          </DialogTitle>
          <p className="text-sm text-gray-500 truncate">«{kpName}»</p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="px-6 flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 overflow-hidden">
            {/* ── Левая колонка: выбор пользователя ── */}
            <div className="flex flex-col min-h-0">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                Выбрать пользователя
              </h4>

              <div className="grid grid-cols-1 gap-2 mb-2">
                <Input
                  placeholder="Поиск по имени или email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn("h-9 text-sm", SOFT)}
                />
                <Select
                  value={accessLevel}
                  onValueChange={(v) => setAccessLevel(v as KpAccessLevel)}
                >
                  <SelectTrigger className={cn("h-9 text-sm", SOFT)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{ACCESS_LABEL.view}</SelectItem>
                    <SelectItem value="edit">{ACCESS_LABEL.edit}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg flex-1 min-h-0 overflow-y-auto bg-white">
                {leftList.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {search ? "Никого не найдено" : "Нет других системных пользователей"}
                  </p>
                ) : (
                  leftList.map((u) => {
                    const existing = sharedById.get(u.id)
                    const alreadyShared = !!existing
                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.full_name}</div>
                          <div className="text-xs text-gray-500 truncate">{u.email}</div>
                        </div>
                        {alreadyShared ? (
                          <span className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 shrink-0">
                            <Check className="h-3 w-3" />
                            {ACCESS_LABEL[existing!.access_level as KpAccessLevel] || existing!.access_level}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAdd(u.id)}
                            disabled={busyId === u.id}
                            className="h-8 px-3 rounded-full text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white inline-flex items-center gap-1 shrink-0"
                          >
                            {busyId === u.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Добавить
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── Правая колонка: уже выданные доступы ── */}
            <div className="flex flex-col min-h-0">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                Кому выдан доступ ({shares.length})
              </h4>

              <div className="border rounded-lg flex-1 min-h-0 overflow-y-auto bg-white">
                {shares.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Пока никому не выдан доступ.
                    <br />
                    Выберите пользователя слева.
                  </p>
                ) : (
                  shares.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {s.target?.full_name || `#${s.shared_with_user_id}`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {s.target?.email || ""}
                        </div>
                      </div>
                      <Select
                        value={s.access_level}
                        onValueChange={(v) =>
                          handleChangeLevel(s.shared_with_user_id, v as KpAccessLevel)
                        }
                      >
                        <SelectTrigger className={cn("h-8 text-xs w-[170px] shrink-0", SOFT)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">{ACCESS_LABEL.view}</SelectItem>
                          <SelectItem value="edit">{ACCESS_LABEL.edit}</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => handleRevoke(s.shared_with_user_id)}
                        disabled={busyId === s.shared_with_user_id}
                        className="h-8 w-8 shrink-0 rounded-full bg-white border border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors flex items-center justify-center"
                        title="Отозвать доступ"
                      >
                        {busyId === s.shared_with_user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-3 border-t bg-white flex-shrink-0">
          <Button onClick={() => onOpenChange(false)} className="rounded-lg">
            Готово
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
