"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Loader2, PackageX } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getImageUrl } from "@/lib/image-utils"
import { getProductCosts } from "@/app/actions/product-costs"
import { formatProductPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"

export interface KpSupplierChoice {
  /** null — «Без поставщика» (используется базовая product.price). */
  warehouse_id: number | null
  warehouse_name: string | null
  supplier_name: string | null
  calculated_price: number | null
  calculated_delivery: number | null
  currency_code: string | null
  vat_enabled?: boolean
  margin_coef?: number | null
  pwc_id?: number
  note?: string | null
  /** Остаток на этом складе (для «Без поставщика» — null). */
  quantity?: number | null
}

export interface KpSupplierProduct {
  id: number
  name: string
  image_url?: string | null
  /** Базовая цена — используется для fallback-варианта. */
  price: number
  /** Fallback-поставщик из product-данных (BIO/Equip/PosPro/…) —
      показываем, если у товара нет ни одной PWC-записи. */
  supplier_name?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  product: KpSupplierProduct | null
  onConfirm: (choice: KpSupplierChoice, warehousePrices: KpSupplierChoice[]) => void
}

/**
 * Модалка выбора поставщика/склада перед добавлением товара в КП.
 * Логика такая: грузим product_costs, показываем плитки. Если у товара
 * нет ни одного склада с ценой > 0 — показываем единственную опцию
 * «Без поставщика» (по базовой product.price).
 *
 * Ok передаёт выбранный вариант через onConfirm; вызывающая сторона
 * сама решает как обогатить KPItem (addItem + updateItem).
 */
export function SelectKpSupplierDialog({ open, onOpenChange, product, onConfirm }: Props) {
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<KpSupplierChoice[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !product) return
    setLoading(true)
    setError(null)
    setSelectedIdx(0)
    ;(async () => {
      try {
        const costs = await getProductCosts({ product_id: product.id })
        // Не фильтруем по цене — показываем ВСЕ склады у товара, даже
        // с нулевой ценой/остатком (админ сам решит, годится ли).
        const priced: KpSupplierChoice[] = (costs || []).map((c: any) => ({
          warehouse_id: c.warehouse_id,
          warehouse_name: c.warehouse_name || "Склад",
          supplier_name: c.supplier_name || null,
          calculated_price: c.calculated_price ?? 0,
          calculated_delivery: c.calculated_delivery || null,
          currency_code: c.currency_code || "KZT",
          vat_enabled: c.vat_enabled !== false,
          margin_coef: c.margin_coef ?? null,
          pwc_id: c.id,
          note: c.note,
          quantity: typeof c.quantity === "number" ? c.quantity : null,
        }))

        if (priced.length === 0) {
          // Нет привязанных PWC-записей — берём fallback-поставщика
          // из самого товара (BIO/Equip/PosPro), если он есть; иначе
          // «Без поставщика» с базовой ценой.
          setOptions([
            {
              warehouse_id: null,
              warehouse_name: null,
              supplier_name: product.supplier_name || null,
              calculated_price: product.price,
              calculated_delivery: null,
              currency_code: "KZT",
              quantity: null,
            },
          ])
        } else {
          setOptions(priced)
        }
      } catch (e: any) {
        setError(e?.message ?? "Не удалось загрузить поставщиков")
        setOptions([])
      } finally {
        setLoading(false)
      }
    })()
  }, [open, product])

  const selected = options[selectedIdx] || null

  const handleConfirm = () => {
    if (!selected) return
    onConfirm(selected, options)
    onOpenChange(false)
  }

  const supplierLabel = (opt: KpSupplierChoice) => {
    if (!opt.supplier_name && !opt.warehouse_name) return "Без поставщика"
    if (!opt.supplier_name) return opt.warehouse_name || "Склад"
    return opt.warehouse_name
      ? `${opt.supplier_name} · ${opt.warehouse_name}`
      : opt.supplier_name
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Выбор поставщика для КП</DialogTitle>
          <DialogDescription>
            {product?.name ?? "Товар"} — выберите поставщика/склад, с которого добавить товар в КП.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[160px] max-h-[60vh] overflow-y-auto -mx-2 px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загружаем поставщиков…
            </div>
          ) : error ? (
            <div className="text-center py-6 text-sm text-destructive">{error}</div>
          ) : options.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <PackageX className="h-8 w-8" />
              <span className="text-sm">Нет доступных поставщиков</span>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {options.map((opt, i) => {
                const isSel = i === selectedIdx
                return (
                  <button
                    key={`${opt.warehouse_id ?? "none"}-${i}`}
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    className={cn(
                      "flex flex-col text-left rounded-xl border-2 p-3 bg-white transition-all",
                      "shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.14)]",
                      isSel
                        ? "border-brand-yellow ring-2 ring-brand-yellow/40"
                        : "border-gray-200",
                    )}
                  >
                    <div className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                      {supplierLabel(opt)}
                    </div>
                    <div className="text-base font-bold text-red-600">
                      {opt.calculated_price != null
                        ? `${formatProductPrice(opt.calculated_price)}`
                        : "Цену уточняйте"}
                    </div>
                    <div className="text-[11px] text-gray-600 mt-1">
                      Остаток:{" "}
                      {opt.quantity == null ? (
                        <span className="text-gray-400">—</span>
                      ) : opt.quantity > 0 ? (
                        <span className="text-green-700 font-medium">{opt.quantity} шт.</span>
                      ) : (
                        <span className="text-gray-500">нет</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !selected}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            Ок
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
