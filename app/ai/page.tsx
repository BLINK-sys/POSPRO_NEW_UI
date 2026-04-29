"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, RotateCcw, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth-context"
import { isWholesaleUser, formatProductPrice, getRetailPriceClass, getWholesalePriceClass } from "@/lib/utils"
import { getApiUrl } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { AddToKPButton } from "@/components/add-to-kp-button"
import { QuickViewButton } from "@/components/quick-view-modal"
import { AISearchChat, type AISearchResult, type ChatMessage } from "@/components/ai-search-chat"

// Persisted across navigation (e.g. clicking a product card and returning).
// Cleared only when user starts a new chat from the chat panel.
const SESSION_KEY = "pospro-ai-session-v1"

const PAGE_SIZE = 16

interface PersistedState {
  messages: ChatMessage[]
  productIds: number[]
  searchLabel: string
}

interface ProductLite {
  id: number
  slug: string
  name: string
  price: number
  wholesale_price?: number
  quantity: number
  image_url?: string | null
  brand_info?: { id: number; name: string } | null
  supplier_name?: string | null
  description?: string | null
  status?: { name: string; background_color: string; text_color: string } | null
  availability_status?: { status_name: string; background_color: string; text_color: string } | null
  article?: string
}

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      productIds: Array.isArray(parsed.productIds) ? parsed.productIds : [],
      searchLabel: typeof parsed.searchLabel === "string" ? parsed.searchLabel : "",
    }
  } catch {
    return null
  }
}

function savePersisted(state: PersistedState) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage can throw on quota; ignore — chat still works in-memory.
  }
}

export default function AISearchPage() {
  const { user } = useAuth()
  const router = useRouter()
  const wholesaleUser = isWholesaleUser(user)
  const isSystemUser = user?.role === "admin" || user?.role === "system"

  // Access gate — backend decides who can use the page based on
  // /admin/ai-consultant settings. Three states: null = checking,
  // true = allowed, false = denied (will redirect).
  const [accessChecked, setAccessChecked] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/ai-consultant/access", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.has_access) {
          setAccessChecked(true)
        } else {
          setAccessChecked(false)
          router.replace("/")
        }
      })
      .catch(() => {
        if (cancelled) return
        setAccessChecked(false)
        router.replace("/")
      })
    return () => {
      cancelled = true
    }
  }, [router, user?.id, user?.email])

  // State starts empty so server-render and first client-render match.
  // We load from sessionStorage in a post-mount effect — reading storage
  // during render causes a hydration mismatch when prior data exists.
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [productIds, setProductIds] = useState<number[]>([])
  const [searchLabel, setSearchLabel] = useState<string>("")
  const [products, setProducts] = useState<ProductLite[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  // Inner scroll container holds the cards grid + pagination. Scrolling
  // happens INSIDE this div, not on the page — that way the strip + chat
  // stay visually pinned without sticky/z-index tricks, and cards never
  // visually escape the container.
  const cardsScrollRef = useRef<HTMLDivElement>(null)

  // Hydrate from sessionStorage AFTER first paint so server/client markup
  // match. Until `hydrated=true`, we don't render AISearchChat (it would
  // flash the greeting before settling on the saved transcript).
  useEffect(() => {
    const persisted = loadPersisted()
    if (persisted) {
      if (persisted.messages.length > 0) setMessages(persisted.messages)
      if (persisted.productIds.length > 0) setProductIds(persisted.productIds)
      if (persisted.searchLabel) setSearchLabel(persisted.searchLabel)
    }
    setHydrated(true)
  }, [])

  // Reset to page 1 whenever a new search lands.
  useEffect(() => {
    setCurrentPage(1)
  }, [productIds])

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE))
  const visibleProducts = useMemo(
    () => products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [products, currentPage],
  )

  const goToPage = (n: number) => {
    const clamped = Math.max(1, Math.min(n, totalPages))
    setCurrentPage(clamped)
    // Scroll the INNER cards container, not the window — the rest of the
    // layout is fixed in place.
    requestAnimationFrame(() => {
      cardsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    })
  }

  // Persist whenever any of the tracked state changes — but only after the
  // initial hydration completes. Otherwise an empty initial render would
  // overwrite the saved transcript before we got a chance to load it.
  useEffect(() => {
    if (!hydrated) return
    savePersisted({ messages, productIds, searchLabel })
  }, [messages, productIds, searchLabel, hydrated])

  // Fetch products when productIds changes.
  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([])
      setProductsError(null)
      return
    }
    let cancelled = false
    setLoadingProducts(true)
    setProductsError(null)
    const url = new URL(getApiUrl("/products/bulk"))
    url.searchParams.set("ids", productIds.join(","))
    fetch(url.toString(), { cache: "no-store" })
      .then(async (resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        return resp.json()
      })
      .then((data: any[]) => {
        if (cancelled) return
        const map = new Map<number, ProductLite>()
        for (const p of data) {
          map.set(p.id, {
            id: p.id,
            slug: p.slug,
            name: p.name,
            price: p.price,
            wholesale_price: p.wholesale_price,
            quantity: p.quantity,
            image_url: p.image_url || p.image,
            brand_info: p.brand_info,
            supplier_name: p.supplier_name || p.supplier?.name || null,
            description: p.description,
            status: p.status && typeof p.status === "object" ? p.status : null,
            availability_status: p.availability_status ?? null,
            article: p.article || "",
          })
        }
        // Keep order matching what AI returned.
        setProducts(productIds.map((id) => map.get(id)).filter(Boolean) as ProductLite[])
      })
      .catch((e) => {
        if (cancelled) return
        console.error("Failed to load AI products:", e)
        setProductsError(e?.message || "Не удалось загрузить товары")
        setProducts([])
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false)
      })
    return () => {
      cancelled = true
    }
  }, [productIds])

  // Scroll-to-top button — listens to the inner scroll container, not the
  // page (the page itself doesn't scroll in this layout).
  useEffect(() => {
    const el = cardsScrollRef.current
    if (!el) return
    const handleScroll = () => setShowScrollTop(el.scrollTop > el.clientHeight)
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [hydrated])

  const handleResults = useCallback((res: AISearchResult) => {
    setProductIds(res.product_ids)
    setSearchLabel(res.search_label || "")
  }, [])

  const handleChatStateChange = useCallback((s: { messages: ChatMessage[] }) => {
    setMessages(s.messages)
    // The chat resets itself to a single greeting message when "Новый чат" is
    // clicked. Mirror that on the products column so the panel doesn't show
    // a stale picks list against an empty conversation.
    if (s.messages.length <= 1) {
      setProductIds((prev) => (prev.length === 0 ? prev : []))
      setSearchLabel((prev) => (prev === "" ? prev : ""))
    }
  }, [])

  const resetAll = () => {
    setMessages([])
    setProductIds([])
    setSearchLabel("")
    setProducts([])
    setProductsError(null)
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(SESSION_KEY)
      } catch {}
    }
  }

  const pluralize = (n: number) => {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return "товар"
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "товара"
    return "товаров"
  }

  // While access is being checked, show a centered spinner. If access is
  // denied, redirect already fired in the useEffect above — render null
  // to avoid flashing the page contents in between.
  if (accessChecked !== true) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 96px)" }}>
        {accessChecked === null ? (
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        ) : null}
      </div>
    )
  }

  // Layout: fixed-height container (viewport - global header - container py-6).
  // Chat left, products right — both fill the container vertically. The
  // products column has a static strip on top + an internal scrollable div
  // for the cards. Page itself doesn't scroll; only the cards container does.
  // This gives crisp clipping (cards never visually escape the scroll area)
  // without needing sticky positioning, blockers, or z-index tricks.
  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <div
        className="flex gap-4"
        style={{ height: "calc(100vh - 96px - 48px)" }}  // header + container py-6
      >
        {/* Left: Chat (40%) */}
        <aside className="flex-shrink-0 w-2/5 h-full">
          <div className="h-full rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.10)] border border-gray-200 overflow-hidden bg-white">
            {hydrated ? (
              <AISearchChat
                onResults={handleResults}
                initialMessages={messages}
                onStateChange={handleChatStateChange}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-300">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
        </aside>

        {/* Right: Strip + scrollable cards (60%). No gap between them so the
            cards scroll container starts FLUSH with the strip's bottom edge —
            cards visually disappear right at the strip line. Breathing space
            for card shadows / hover scale lives INSIDE the scroll container
            as padding, not as flex gap. */}
        <main className="flex-1 min-w-0 h-full flex flex-col">
          {/* Header strip — plain static card. No sticky, no margin tricks. */}
          <div className="rounded-2xl border border-gray-200 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.18)] bg-white px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-brand-yellow/30 flex-shrink-0">
                <Sparkles className="h-4.5 w-4.5 text-black" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {searchLabel || "Подбор товаров"}
                </div>
                {products.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {products.length} {pluralize(products.length)}
                    {totalPages > 1 && (
                      <span className="text-gray-400">
                        {" "}· стр. {currentPage} из {totalPages}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {(messages.length > 0 || products.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={resetAll}
                title="Очистить чат и подборку"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сбросить
              </Button>
            )}
          </div>

          {/* Scrollable cards area — overflow-y:auto clips anything that
              tries to escape its bounds. Top edge starts immediately after
              the strip; cards cannot visually appear above it. Internal
              `p-4` gives product cards 16px of breathing room so their
              box-shadows + hover scale don't get sliced by the container's
              clip rectangle. The 1.5px scrollbar styling matches the rest
              of the app (sidebar / KP). */}
          <div
            ref={cardsScrollRef}
            className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent"
          >
          {/* Empty state */}
          {!loadingProducts && products.length === 0 && !productsError && (
            <div className="text-center py-24 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-base text-gray-500">Опишите задачу слева в чате</p>
              <p className="text-sm text-gray-400 mt-1">
                AI задаст уточнения и подберёт товары
              </p>
            </div>
          )}

          {/* Loading state */}
          {loadingProducts && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Error */}
          {productsError && !loadingProducts && (
            <div className="text-sm text-red-600 px-4 py-3 bg-red-50 rounded-xl">{productsError}</div>
          )}

          {/* Product grid */}
          {!loadingProducts && products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleProducts.map((product) => (
                <div key={product.id} className="group">
                  <Link href={`/product/${product.slug}`}>
                    <Card className="hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-[1.02] transition-all duration-300 cursor-pointer bg-white rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                      <CardContent className="p-3">
                        <div className="relative">
                          <div className="aspect-square relative bg-white rounded-lg overflow-hidden mb-3">
                            {product.image_url ? (
                              <Image
                                src={getImageUrl(product.image_url)}
                                alt={product.name}
                                fill
                                className="object-contain group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-2xl text-gray-400">📦</div>
                            )}

                            {product.status && (
                              <div className="absolute top-2 left-2 z-10">
                                <Badge
                                  className="text-xs px-2 py-1 shadow-md"
                                  style={{
                                    backgroundColor: product.status.background_color,
                                    color: product.status.text_color,
                                  }}
                                >
                                  {product.status.name}
                                </Badge>
                              </div>
                            )}

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                              <FavoriteButton
                                productId={product.id}
                                productName={product.name}
                                className="w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md hover:shadow-lg"
                                size="sm"
                              />
                            </div>

                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                              <QuickViewButton slug={product.slug} />
                            </div>

                            {product.brand_info && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <div className="p-3">
                                  <div className="text-xs text-white">
                                    <span className="font-medium">Бренд:</span> {product.brand_info.name}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Товар:</span> {product.name}
                            </div>
                            <div className={`text-xs font-bold ${getRetailPriceClass(wholesaleUser)}`}>
                              <span className="font-medium">Цена:</span> {formatProductPrice(product.price)}
                            </div>
                            {wholesaleUser && (
                              <div className={`text-xs font-bold ${getWholesalePriceClass()}`}>
                                <span className="font-medium">Оптовая цена:</span> {formatProductPrice(product.wholesale_price)}
                              </div>
                            )}
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Наличие:</span>{" "}
                              {product.availability_status ? (
                                <span
                                  style={{
                                    backgroundColor: product.availability_status.background_color,
                                    color: product.availability_status.text_color,
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                  }}
                                >
                                  {product.availability_status.status_name}
                                </span>
                              ) : (
                                <span>{product.quantity} шт.</span>
                              )}
                            </div>
                            {isSystemUser && product.supplier_name && (
                              <div className="text-xs text-gray-500 truncate">
                                <span className="font-medium">Поставщик:</span> {product.supplier_name}
                              </div>
                            )}
                            <div onClick={(e) => e.preventDefault()}>
                              <AddToCartButton
                                productId={product.id}
                                productName={product.name}
                                productSlug={product.slug}
                                productPrice={product.price}
                                productImageUrl={product.image_url}
                                productArticle={product.article || ""}
                                className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                                size="sm"
                              />
                            </div>
                            {isSystemUser && (
                              <div onClick={(e) => e.preventDefault()}>
                                <AddToKPButton
                                  productId={product.id}
                                  productName={product.name}
                                  productSlug={product.slug}
                                  productPrice={product.price}
                                  productWholesalePrice={product.wholesale_price}
                                  productImageUrl={product.image_url ?? undefined}
                                  productDescription={product.description ?? undefined}
                                  productSupplierName={product.supplier_name ?? undefined}
                                  productBrandName={product.brand_info?.name}
                                  className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                                  size="sm"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loadingProducts && totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onChange={goToPage}
            />
          )}
          </div>
        </main>
      </div>

      {showScrollTop && (
        <button
          onClick={() => cardsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 bg-brand-yellow text-black rounded-full shadow-lg flex items-center justify-center hover:bg-yellow-500 transition-colors"
          aria-label="Наверх"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}

// Compact numbered pagination with prev/next arrows. Always shows first/last
// page; collapses long stretches with ellipses so the bar stays narrow.
function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number
  totalPages: number
  onChange: (n: number) => void
}) {
  const pages = paginationRange(currentPage, totalPages)
  const baseBtn =
    "min-w-9 h-9 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
  const inactive = "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
  const active = "bg-brand-yellow text-black border border-brand-yellow shadow-sm"
  const disabled = "opacity-40 cursor-not-allowed"

  return (
    <nav className="mt-6 flex items-center justify-center gap-1.5 flex-wrap">
      <button
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${baseBtn} ${inactive} ${currentPage === 1 ? disabled : ""}`}
        aria-label="Предыдущая"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-gray-400 select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${baseBtn} ${p === currentPage ? active : inactive}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${baseBtn} ${inactive} ${currentPage === totalPages ? disabled : ""}`}
        aria-label="Следующая"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  )
}

// Returns an array like [1, "…", 4, 5, 6, "…", 12]. Always keeps first, last,
// and a window of `siblings` around the current page.
function paginationRange(current: number, total: number, siblings = 1): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const left = Math.max(current - siblings, 2)
  const right = Math.min(current + siblings, total - 1)
  const out: (number | "…")[] = [1]
  if (left > 2) out.push("…")
  for (let p = left; p <= right; p++) out.push(p)
  if (right < total - 1) out.push("…")
  out.push(total)
  return out
}
