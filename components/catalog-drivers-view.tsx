"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Search, Download, FileText, Loader2, Share2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/lib/api-address"
import { listPublicDrivers, type PublicDriver } from "@/app/actions/drivers"
import { useToast } from "@/hooks/use-toast"

function formatSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CatalogDriversView({
  layout = "grid",
  onItemClick,
}: {
  layout?: "grid" | "list"
  onItemClick?: () => void
}) {
  const [drivers, setDrivers] = useState<PublicDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let alive = true
    ;(async () => {
      const list = await listPublicDrivers()
      if (alive) {
        setDrivers(list)
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return drivers
    return drivers.filter((d) => d.name.toLowerCase().includes(q))
  }, [drivers, search])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Поиск драйвера..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-12">
            {drivers.length === 0 ? "Драйверов пока нет" : "По запросу ничего не найдено"}
          </p>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 pt-2">
            {filtered.map((d) => (
              <DriverCard key={d.id} driver={d} onItemClick={onItemClick} />
            ))}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {filtered.map((d) => (
              <DriverListItem key={d.id} driver={d} onItemClick={onItemClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Копирует прямую ссылку на драйвер в clipboard. Fallback через
 * document.execCommand для http-контекста (в dev), навигаторный Clipboard
 * API — для https. Возвращает true при успехе.
 */
async function copyDriverLink(url: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      return true
    }
    const ta = document.createElement("textarea")
    ta.value = url
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * Кнопка «Поделиться» — копирует ссылку в clipboard, показывает
 * зелёную галочку на 1.5 сек. Полноценная кнопка с рамкой, работает
 * как в grid-карточках, так и в list-строках.
 */
function ShareButton({ url, className, size = "sm" }: { url: string; className?: string; size?: "xs" | "sm" | "md" }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ok = await copyDriverLink(url)
    if (ok) {
      setCopied(true)
      toast({ title: "Ссылка скопирована", description: "Отправьте её кому нужно" })
      setTimeout(() => setCopied(false), 1500)
    } else {
      toast({
        title: "Не удалось скопировать",
        description: "Скопируйте ссылку вручную",
        variant: "destructive",
      })
    }
  }

  const sizeCls =
    size === "md" ? "h-9 px-3 text-sm gap-2"
      : size === "xs" ? "h-6 px-1.5 text-[10px] gap-1"
      : "h-8 px-2.5 text-xs gap-1.5"
  const iconCls =
    size === "md" ? "h-4 w-4"
      : size === "xs" ? "h-3 w-3"
      : "h-3.5 w-3.5"

  return (
    <button
      type="button"
      onClick={handleShare}
      title="Скопировать ссылку на драйвер"
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors shrink-0",
        sizeCls,
        copied
          ? "border-green-500 bg-green-50 text-green-700"
          : "border-gray-300 bg-white text-gray-700 hover:border-brand-yellow hover:bg-yellow-50 hover:text-black",
        className,
      )}
    >
      {copied ? <Check className={iconCls} /> : <Share2 className={iconCls} />}
      <span>{copied ? "Скопировано" : "Поделиться"}</span>
    </button>
  )
}

/**
 * Кнопка «Скачать». Grid-карточка целиком — `<a download>`, но нижняя
 * кнопка визуально повторяет действие клика по карточке (пользователю
 * привычнее видеть явную CTA). Клик по ней = клик по родительской `<a>`.
 */
function DownloadButton({
  href,
  filename,
  size = "sm",
  className,
}: {
  href: string
  filename?: string | null
  size?: "xs" | "sm" | "md"
  className?: string
}) {
  const sizeCls =
    size === "md" ? "h-9 px-3 text-sm gap-2"
      : size === "xs" ? "h-6 px-1.5 text-[10px] gap-1"
      : "h-8 px-2.5 text-xs gap-1.5"
  const iconCls =
    size === "md" ? "h-4 w-4"
      : size === "xs" ? "h-3 w-3"
      : "h-3.5 w-3.5"
  return (
    <a
      href={href}
      download={filename || true}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-black bg-brand-yellow text-black font-medium shrink-0",
        "hover:bg-yellow-500 hover:shadow-sm transition-colors",
        sizeCls,
        className,
      )}
    >
      <Download className={iconCls} />
      <span>Скачать</span>
    </a>
  )
}

function DriverCard({ driver }: { driver: PublicDriver; onItemClick?: () => void }) {
  const fileUrl = `${API_BASE_URL}${driver.url}`
  return (
    // Карточка целиком = <a download>. При наведении поверх появляется
    // тёмный overlay с двумя кнопками (Скачать / Поделиться) —
    // центрированный вертикально стек, в 2 строки.
    <a
      href={fileUrl}
      download={driver.filename || true}
      className={cn(
        "group relative flex flex-col bg-white border border-gray-100 rounded-lg p-2 overflow-hidden",
        "shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
        "hover:border-brand-yellow hover:-translate-y-0.5 transition-all duration-200",
      )}
    >
      <div className="w-full aspect-square rounded bg-gray-50 flex items-center justify-center mb-1.5 overflow-hidden group-hover:bg-yellow-50 transition-colors">
        {driver.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_BASE_URL}${driver.image_url}`}
            alt={driver.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <FileText className="h-7 w-7 text-brand-yellow" />
        )}
      </div>
      <div className="flex-1 min-h-0">
        <p className="text-xs font-medium line-clamp-2 leading-tight">{driver.name}</p>
        {driver.file_size != null && (
          <p className="text-[10px] text-gray-400 mt-0.5">{formatSize(driver.file_size)}</p>
        )}
      </div>

      {/* Overlay при hover: без затемнения — только две компактные
          кнопки в столбик, центрированные. Плавное появление. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-center gap-1 w-full max-w-[110px]">
          <DownloadButton href={fileUrl} filename={driver.filename} size="xs" className="w-full" />
          <ShareButton url={fileUrl} size="xs" className="w-full" />
        </div>
      </div>
    </a>
  )
}

function DriverListItem({ driver }: { driver: PublicDriver; onItemClick?: () => void }) {
  const fileUrl = `${API_BASE_URL}${driver.url}`
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-100 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.12)] hover:border-brand-yellow transition-all">
      <a href={fileUrl} download={driver.filename || true} className="flex items-center gap-3 flex-1 min-w-0">
        {driver.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_BASE_URL}${driver.image_url}`}
            alt=""
            className="h-8 w-8 rounded object-cover shrink-0"
          />
        ) : (
          <FileText className="h-5 w-5 text-brand-yellow shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{driver.name}</p>
          {driver.file_size != null && (
            <p className="text-xs text-gray-400">{formatSize(driver.file_size)}</p>
          )}
        </div>
      </a>
      <ShareButton url={fileUrl} size="md" />
      <DownloadButton href={fileUrl} filename={driver.filename} size="md" />
    </div>
  )
}
