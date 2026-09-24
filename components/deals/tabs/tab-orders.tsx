"use client"

/**
 * Вкладка «Заказы» карточки сделки — список привязанных + кнопка «Привязать».
 *
 * Бэк:
 *   POST /api/admin/deals/<id>/orders             attach (body: {order_id})
 *   DELETE /api/admin/deals/<id>/orders/<link_id> detach
 *   GET /api/admin/orders                          список заказов для выбора
 *
 * Данные о заказе (номер, сумма, клиент) приходят в GET /admin/deals/<id>
 * через enriched _deal_full_dict.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, X, ShoppingCart, ExternalLink } from "lucide-react"

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
import { crmGet, crmPost, crmDelete } from "@/lib/crm-fetch"

import EntityPickerDialog from "../entity-picker-dialog"

interface OrderAttachment {
  id: number
  order_id: number
  attached_at: string | null
  order: {
    id: number
    order_number: string
    total_amount: number
    customer_name: string | null
    payment_status: string
    created_at: string | null
  }
}

interface Props {
  dealId: number
  orders: OrderAttachment[]
  onChange: () => void
}

interface AdminOrder {
  id: number
  order_number: string
  total_amount: number
  customer_name: string | null
  payment_status: string
  created_at: string | null
}

export default function TabOrders({ dealId, orders, onChange }: Props) {
  const { toast } = useToast()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [availableOrders, setAvailableOrders] = useState<AdminOrder[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [detachTarget, setDetachTarget] = useState<OrderAttachment | null>(null)

  const attachedIds = useMemo(
    () => new Set(orders.map((o) => o.order_id)),
    [orders],
  )

  const openPicker = async () => {
    setPickerOpen(true)
    if (availableOrders.length === 0) {
      setLoadingList(true)
      try {
        const res = await crmGet<{ orders: AdminOrder[] } | AdminOrder[]>(
          "/api/admin/orders",
        )
        const list = Array.isArray(res) ? res : res.orders || []
        setAvailableOrders(list)
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить заказы",
          description: e?.message,
        })
      } finally {
        setLoadingList(false)
      }
    }
  }

  const handleAttach = async (orderId: number | null) => {
    if (orderId == null) return
    if (attachedIds.has(orderId)) {
      toast({ title: "Уже привязано" })
      return
    }
    try {
      await crmPost(`/api/admin/deals/${dealId}/orders`, {
        order_id: orderId,
      })
      toast({ title: "Заказ привязан" })
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось привязать",
        description: e?.message,
      })
    }
  }

  const handleDetach = async () => {
    if (!detachTarget) return
    try {
      await crmDelete(
        `/api/admin/deals/${dealId}/orders/${detachTarget.id}`,
      )
      toast({ title: "Заказ отвязан" })
      setDetachTarget(null)
      onChange()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось отвязать",
        description: e?.message,
      })
      setDetachTarget(null)
    }
  }

  return (
    <>
      <Card className="rounded-xl border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Привязанные заказы ({orders.length})
          </h3>
          <Button
            size="sm"
            onClick={openPicker}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Привязать
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6">
            Заказы не привязаны
          </div>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <OrderRow item={o} onDetach={() => setDetachTarget(o)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EntityPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Привязать заказ"
        searchPlaceholder="Поиск по номеру / клиенту"
        emptyText={loadingList ? "Загружаем…" : "Заказы не найдены"}
        allowClear={false}
        value={null}
        onChange={(id) => handleAttach(id)}
        items={availableOrders
          .filter((o) => !attachedIds.has(o.id))
          .map((o) => ({
            id: o.id,
            primary: `Заказ ${o.order_number}`,
            secondary: [
              o.customer_name,
              formatAmount(o.total_amount),
              formatDate(o.created_at),
            ]
              .filter(Boolean)
              .join(" · "),
            badge: o.payment_status === "paid" ? "оплачен" : undefined,
          }))}
      />

      <AlertDialog
        open={Boolean(detachTarget)}
        onOpenChange={(v) => !v && setDetachTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отвязать заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Заказ {detachTarget?.order.order_number} больше не будет
              привязан к этой сделке. Сам заказ не удалится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetach}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Отвязать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function OrderRow({
  item,
  onDetach,
}: {
  item: OrderAttachment
  onDetach: () => void
}) {
  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <ShoppingCart className="h-6 w-6 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate">
            Заказ {item.order.order_number}
          </div>
          {item.order.payment_status === "paid" && (
            <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 shrink-0">
              оплачен
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {formatAmount(item.order.total_amount)}
          {item.order.customer_name ? ` · ${item.order.customer_name}` : ""}
          {" · создан "}{formatDate(item.order.created_at)}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-full">
          <Link href={`/admin/orders`} target="_blank" title="К списку заказов">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDetach}
          className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
          title="Отвязать"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
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
