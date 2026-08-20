"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"

import { getSectionData, type ProductData, type SectionCardData, type CategoryData } from "@/app/actions/public"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { CategoryCard } from "@/components/category-card"
import { getImageUrl } from "@/lib/image-utils"
import { cn } from "@/lib/utils"

const ITEMS_PER_PAGE = 20

// Убираем фокус-обводку для контролов фильтра — визуально шумно, юзер
// просил чистый вид.
const NO_RING =
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"

interface SectionPageData {
  section_card: SectionCardData
  children: CategoryData[]
  products: ProductData[]
  brands: Array<{ id: number; name: string; country?: string; description?: string; image_url?: string }>
  pagination?: { page: number; per_page: number; total_count: number; total_pages: number }
}

/**
 * Умный список номеров страниц: [1, ..., current-1, current, current+1, ..., last]
 * с ограничением по краям (первая, последняя всегда видны) и '…' между разрывами.
 */
function buildPageList(current: number, total: number, neighbours = 2): (number | "...")[] {
  if (total <= 1) return [1]
  const pages = new Set<number>()
  pages.add(1)
  pages.add(total)
  for (let i = current - neighbours; i <= current + neighbours; i++) {
    if (i >= 1 && i <= total) pages.add(i)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | "...")[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("...")
    out.push(sorted[i])
  }
  return out
}

export default function SectionPage() {
  const params = useParams()
  const slug = params.slug as string

  const [data, setData] = useState<SectionPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [brand, setBrand] = useState<string>("all")
  const [sort, setSort] = useState<string>("name")
  const [page, setPage] = useState(1)
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const productsRef = useRef<HTMLDivElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  // Флаг: пользователь только что перешёл на другую страницу пагинации →
  // после подгрузки данных надо плавно проскроллить к сетке товаров.
  const pendingScroll = useRef(false)

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" })
  }, [slug])

  // Скролл к сетке товаров ПОСЛЕ окончания подгрузки — чтобы юзер сначала
  // увидел, что новые товары уже на месте, потом их плавно показали.
  useEffect(() => {
    if (!pendingScroll.current) return
    if (loading) return
    pendingScroll.current = false
    if (typeof window === "undefined") return
    const el = filtersRef.current ?? productsRef.current
    if (!el) return
    requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top, behavior: "smooth" })
    })
  }, [loading, data])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await getSectionData(slug, {
          page,
          perPage: ITEMS_PER_PAGE,
          search: search || undefined,
          brand,
          sort,
          categoryId,
        })
        if (!cancelled) setData(res)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Ошибка загрузки раздела")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug, page, search, brand, sort, categoryId])

  const totalPages = data?.pagination?.total_pages ?? 1
  const pageList = useMemo(() => buildPageList(page, totalPages, 2), [page, totalPages])

  const goToPage = (target: number) => {
    if (target < 1 || target > totalPages || target === page) return
    pendingScroll.current = true
    setPage(target)
    // Скролл сработает в useEffect после того, как fetch завершится
    // (loading=false), чтобы юзер видел новые товары до прыжка.
  }

  if (loading && !data) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Загрузка раздела…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-2">Раздел не найден</h1>
        <p className="text-muted-foreground">{error ?? "Проверьте адрес или вернитесь на главную."}</p>
      </div>
    )
  }

  const card = data.section_card

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Hero */}
      <Card className="overflow-hidden rounded-2xl border-0 shadow-lg mb-6">
        <div className="relative aspect-[16/5] w-full bg-gray-100">
          {card.banner_image_url ? (
            <Image
              src={getImageUrl(card.banner_image_url)}
              alt={card.name}
              fill
              unoptimized
              className="object-fill"
              priority
            />
          ) : card.image_url ? (
            <Image
              src={getImageUrl(card.image_url)}
              alt={card.name}
              fill
              unoptimized
              className="object-fill opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-yellow-100 to-yellow-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{card.name}</h1>
            {card.description && (
              <p className="mt-2 max-w-3xl text-white/90 text-sm md:text-base whitespace-pre-line">
                {card.description}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Привязанные категории — работают как тумблеры фильтра:
          клик по одной сужает выборку товаров, клик по ней же — сброс. */}
      {data.children && data.children.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Категории раздела</h2>
            {categoryId !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCategoryId(null); setPage(1) }}
                className="text-xs"
              >
                Показать все
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {data.children.map((c) => {
              const isSel = categoryId === c.id
              return (
                <div key={c.id} className="aspect-square">
                  <CategoryCard
                    category={c}
                    asButton
                    selected={isSel}
                    onClick={() => {
                      setCategoryId(isSel ? null : c.id)
                      setPage(1)
                    }}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Фильтры */}
      <div ref={filtersRef} className="mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center scroll-mt-20">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className={cn("pl-10", NO_RING)}
            placeholder="Поиск по разделу…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1) }}>
          <SelectTrigger className={cn("md:w-56", NO_RING)}><SelectValue placeholder="Бренд" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все бренды</SelectItem>
            {data.brands?.map((b) => (
              <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1) }}>
          <SelectTrigger className={cn("md:w-56", NO_RING)}><SelectValue placeholder="Сортировка" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">По названию</SelectItem>
            <SelectItem value="price_asc">По цене (возр.)</SelectItem>
            <SelectItem value="price_desc">По цене (убыв.)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Товары */}
      <div ref={productsRef} className="mb-4 flex items-center justify-between scroll-mt-20">
        <div className="text-sm text-muted-foreground">
          Найдено товаров:{" "}
          <Badge variant="outline">{data.pagination?.total_count ?? data.products.length}</Badge>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Обновление…
        </div>
      ) : data.products.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="text-center py-16 text-muted-foreground">
            В этом разделе пока нет товаров.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {data.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex justify-center items-center gap-1 flex-wrap">
          <Button
            variant="outline"
            className={NO_RING}
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Назад
          </Button>

          {pageList.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground select-none">…</span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                onClick={() => goToPage(p)}
                className={cn(
                  "min-w-9 px-3",
                  NO_RING,
                  p === page && "bg-brand-yellow text-black hover:bg-yellow-500",
                )}
              >
                {p}
              </Button>
            ),
          )}

          <Button
            variant="outline"
            className={NO_RING}
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Вперёд
          </Button>
        </nav>
      )}
    </div>
  )
}
