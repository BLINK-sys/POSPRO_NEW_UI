"use client"

import { useEffect, useState } from "react"
import { Loader2, PackageOpen } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getProductCosts, type ProductCost } from "@/app/actions/product-costs"

interface ProductStocksDialogProps {
  productId: number | null
  productName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductStocksDialog({ productId, productName, open, onOpenChange }: ProductStocksDialogProps) {
  const [costs, setCosts] = useState<ProductCost[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !productId) return
    let cancelled = false
    setIsLoading(true)
    getProductCosts({ product_id: productId })
      .then((data) => {
        if (cancelled) return
        // Сортируем по поставщику, затем по складу — чтобы строки одного
        // поставщика шли подряд и было удобно сравнивать.
        const sorted = [...data].sort((a, b) => {
          const sa = (a.supplier_name || "").localeCompare(b.supplier_name || "")
          if (sa !== 0) return sa
          return (a.warehouse_name || "").localeCompare(b.warehouse_name || "")
        })
        setCosts(sorted)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, productId])

  const totalQuantity = costs.reduce((sum, c) => sum + (c.quantity || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5" />
            Остатки по складам
          </DialogTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">{productName}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : costs.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Этот товар не привязан ни к одному складу.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Поставщик</TableHead>
                  <TableHead>Склад</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.map((c) => {
                  const inStock = (c.quantity ?? 0) > 0
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.supplier_name || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {c.warehouse_name || `#${c.warehouse_id}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${
                            inStock ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {c.quantity ?? 0}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                <TableRow className="border-t-2 font-medium">
                  <TableCell colSpan={2} className="text-sm text-right text-muted-foreground">
                    Всего
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono font-semibold">{totalQuantity}</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
