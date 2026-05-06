"use client"

/**
 * Модалка «Поделиться КП».
 *
 * - Загружает список системных юзеров и текущие шары через server actions
 * - Можно добавить нового получателя с правом view/edit
 * - Можно сменить уровень или отозвать существующий шар
 *
 * Открывается из карточки КП на странице /kp. По дефолту kp.user_id = текущий
 * юзер, поэтому модалка доступна; super-admin тоже может шарить чужие — но
 * мы не показываем кнопку для чужих карточек, чтобы не путать менеджеров.
 */

import { useEffect, useMemo, useState } from "react"
import { Loader2, Share2, Trash2, Check } from "lucide-react"
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  kpId: number
  kpName: string
}

export function KpShareDialog({ open, onOpenChange, kpId, kpName }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [shares, setShares] = useState<KpShareEntry[]>([])
  const [targets, setTargets] = useState<KpShareTarget[]>([])
  const [search, setSearch] = useState("")
  const [accessLevel, setAccessLevel] = useState<KpAccessLevel>("view")
  const [adding, setAdding] = useState<number | null>(null)
  const [revoking, setRevoking] = useState<number | null>(null)

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

  // Юзеры доступные для шаринга = все системники минус те что уже в shares
  const availableTargets = useMemo(() => {
    const sharedIds = new Set(shares.map((s) => s.shared_with_user_id))
    const q = search.trim().toLowerCase()
    return targets
      .filter((u) => !sharedIds.has(u.id))
      .filter((u) => {
        if (!q) return true
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        )
      })
  }, [shares, targets, search])

  const handleAdd = async (userId: number) => {
    setAdding(userId)
    try {
      const res = await shareKp(kpId, userId, accessLevel)
      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Не удалось поделиться",
          description: res.error,
        })
        return
      }
      // Перезагрузим список — с denorm-данными от бэка
      const fresh = await getKpShares(kpId)
      if (fresh.success) setShares(fresh.shares || [])
      toast({ title: "Готово", description: "Доступ выдан" })
    } finally {
      setAdding(null)
    }
  }

  const handleRevoke = async (userId: number) => {
    setRevoking(userId)
    try {
      const res = await revokeKpShare(kpId, userId)
      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Не удалось отозвать",
          description: res.error,
        })
        return
      }
      setShares((prev) => prev.filter((s) => s.shared_with_user_id !== userId))
      toast({ title: "Готово", description: "Доступ отозван" })
    } finally {
      setRevoking(null)
    }
  }

  const handleChangeLevel = async (userId: number, newLevel: KpAccessLevel) => {
    // POST с новым уровнем — бэк апдейтит существующий share (см. share_kp endpoint)
    const res = await shareKp(kpId, userId, newLevel)
    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Не удалось обновить",
        description: res.error,
      })
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            Поделиться КП
          </DialogTitle>
          <p className="text-sm text-gray-500 truncate">«{kpName}»</p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="px-6 flex-1 min-h-0 overflow-y-auto space-y-5 pb-4">
            {/* Текущие получатели */}
            <div>
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                Кому уже выдан доступ ({shares.length})
              </h4>
              {shares.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Пока никому</p>
              ) : (
                <div className="space-y-1">
                  {shares.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-gray-50"
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
                        onValueChange={(v) => handleChangeLevel(s.shared_with_user_id, v as KpAccessLevel)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">Только просмотр</SelectItem>
                          <SelectItem value="edit">Полный доступ</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                        onClick={() => handleRevoke(s.shared_with_user_id)}
                        disabled={revoking === s.shared_with_user_id}
                        title="Отозвать доступ"
                      >
                        {revoking === s.shared_with_user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Добавить нового */}
            <div>
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                Добавить пользователя
              </h4>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  placeholder="Поиск по имени или email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as KpAccessLevel)}>
                  <SelectTrigger className="w-[160px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Только просмотр</SelectItem>
                    <SelectItem value="edit">Полный доступ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-lg max-h-[280px] overflow-y-auto">
                {availableTargets.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {search ? "Никого не найдено" : "Все системные пользователи уже добавлены"}
                  </p>
                ) : (
                  availableTargets.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAdd(u.id)}
                      disabled={adding !== null}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50 border-b last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.full_name}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                      {adding === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <span className="text-xs text-blue-600 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Добавить
                        </span>
                      )}
                    </button>
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
