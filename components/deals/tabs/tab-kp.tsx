"use client"

/**
 * Вкладка «КП» карточки сделки. Список прикреплённых КП + кнопка
 * «Прикрепить» → пикер по всей истории КП с поиском.
 *
 * Бэк:
 *   POST /api/admin/deals/<id>/kp             attach (body: {kp_history_id})
 *   DELETE /api/admin/deals/<id>/kp/<link_id> detach
 *   GET /api/kp-history?filter=all|mine        поиск в списке для прикрепления
 *
 * Данные о самом КП (name, total_amount) уже приходят в GET /admin/deals/<id>
 * благодаря enriched _deal_full_dict — не делаем N+1.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Loader2, X, FileSignature, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { crmGet, crmPost, crmDelete } from "@/lib/crm-fetch"

import EntityPickerDialog from "../entity-picker-dialog"

interface KpAttachment {
  id: number // deal_kp.id (link id)
  kp_history_id: number
  attached_at: string | null
  attached_by: number | null
  kp: {
    id: number
    name: string
    total_amount: number
    signed_at: string | null
    created_at: string | null
  }
}

interface Props {
  dealId: number
  kps: KpAttachment[]
  onChange: () => void // refetch parent
}

interface KpHistoryItem {
  id: number
  name: string
  total_amount: number
  signed_at: string | null
  created_at: string | null
  client?: { id: number; display_name: string }
}

export default function TabKp({ dealId, kps, onChange }: Props) {
  const { toast } = useToast()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [availableKps, setAvailableKps] = useState<KpHistoryItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [mineOnly, setMineOnly] = useState(true)
  const [detachTarget, setDetachTarget] = useState<KpAttachment | null>(null)

  const attachedIds = useMemo(
    () => new Set(kps.map((k) => k.kp_history_id)),
    [kps],
  )

  const loadKps = async (mine: boolean) => {
    setLoadingList(true)
    try {
      const res = await crmGet<{ history: KpHistoryItem[] }>(
        `/api/kp-history?filter=${mine ? "mine" : "all"}`,
      )
      setAvailableKps(res.history || [])
    } catch (e: any) {
      // filter=all может отдать 403 у обычного system-юзера — тогда
      // тихо фолбэчимся на «мои», параллельно защёлкнув чекбокс.
      if (!mine) {
        try {
          const res = await crmGet<{ history: KpHistoryItem[] }>(
            "/api/kp-history?filter=mine",
          )
          setAvailableKps(res.history || [])
          setMineOnly(true)
          return
        } catch (e2: any) {
          toast({
            variant: "destructive",
            title: "Не удалось загрузить историю КП",
            description: e2?.message,
          })
          return
        }
      }
      toast({
        variant: "destructive",
        title: "Не удалось загрузить историю КП",
        description: e?.message,
      })
    } finally {
      setLoadingList(false)
    }
  }

  const openPicker = async () => {
    setPickerOpen(true)
    if (availableKps.length === 0) {
      await loadKps(mineOnly)
    }
  }

  const handleMineToggle = async (mine: boolean) => {
    setMineOnly(mine)
    await loadKps(mine)
  }

  const handleAttach = async (kpId: number | null) => {
    if (kpId == null) return
    if (attachedIds.has(kpId)) {
      toast({ title: "Уже прикреплено" })
      return
    }
    try {
      await crmPost(`/api/admin/deals/${dealId}/kp`, {
        kp_history_id: kpId,
      })
      toast({ title: "КП прикреплено" })
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось прикрепить",
        description: e?.message,
      })
    }
  }

  const handleDetach = async () => {
    if (!detachTarget) return
    try {
      await crmDelete(
        `/api/admin/deals/${dealId}/kp/${detachTarget.id}`,
      )
      toast({ title: "КП откреплено" })
      setDetachTarget(null)
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось открепить",
        description: e?.message,
      })
      setDetachTarget(null)
    }
  }

  return (
    <>
      <Card className="rounded-xl border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            КП {kps.length > 0 && <span className="text-gray-400 font-normal">({kps.length})</span>}
          </h3>
          <button
            onClick={openPicker}
            className="text-[11px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-0.5 focus:outline-none"
          >
            <Plus className="h-3 w-3" /> прикрепить
          </button>
        </div>

        {kps.length === 0 ? (
          <div className="text-xs text-gray-400 italic text-center py-2">
            КП не прикреплены
          </div>
        ) : (
          <ul className="space-y-1.5">
            {kps.map((k) => (
              <li key={k.id}>
                <KpRow item={k} onDetach={() => setDetachTarget(k)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EntityPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Прикрепить КП"
        searchPlaceholder="Поиск по названию / клиенту"
        emptyText={loadingList ? "Загружаем…" : "КП не найдены"}
        allowClear={false}
        value={null}
        onChange={(id) => handleAttach(id)}
        toolbar={
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-gray-600 select-none">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => handleMineToggle(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-yellow focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 cursor-pointer"
              disabled={loadingList}
            />
            Только мои
          </label>
        }
        items={availableKps
          .filter((kp) => !attachedIds.has(kp.id))
          .map((kp) => ({
            id: kp.id,
            primary: kp.name || `КП #${kp.id}`,
            secondary: [
              kp.client?.display_name,
              formatAmount(kp.total_amount),
              formatDate(kp.created_at),
            ]
              .filter(Boolean)
              .join(" · "),
            badge: kp.signed_at ? "Подписан" : undefined,
            badgeClassName: kp.signed_at ? "bg-emerald-100 text-emerald-700" : undefined,
          }))}
      />

      <AlertDialog
        open={Boolean(detachTarget)}
        onOpenChange={(v) => !v && setDetachTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Открепить КП?</AlertDialogTitle>
            <AlertDialogDescription>
              «{detachTarget?.kp.name}» больше не будет привязано к этой сделке.
              Само КП не удалится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetach}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Открепить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function KpRow({
  item,
  onDetach,
}: {
  item: KpAttachment
  onDetach: () => void
}) {
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors">
      <FileSignature className={cn(
        "h-4 w-4 shrink-0",
        item.kp.signed_at ? "text-emerald-600" : "text-gray-400",
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-sm truncate">{item.kp.name}</div>
          {item.kp.signed_at && (
            <span className="text-[9px] uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded px-1 shrink-0">
              подпис.
            </span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          {formatAmount(item.kp.total_amount)} · {formatDate(item.kp.created_at)}
        </div>
      </div>
      <Link
        href={`/kp/${item.kp.id}`}
        target="_blank"
        title="Открыть КП"
        className="text-gray-400 hover:text-gray-700 p-1 shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
      <button
        onClick={onDetach}
        className="text-red-400 hover:text-red-600 p-1 shrink-0 focus:outline-none"
        title="Открепить"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "—"
  try {
    return new Intl.NumberFormat("ru-KZ", {
      style: "currency",
      currency: "KZT",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ₸`
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}
