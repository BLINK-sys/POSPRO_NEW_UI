"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Search, Download, FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/lib/api-address"
import { listPublicDrivers, type PublicDriver } from "@/app/actions/drivers"

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
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

function DriverCard({ driver }: { driver: PublicDriver; onItemClick?: () => void }) {
  return (
    <a
      href={`${API_BASE_URL}${driver.url}`}
      download={driver.filename || true}
      className={cn(
        "group flex flex-col bg-white border border-gray-100 rounded-xl p-3",
        "shadow-[0_2px_6px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.14)]",
        "hover:border-brand-yellow hover:-translate-y-0.5 transition-all duration-200",
      )}
    >
      <div className="w-full aspect-square rounded-lg bg-gray-50 flex items-center justify-center mb-2 overflow-hidden group-hover:bg-yellow-50 transition-colors">
        {driver.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_BASE_URL}${driver.image_url}`}
            alt={driver.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <FileText className="h-10 w-10 text-brand-yellow" />
        )}
      </div>
      <div className="flex-1 min-h-0">
        <p className="text-sm font-medium line-clamp-2 leading-tight">{driver.name}</p>
        {driver.file_size != null && (
          <p className="text-xs text-gray-400 mt-1">{formatSize(driver.file_size)}</p>
        )}
      </div>
      <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-500 group-hover:text-gray-900 transition-colors">
        <Download className="h-3 w-3" />
        <span>Скачать</span>
      </div>
    </a>
  )
}

function DriverListItem({ driver }: { driver: PublicDriver; onItemClick?: () => void }) {
  return (
    <a
      href={`${API_BASE_URL}${driver.url}`}
      download={driver.filename || true}
      className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-100 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.12)] hover:border-brand-yellow transition-all"
    >
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
      <Download className="h-4 w-4 text-gray-400 shrink-0" />
    </a>
  )
}
