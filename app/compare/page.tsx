"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, X, Scale, ArrowLeft } from "lucide-react"
import { useCompare } from "@/context/compare-context"
import { useAuth } from "@/context/auth-context"
import { getProductBySlug, type Product } from "@/app/actions/products"
import { getImageUrl } from "@/lib/image-utils"
import {
  formatProductPrice,
  getRetailPriceClass,
  getWholesalePriceClass,
  isWholesaleUser,
} from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"

export default function ComparePage() {
  const { items, remove, clear } = useCompare()
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyDiffs, setOnlyDiffs] = useState(false)

  // Тянем полные карточки товаров параллельно. Слаги в comparecontext.
  useEffect(() => {
    let cancelled = false
    if (items.length === 0) {
      setProducts([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(items.map((it) => getProductBySlug(it.slug).catch(() => null)))
      .then((results) => {
        if (cancelled) return
        setProducts(results.filter(Boolean) as Product[])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [items])

  // Объединяем все characteristic keys из всех товаров (в порядке
  // первого появления). Каждый key → значения по товарам.
  const rows = useMemo(() => {
    const orderedKeys: string[] = []
    const keySet = new Set<string>()
    for (const p of products) {
      for (const c of p.characteristics ?? []) {
        if (c.key.toLowerCase() === "code") continue
        if (!keySet.has(c.key)) {
          keySet.add(c.key)
          orderedKeys.push(c.key)
        }
      }
    }
    return orderedKeys.map((key) => {
      const values = products.map((p) => {
        const found = p.characteristics?.find((c) => c.key === key)
        return found?.value ?? "—"
      })
      const allSame = values.every((v) => v === values[0])
      return { key, values, allSame }
    })
  }, [products])

  const visibleRows = onlyDiffs ? rows.filter((r) => !r.allSame) : rows

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-16 text-center">
        <Scale className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Сравнение пустое</h1>
        <p className="text-gray-500 mb-6">
          Добавляйте товары в сравнение через иконку весов на карточке.
        </p>
        <Button asChild className="bg-brand-yellow text-black hover:bg-yellow-500">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href="/" aria-label="На главную"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-bold flex-1">Сравнение товаров</h1>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Switch id="only-diffs" checked={onlyDiffs} onCheckedChange={setOnlyDiffs} />
          <label htmlFor="only-diffs" className="cursor-pointer select-none">
            Только различия
          </label>
        </div>
        <Button variant="outline" size="sm" onClick={clear}>Очистить</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Загрузка товаров…</span>
        </div>
      ) : (
        // Обёртка БЕЗ overflow-x — иначе создаётся скролл-контекст и
        // sticky-шапка приклеивается к верху div'а, а не к странице.
        // Таблице задаём min-w, при большом кол-ве колонок страница сама
        // получит горизонтальный скролл. top-24 у sticky-th — компенсация
        // главной шапки сайта, чтобы карточки товаров были видны под ней.
        // overflow-clip (не hidden!) — обрезает уголки под rounded-xl,
        // но НЕ создаёт scroll-контекст, поэтому sticky внутри таблицы
        // приклеивается к странице, а не к внутренней верхней границе
        // wrapper'a. overflow-hidden сломал бы sticky.
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-clip">
          <table className="w-full min-w-[900px] text-sm border-separate border-spacing-0">
            <thead>
              {/* Строка с карточками товаров. Sticky top-[110px] — прилипает
                  под нижнюю границу шапки сайта. Вся строка вместе с
                  padding'ом и карточками остаётся видна до конца таблицы. */}
              <tr>
                <th
                  className="sticky top-[130px] left-0 z-30 bg-white border-r border-b border-gray-200 w-52 min-w-[13rem] align-bottom p-4 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)]"
                  scope="col"
                >
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                    {products.length} {products.length === 1 ? "товар" : products.length < 5 ? "товара" : "товаров"}
                  </div>
                </th>
                {products.map((p) => (
                  <th
                    key={p.id}
                    className="sticky top-[130px] z-20 bg-white p-4 align-top border-r border-b border-gray-200 min-w-[220px] max-w-[260px] shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)]"
                    scope="col"
                  >
                    <div className="relative flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 flex items-center justify-center shadow-sm transition-colors"
                        aria-label="Убрать из сравнения"
                        title="Убрать из сравнения"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {/* Картинка — фиксированный маленький квадрат 20×20 (80px),
                          одинаковый у всех колонок. Клик по картинке/названию
                          ведёт на страницу товара в этой же вкладке. */}
                      <Link href={`/product/${p.slug}`} className="block group">
                        <div className="relative w-20 h-20 bg-gray-50/50 rounded-lg overflow-hidden">
                          {p.image ? (
                            <Image
                              src={getImageUrl(p.image)}
                              alt={p.name}
                              fill
                              className="object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-2xl text-gray-300">📦</div>
                          )}
                        </div>
                      </Link>
                      <p className="text-xs font-semibold text-gray-900 line-clamp-2 text-center leading-snug min-h-[2.2em]">
                        {p.name}
                      </p>
                      {/* «Открыть» — в новой вкладке, чтобы не терять
                          страницу сравнения. */}
                      <Link
                        href={`/product/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-yellow-600 hover:underline"
                      >
                        Открыть →
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>

            </thead>
            <tbody className="[&_tr]:group [&_tr:hover_td]:bg-yellow-50/30 [&_tr:hover_th]:bg-yellow-50/60">
              {/* ── Секция «Основное» ─────────────────────────────── */}
              <SectionHeader colSpan={products.length + 1}>Основное</SectionHeader>

              <RowShell label="Цена" products={products} sameByValue={products.map(p => formatProductPrice(p.price))}>
                {products.map((p) => (
                  <td key={p.id} className={`p-3 border-r border-b border-gray-100 align-top font-bold ${getRetailPriceClass(wholesaleUser)}`}>
                    {formatProductPrice(p.price)}
                  </td>
                ))}
              </RowShell>

              {wholesaleUser && (
                <RowShell label="Оптовая цена" products={products} sameByValue={products.map(p => formatProductPrice(p.wholesale_price))}>
                  {products.map((p) => (
                    <td key={p.id} className={`p-3 border-r border-b border-gray-100 align-top font-bold ${getWholesalePriceClass()}`}>
                      {formatProductPrice(p.wholesale_price)}
                    </td>
                  ))}
                </RowShell>
              )}

              <RowShell
                label="Наличие"
                products={products}
                sameByValue={products.map(p =>
                  p.availability_status
                    ? formatAvailabilityStatusLabel(p.availability_status as any)
                    : `${p.quantity} шт.`
                )}
              >
                {products.map((p) => (
                  <td key={p.id} className="p-3 border-r border-b border-gray-100 align-top">
                    {p.availability_status ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium"
                        style={{
                          backgroundColor: p.availability_status.background_color,
                          color: p.availability_status.text_color,
                        }}
                      >
                        {formatAvailabilityStatusLabel(p.availability_status as any)}
                      </span>
                    ) : (
                      <span className="text-gray-500">{p.quantity} шт.</span>
                    )}
                  </td>
                ))}
              </RowShell>

              <RowShell
                label="Бренд"
                products={products}
                sameByValue={products.map(p => p.brand_info?.name ?? "—")}
              >
                {products.map((p) => (
                  <td key={p.id} className="p-3 border-r border-b border-gray-100 align-top">
                    <span className="text-gray-800 font-medium">{p.brand_info?.name ?? "—"}</span>
                  </td>
                ))}
              </RowShell>

              {/* ── Секция «Характеристики» ─────────────────────── */}
              {visibleRows.length === 0 ? (
                <>
                  <SectionHeader colSpan={products.length + 1}>Характеристики</SectionHeader>
                  <tr>
                    <td colSpan={products.length + 1} className="p-8 text-center text-gray-400 text-sm">
                      {onlyDiffs
                        ? "Нет различающихся характеристик"
                        : "У товаров нет характеристик"}
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <SectionHeader colSpan={products.length + 1}>Характеристики</SectionHeader>
                  {visibleRows.map((row) => (
                    <RowShell key={row.key} label={row.key} products={products} sameByValue={row.values}>
                      {row.values.map((v, i) => {
                        const isDifferent = !row.allSame && v !== "—"
                        return (
                          <td
                            key={i}
                            className={`p-3 border-r border-b border-gray-100 align-top ${
                              row.allSame ? "text-gray-500" : "text-gray-900 font-medium"
                            } ${isDifferent ? "" : ""}`}
                          >
                            {v}
                          </td>
                        )
                      })}
                    </RowShell>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * Заголовок логической секции — colspan-строка с ярким серым фоном.
 * Разделяет «Основное» (цены/наличие/бренд) и «Характеристики».
 */
function SectionHeader({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="sticky left-0 bg-gray-100 border-y border-gray-200 px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-gray-600"
      >
        {children}
      </td>
    </tr>
  )
}

/**
 * Обёртка строки таблицы сравнения. Левая колонка — sticky-название
 * характеристики. Если значения по всем товарам одинаковые — строка
 * получает мягкий серый фон (легко пропускается глазом), различающиеся
 * ряды получают тонкую жёлтую полосу слева и выделенный шрифт значений.
 */
function RowShell({
  label,
  products,
  sameByValue,
  children,
}: {
  label: string
  products: any[]
  sameByValue: (string | undefined)[]
  children: React.ReactNode
}) {
  const allSame = sameByValue.every((v) => v === sameByValue[0])
  return (
    <tr className={allSame ? "" : "bg-yellow-50/40"}>
      <th
        scope="row"
        className={`sticky left-0 z-10 p-3 pl-4 text-left text-xs font-semibold border-r border-b border-gray-100 align-top ${
          allSame ? "bg-white text-gray-500" : "bg-yellow-50/60 text-gray-900 border-l-4 border-l-brand-yellow"
        }`}
      >
        {label}
      </th>
      {children}
    </tr>
  )
}
