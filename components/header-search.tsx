"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search, Loader2, X } from "lucide-react"
import { searchProducts, type ProductData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"
import { cn } from "@/lib/utils"

const MIN_QUERY = 2
const DEBOUNCE_MS = 250
const PREVIEW_LIMIT = 10
const PLACEHOLDER = "Холодильная витрина, Моноблок, Кофе машина..."

/**
 * Инпут поиска в шапке с автокомплитом первых 10 товаров.
 * Enter или клик по иконке — переход на `/search?q=<текст>`.
 * Клик по подсказке — сразу на карточку товара.
 * Debounce 250 мс, min-длина 2 символа (иначе бэк вернёт слишком много).
 */
export default function HeaderSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Замеряем ширину плейсхолдера через скрытый span с тем же шрифтом —
  // HTML size= неточен для кириллицы. useLayoutEffect срабатывает до
  // paint'а, поэтому визуально ничего не «прыгает».
  const measureRef = useRef<HTMLSpanElement>(null)
  const [inputWidth, setInputWidth] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (measureRef.current) {
      // Инпут через border-box, padding px-2 внутри его ширины (16px + 16px),
      // ещё +6px запас — плейсхолдер иначе клиппится по последнему символу.
      // Дважды перерендериваем если шрифт «доехал» уже после первого замера.
      const measure = () => {
        if (measureRef.current) setInputWidth(measureRef.current.offsetWidth + 32 + 6)
      }
      measure()
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        (document as any).fonts.ready.then(measure)
      }
    }
  }, [])
  // Токен последнего запроса — защищаемся от гонки: если пока ждали ответ,
  // пользователь напечатал ещё символ, старый ответ игнорируем.
  const requestIdRef = useRef(0)

  // Debounced-поиск при изменении query.
  useEffect(() => {
    const trimmed = query.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (trimmed.length < MIN_QUERY) {
      setResults([])
      setLoading(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const rid = ++requestIdRef.current
      setLoading(true)
      try {
        const data = await searchProducts(trimmed)
        if (rid !== requestIdRef.current) return
        setResults(data.slice(0, PREVIEW_LIMIT))
      } catch {
        if (rid === requestIdRef.current) setResults([])
      } finally {
        if (rid === requestIdRef.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Закрытие popup'а при клике вне.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const submitSearch = () => {
    const trimmed = query.trim()
    setOpen(false)
    // Пустой запрос → просто открываем страницу поиска (там курируемые
    // категории и бренды на пустом стейте). С запросом — префилим `?q=`.
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < results.length) {
        // Enter при подсвеченной подсказке — сразу на её страницу.
        const p = results[activeIndex]
        setOpen(false)
        router.push(`/product/${p.slug}`)
      } else {
        submitSearch()
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const showResults = open && query.trim().length >= MIN_QUERY

  return (
    <div ref={rootRef} className="relative w-fit">
      {/* Ширина ~45ch эмпирически — плейсхолдер «Холодильная витрина,
          Моноблок, Кофе машина...» помещается без обрезки, но полоса не
          распирает шапку на всё свободное пространство. */}
      <div className="flex items-center h-10 rounded-full border border-gray-200 bg-white transition-shadow shadow-sm hover:shadow">
        <Search className="h-4 w-4 text-gray-400 ml-3 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER}
          style={{ width: inputWidth }}
          className="h-full bg-transparent px-2 text-sm outline-none placeholder:text-gray-400"
        />
        {/* Скрытый span для замера чистой ширины текста плейсхолдера
            (без padding — inputу padding даёт свой). Тот же text-sm, что и
            у инпута, чтобы шрифт совпадал. */}
        <span
          ref={measureRef}
          aria-hidden
          className="absolute -top-96 left-0 invisible whitespace-pre text-sm pointer-events-none"
        >
          {PLACEHOLDER}
        </span>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setActiveIndex(-1) }}
            className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 inline-flex items-center justify-center shrink-0"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={submitSearch}
          className="h-8 px-4 mr-1 rounded-full bg-brand-yellow hover:bg-yellow-500 text-black text-sm font-medium inline-flex items-center gap-1 shrink-0"
          title="Найти"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Найти</span>
        </button>
      </div>

      {showResults && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-[60]">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Ищу…
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              Ничего не нашлось по запросу «{query.trim()}»
            </div>
          ) : (
            <>
              <ul className="max-h-[420px] overflow-y-auto">
                {results.map((p, i) => (
                  <li key={p.id}>
                    <Link
                      href={`/product/${p.slug}`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 border-b last:border-b-0 border-gray-100 transition-colors",
                        activeIndex === i ? "bg-yellow-50" : "hover:bg-gray-50",
                      )}
                    >
                      <div className="h-10 w-10 shrink-0 rounded bg-gray-100 overflow-hidden flex items-center justify-center">
                        {p.image_url ? (
                          <Image
                            src={getImageUrl(p.image_url) || ""}
                            alt={p.name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400">нет фото</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{p.name}</div>
                        {p.brand_info?.name && (
                          <div className="text-xs text-gray-400 truncate">{p.brand_info.name}</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {p.price != null ? `${Math.round(p.price).toLocaleString("ru-RU")} ₸` : "—"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={submitSearch}
                className="block w-full text-left px-3 py-2 text-sm text-yellow-700 bg-yellow-50 hover:bg-yellow-100 font-medium border-t border-gray-100"
              >
                Показать все результаты по «{query.trim()}» →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
