'use client'

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Trash2, Plus, Minus, FileText, Search, Upload, Type, X, Download, Loader2, History, ChevronDown, ChevronUp, ImageIcon, Check, Calculator, Save, LogOut, FileSignature } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { useKP, KPItem, KPColumnSettings, DEFAULT_COLUMN_WIDTHS, DEFAULT_COLUMN_ALIGNS } from '@/context/kp-context'
import { useRouter } from 'next/navigation'
import { formatProductPrice } from '@/lib/utils'
import { getImageUrl } from '@/lib/image-utils'
import Link from 'next/link'
import Image from 'next/image'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

// ── A4 constants ──────────────────────────────────
const A4_WIDTH = 794
const A4_HEIGHT = 1123
const PAGE_GAP = 24
const PADDING = 48
const USABLE_HEIGHT = A4_HEIGHT - PADDING * 2 // 1027
const TABLE_CONTENT_WIDTH = A4_WIDTH - PADDING * 2 // 698

// Height estimates (fallback when measurement unavailable)
const TABLE_HEADER_H = 30
const TOTAL_ROW_H = 32
const FOOTER_NOTE_H = 28
const MANAGER_INFO_H = 52
const MANAGER_DEFAULT_POS = { x: 0, y: 0 }

// ── Column metadata ───────────────────────────────
const ALL_COLUMNS: Array<{
  key: string
  label: string
  settingsLabel: string
  align: 'left' | 'center' | 'right'
}> = [
  { key: 'number', label: '#', settingsLabel: '# (номер)', align: 'center' },
  { key: 'image', label: 'Фото', settingsLabel: 'Изображение', align: 'center' },
  { key: 'name', label: 'Наименование', settingsLabel: 'Наименование', align: 'left' },
  { key: 'description', label: 'Описание', settingsLabel: 'Описание', align: 'left' },
  { key: 'characteristics', label: 'Хар-ки', settingsLabel: 'Характеристики', align: 'left' },
  { key: 'article', label: 'Артикул', settingsLabel: 'Артикул', align: 'left' },
  { key: 'quantity', label: 'Кол-во', settingsLabel: 'Кол-во', align: 'center' },
  { key: 'price', label: 'Цена', settingsLabel: 'Цена', align: 'right' },
  { key: 'total', label: 'Сумма', settingsLabel: 'Сумма', align: 'right' },
]

// ── Font size scaling ─────────────────────────────
function getColFontSize(key: string, widths: Record<string, number>, customSizes?: Record<string, number>): number {
  // If user set a custom font size, use it
  if (customSizes && customSizes[key]) return customSizes[key]
  if (key === 'name' || key === 'image') return 11
  const w = widths[key] || DEFAULT_COLUMN_WIDTHS[key] || 50
  const defaultW = DEFAULT_COLUMN_WIDTHS[key] || 50
  const ratio = w / defaultW
  return Math.round(Math.max(7, Math.min(13, 11 * ratio)) * 10) / 10
}

// ── Fallback row height estimation ────────────────
function estimateRowHeight(item: KPItem, cols: KPColumnSettings, widths: Record<string, number>, customSizes?: Record<string, number>): number {
  let h = 28
  if (cols.image && item.image_url) {
    const imgSize = Math.max(16, (widths.image || 60) - 12)
    h = Math.max(h, imgSize + 10)
  }
  if (cols.description && item.description) {
    const colW = widths.description || 140
    const fs = getColFontSize('description', widths, customSizes)
    const cpl = Math.max(4, Math.floor(colW / (fs * 0.55)))
    const lines = Math.ceil(item.description.length / cpl)
    h = Math.max(h, lines * (fs + 3) + fs + 10) // +fs for empty line padding
  }
  if (cols.characteristics && item.characteristics?.length) {
    const chars = item.characteristics.filter(ch => ch.key.toLowerCase() !== 'code')
    if (chars.length) {
      const colW = widths.characteristics || 140
      const fs = getColFontSize('characteristics', widths, customSizes)
      let charH = 10
      for (let i = 0; i < chars.length; i++) {
        const text = `${chars[i].key}: ${chars[i].value}`
        const cpl = Math.max(4, Math.floor(colW / (fs * 0.55)))
        charH += Math.ceil(text.length / cpl) * (fs + 3)
      }
      charH += fs // empty line padding
      h = Math.max(h, charH)
    }
  }
  return h
}

// ── Page split ────────────────────────────────────
interface PageSlice {
  items: Array<{ item: KPItem; globalIndex: number }>
  isFirst: boolean
  isLast: boolean
}

function buildPages(
  items: KPItem[],
  cols: KPColumnSettings,
  widths: Record<string, number>,
  logoEnabled: boolean,
  logoWidth: number,
  measuredHeights: number[],
  customSizes?: Record<string, number>,
): PageSlice[] {
  if (items.length === 0) return []

  const firstPageHeaderH = logoEnabled ? 100 + Math.max(0, logoWidth * 0.25) : 80
  const firstAvail = USABLE_HEIGHT - firstPageHeaderH - TABLE_HEADER_H
  const otherAvail = USABLE_HEIGHT - TABLE_HEADER_H - 16

  const getRowH = (idx: number) =>
    measuredHeights[idx] > 0 ? measuredHeights[idx] : estimateRowHeight(items[idx], cols, widths, customSizes)

  const pages: PageSlice[] = []
  let idx = 0
  let isFirst = true

  while (idx < items.length) {
    let available = isFirst ? firstAvail : otherAvail
    const pageItems: Array<{ item: KPItem; globalIndex: number }> = []

    while (idx < items.length) {
      const rh = getRowH(idx)
      if (pageItems.length > 0 && available < rh) break
      pageItems.push({ item: items[idx], globalIndex: idx })
      available -= rh
      idx++
    }

    const isLast = idx >= items.length

    if (isLast && available < TOTAL_ROW_H + FOOTER_NOTE_H + MANAGER_INFO_H && pageItems.length > 1) {
      idx--
      pageItems.pop()
      pages.push({ items: pageItems, isFirst, isLast: false })
      isFirst = false
      continue
    }

    pages.push({ items: pageItems, isFirst, isLast })
    isFirst = false
  }

  return pages
}

// ── Auto-sizing textarea helper ──────────────────
function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = '0'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={1}
      style={{ overflow: 'hidden' }}
    />
  )
}

// ── Filter out "code" characteristic ─────────────
function visibleCharacteristics(chars?: Array<{ key: string; value: string }>) {
  if (!chars) return []
  return chars.filter(ch => ch.key.toLowerCase() !== 'code')
}

// ── Product card with description & characteristics ──
function KPProductCard({
  item,
  updateItem,
  updateItemQuantity,
  removeItem,
}: {
  item: KPItem
  updateItem: (kpId: string, updates: Partial<KPItem>) => void
  updateItemQuantity: (kpId: string, qty: number) => void
  removeItem: (kpId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleChars = visibleCharacteristics(item.characteristics)
  const warehousePrices = item.warehousePrices || []

  const handleAddCharacteristic = () => {
    const chars = [...(item.characteristics || []), { key: '', value: '' }]
    updateItem(item.kpId, { characteristics: chars })
  }

  const handleUpdateCharacteristic = (index: number, field: 'key' | 'value', val: string) => {
    const allChars = [...(item.characteristics || [])]
    let visibleIdx = -1
    for (let i = 0; i < allChars.length; i++) {
      if (allChars[i].key.toLowerCase() !== 'code') visibleIdx++
      if (visibleIdx === index) {
        allChars[i] = { ...allChars[i], [field]: val }
        break
      }
    }
    updateItem(item.kpId, { characteristics: allChars })
  }

  const handleRemoveCharacteristic = (index: number) => {
    const allChars = [...(item.characteristics || [])]
    let visibleIdx = -1
    for (let i = 0; i < allChars.length; i++) {
      if (allChars[i].key.toLowerCase() !== 'code') visibleIdx++
      if (visibleIdx === index) {
        allChars.splice(i, 1)
        break
      }
    }
    updateItem(item.kpId, { characteristics: allChars })
  }

  const handleWarehouseChange = (warehouseId: string) => {
    const wp = warehousePrices.find(w => String(w.warehouse_id) === warehouseId)
    if (wp && wp.calculated_price) {
      updateItem(item.kpId, {
        price: wp.calculated_price,
        selectedWarehouseId: wp.warehouse_id,
        supplier_name: wp.supplier_name,
      })
    }
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-2">
        {/* Header row — always visible (image, name, delete, expand toggle) */}
        <div className="flex gap-2 items-center">
          <Link href={`/product/${item.slug}`} className="relative w-10 h-10 bg-white rounded overflow-hidden flex-shrink-0">
            {item.image_url ? (
              <Image src={getImageUrl(item.image_url)} alt={item.name} fill className="object-contain p-0.5" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400"><FileText className="h-3 w-3" /></div>
            )}
          </Link>
          <span className="text-xs font-medium text-gray-900 flex-1 min-w-0 truncate">{item.name}</span>
          <button onClick={() => removeItem(item.kpId)} className="h-5 w-5 flex items-center justify-center text-red-500 hover:text-red-700 flex-shrink-0 border border-red-400 rounded bg-white [box-shadow:1px_2px_4px_rgba(0,0,0,0.12)]">
            <Trash2 className="h-3 w-3" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="h-5 w-5 flex items-center justify-center text-gray-600 hover:text-gray-900 flex-shrink-0 border border-yellow-400 rounded bg-white [box-shadow:1px_2px_4px_rgba(0,0,0,0.12)]">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-2 pt-2 border-t space-y-2">
            {/* Name edit */}
            <AutoTextarea
              value={item.name}
              onChange={(val) => updateItem(item.kpId, { name: val })}
              className="text-xs font-medium text-gray-900 w-full bg-transparent border border-gray-200 hover:border-gray-300 focus:border-blue-400 rounded p-1 outline-none resize-none leading-tight"
            />

            {/* Warehouse selector */}
            {warehousePrices.length > 0 && (
              <select
                value={item.selectedWarehouseId ? String(item.selectedWarehouseId) : ''}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                className="text-xs w-full bg-gray-50 border border-gray-200 focus:border-blue-400 rounded px-1 h-6 outline-none text-gray-700"
              >
                <option value="">Выбрать поставщика/склад...</option>
                {warehousePrices.map((wp) => (
                  <option key={wp.warehouse_id} value={String(wp.warehouse_id)}>
                    {wp.supplier_name ? `${wp.supplier_name} — ` : ''}{wp.warehouse_name}: {formatProductPrice(wp.calculated_price || 0)} ₸
                  </option>
                ))}
              </select>
            )}

            {/* Price + Qty */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateItem(item.kpId, { price: parseFloat(e.target.value) || 0 })}
                  className="text-base font-bold text-gray-800 w-24 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-0.5 h-7 outline-none"
                />
                <span className="text-xs text-gray-400">₸</span>
              </div>
              <div className="flex items-center gap-0.5 ml-auto">
                <Button variant="outline" size="sm" onClick={() => updateItemQuantity(item.kpId, item.quantity - 1)} disabled={item.quantity <= 1} className="w-6 h-6 rounded-full p-0 text-xs">
                  <Minus className="h-3 w-3" />
                </Button>
                <input
                  type="text" value={item.quantity}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) updateItemQuantity(item.kpId, v) }}
                  className="w-8 text-center text-xs border rounded h-6"
                />
                <Button variant="outline" size="sm" onClick={() => updateItemQuantity(item.kpId, item.quantity + 1)} className="w-6 h-6 rounded-full p-0 text-xs bg-yellow-400 hover:bg-yellow-500">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Описание</label>
              <AutoTextarea
                value={item.description || ''}
                onChange={(val) => updateItem(item.kpId, { description: val })}
                placeholder="Описание товара..."
                className="text-[11px] text-gray-700 w-full bg-gray-50 border border-gray-200 focus:border-blue-400 rounded p-1.5 resize-none leading-tight outline-none mt-0.5"
              />
            </div>

            {/* Characteristics */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-gray-500 uppercase">Характеристики</label>
                <button
                  onClick={handleAddCharacteristic}
                  className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                >
                  <Plus className="h-2.5 w-2.5" /> Добавить
                </button>
              </div>
              {visibleChars.map((ch, idx) => (
                <div key={idx} className="flex items-center gap-1 mt-1">
                  <input
                    type="text"
                    value={ch.key}
                    onChange={(e) => handleUpdateCharacteristic(idx, 'key', e.target.value)}
                    placeholder="Ключ"
                    className="text-[10px] w-1/3 bg-gray-50 border border-gray-200 focus:border-blue-400 rounded px-1 h-5 outline-none"
                  />
                  <input
                    type="text"
                    value={ch.value}
                    onChange={(e) => handleUpdateCharacteristic(idx, 'value', e.target.value)}
                    placeholder="Значение"
                    className="text-[10px] flex-1 bg-gray-50 border border-gray-200 focus:border-blue-400 rounded px-1 h-5 outline-none"
                  />
                  <button
                    onClick={() => handleRemoveCharacteristic(idx)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {visibleChars.length === 0 && (
                <p className="text-[10px] text-gray-400 mt-1">Нет характеристик</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ══════════════════════════════════════════════════
export default function KPPage() {
  const { user } = useAuth()
  const {
    kpItems, kpCount, removeItem, updateItemQuantity, updateItem, clearAll,
    kpSettings, updateSettings, updateColumns, updateColumnWidth, updateColumnFontSize, updateColumnHeaderFontSize, updateColumnAlign, updateColumnHeaderAlign, updateLogo,
    addTextElement, updateTextElement, removeTextElement,
    kpHistory, historyLoading, fetchHistory, saveToHistory, loadFromHistory, deleteFromHistory,
  } = useKP()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLTableElement>(null)
  const [scale, setScale] = useState(0.5)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [editingElement, setEditingElement] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)
  const [measuredHeights, setMeasuredHeights] = useState<number[]>([])
  const [exporting, setExporting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistoryId, setLoadingHistoryId] = useState<number | null>(null)
  const [newTextPage, setNewTextPage] = useState(0)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [savingKP, setSavingKP] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoUploadRef = useRef<HTMLInputElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)

  // Logo gallery state
  const [showLogoModal, setShowLogoModal] = useState(false)
  const [userLogos, setUserLogos] = useState<Array<{ filename: string; url: string; size: number; uploaded_at: string }>>([])
  const [logosLoading, setLogosLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  const isSystemUser = user?.role === "admin" || user?.role === "system"

  useEffect(() => {
    if (user && !isSystemUser) router.push('/')
  }, [user, isSystemUser, router])

  // ── Calculate scale ───────────────────────────
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        setScale(Math.min(containerWidth / A4_WIDTH, 1))
      }
    }
    // Небольшая задержка для корректного измерения после смены layout
    const timer = setTimeout(updateScale, 50)
    const observer = new ResizeObserver(updateScale)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [kpItems.length])

  // ── Measure real row heights ──────────────────
  useLayoutEffect(() => {
    if (!measureRef.current || kpItems.length === 0) return
    const rows = measureRef.current.querySelectorAll('tbody tr')
    const heights = Array.from(rows).map(row => (row as HTMLElement).offsetHeight)
    if (heights.length !== measuredHeights.length || heights.some((h, i) => Math.abs(h - (measuredHeights[i] || 0)) > 1)) {
      setMeasuredHeights(heights)
    }
  })

  // ── Text element drag ─────────────────────────
  const handleDragStart = useCallback((elementId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedElement(elementId)
    setDragging(elementId)

    const startX = e.clientX
    const startY = e.clientY
    const element = kpSettings.textElements.find(el => el.id === elementId)
    if (!element) return
    const startElX = element.x
    const startElY = element.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      updateTextElement(elementId, {
        x: Math.max(0, Math.min(A4_WIDTH - 100, startElX + dx)),
        y: Math.max(0, Math.min(A4_HEIGHT - 30, startElY + dy)),
      })
    }

    const handleMouseUp = () => {
      setDragging(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [kpSettings.textElements, scale, updateTextElement])

  // ── Logo drag ─────────────────────────────────
  const [logoPos, setLogoPos] = useState<{ x: number; y: number }>({ x: 48, y: 48 })
  const [logoLoaded, setLogoLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem("kp-logo-pos")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed.x === 'number') setLogoPos(parsed)
      }
    } catch {}
    setLogoLoaded(true)
  }, [])

  useEffect(() => {
    if (!logoLoaded || typeof window === "undefined") return
    try { localStorage.setItem("kp-logo-pos", JSON.stringify(logoPos)) } catch {}
  }, [logoPos, logoLoaded])

  // ── Manager block drag ──────────────────────
  const [managerPos, setManagerPos] = useState<{ x: number; y: number }>(MANAGER_DEFAULT_POS)
  const [managerPosLoaded, setManagerPosLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem("kp-manager-pos")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed.x === 'number') setManagerPos(parsed)
      }
    } catch {}
    setManagerPosLoaded(true)
  }, [])

  useEffect(() => {
    if (!managerPosLoaded || typeof window === "undefined") return
    try { localStorage.setItem("kp-manager-pos", JSON.stringify(managerPos)) } catch {}
  }, [managerPos, managerPosLoaded])

  const handleLogoDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedElement('logo')
    const startX = e.clientX
    const startY = e.clientY
    const startLX = logoPos.x
    const startLY = logoPos.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      setLogoPos({
        x: Math.max(0, Math.min(A4_WIDTH - 50, startLX + dx)),
        y: Math.max(0, Math.min(A4_HEIGHT - 50, startLY + dy)),
      })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [logoPos, scale])

  // ── Logo corner resize ──────────────────────
  const handleLogoResizeStart = useCallback((corner: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = kpSettings.logo.width
    const startHeight = kpSettings.logo.height || 0
    // If no explicit height set, get current rendered height
    const imgEl = (e.target as HTMLElement).parentElement?.querySelector('img')
    const actualHeight = startHeight > 0 ? startHeight : (imgEl?.offsetHeight || 80)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      const signX = corner.includes('right') ? 1 : -1
      const signY = corner.includes('bottom') ? 1 : -1
      const newWidth = Math.max(30, Math.min(500, Math.round(startWidth + dx * signX)))
      const newHeight = Math.max(20, Math.min(400, Math.round(actualHeight + dy * signY)))
      updateLogo({ width: newWidth, height: newHeight })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [kpSettings.logo.width, kpSettings.logo.height, scale, updateLogo])

  // ── Manager block drag ──────────────────────
  const handleManagerDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedElement('manager')
    const startX = e.clientX
    const startY = e.clientY
    const startMX = managerPos.x
    const startMY = managerPos.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      setManagerPos({
        x: startMX + dx,
        y: startMY + dy,
      })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [managerPos, scale])

  // ── Inline text editing ───────────────────────
  const handleDoubleClick = useCallback((elementId: string) => {
    setEditingElement(elementId)
    setSelectedElement(elementId)
  }, [])

  const handleBlur = useCallback((elementId: string, newText: string) => {
    updateTextElement(elementId, { text: newText })
    setEditingElement(null)
  }, [updateTextElement])

  // ── Logo gallery ─────────────────────────────
  const fetchUserLogos = useCallback(async () => {
    setLogosLoading(true)
    try {
      const resp = await fetch('/api/kp-logos')
      const data = await resp.json()
      if (data.success && Array.isArray(data.logos)) {
        setUserLogos(data.logos)
      }
    } catch (err) {
      console.error('Failed to fetch logos:', err)
    } finally {
      setLogosLoading(false)
    }
  }, [])

  const handleLogoUploadToServer = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset input

    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch('/api/kp-logos', { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.success && data.logo) {
        setUserLogos(prev => [...prev, data.logo])
        // Auto-select the uploaded logo
        updateLogo({ serverUrl: data.logo.url, logoFilename: data.logo.filename, customUrl: undefined })
      }
    } catch (err) {
      console.error('Failed to upload logo:', err)
    } finally {
      setLogoUploading(false)
    }
  }, [updateLogo])

  const handleDeleteLogo = useCallback(async (filename: string) => {
    try {
      const resp = await fetch(`/api/kp-logos/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      const data = await resp.json()
      if (data.success) {
        setUserLogos(prev => prev.filter(l => l.filename !== filename))
        // If deleted logo was selected, reset
        if (kpSettings.logo.logoFilename === filename) {
          updateLogo({ serverUrl: undefined, logoFilename: undefined })
        }
      }
    } catch (err) {
      console.error('Failed to delete logo:', err)
    }
  }, [kpSettings.logo.logoFilename, updateLogo])

  const handleSelectLogo = useCallback((logoItem: { filename: string; url: string }) => {
    updateLogo({ serverUrl: logoItem.url, logoFilename: logoItem.filename, customUrl: undefined })
    setShowLogoModal(false)
  }, [updateLogo])

  const handleOpenLogoModal = useCallback(() => {
    setShowLogoModal(true)
    fetchUserLogos()
  }, [fetchUserLogos])

  // ── Deselect ──────────────────────────────────
  const handlePreviewClick = useCallback(() => {
    setSelectedElement(null)
    setSelectedColumn(null)
  }, [])

  // ── PDF Export ───────────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (!pagesRef.current || exporting) return
    setExporting(true)

    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const container = pagesRef.current
      const prevTransform = container.style.transform

      // Pre-convert images to data URLs via same-origin proxy (avoids CORS issues with html2canvas)
      const imgs = container.querySelectorAll('img') as NodeListOf<HTMLImageElement>
      const originalSrcs = new Map<HTMLImageElement, string>()

      await Promise.all(Array.from(imgs).map(async (img) => {
        if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) return
        try {
          // Use same-origin proxy to bypass CORS restrictions on external images
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(img.src)}`
          const resp = await fetch(proxyUrl)
          if (!resp.ok) throw new Error(`Proxy returned ${resp.status}`)
          const blob = await resp.blob()
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          originalSrcs.set(img, img.src)
          img.src = dataUrl
        } catch (e) {
          console.warn('Could not convert image to data URL:', img.src, e)
        }
      }))

      // Wait a tick for browser to re-render with data URLs
      await new Promise(r => setTimeout(r, 100))

      // Temporarily reset scale to 1:1 for accurate capture
      container.style.transform = 'scale(1)'

      // Hide interactive-only elements (selection outlines, resize handles)
      const prevSelected = selectedElement
      setSelectedElement(null)
      await new Promise(r => setTimeout(r, 50))

      // A4 in mm: 210 x 297
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageElements = container.querySelectorAll('[data-kp-page]')

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: A4_WIDTH,
          height: A4_HEIGHT,
          logging: false,
        })

        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297)
      }

      // Restore scale
      container.style.transform = prevTransform

      // Restore original image sources
      originalSrcs.forEach((src, img) => { img.src = src })

      // Restore selection
      setSelectedElement(prevSelected)

      const now = new Date()
      const dateStr = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getFullYear()).slice(-2),
      ].join('-')
      const name = kpSettings.kpName || 'КП'
      pdf.save(`${name}_${dateStr}.pdf`)

      // Автосохранение в историю (с позициями)
      saveToHistory({ logoPos, managerPos })
    } catch (err) {
      console.error('PDF export error:', err)
      // Restore scale on error
      if (pagesRef.current) {
        pagesRef.current.style.transform = `scale(${scale})`
      }
    } finally {
      setExporting(false)
    }
  }, [exporting, scale, kpSettings.kpName, selectedElement, saveToHistory, logoPos, managerPos])

  // ── Guard ─────────────────────────────────────
  if (!isSystemUser) return null

  // ── Derived data ──────────────────────────────
  const totalAmount = kpItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const { columns, columnWidths, columnFontSizes, columnHeaderFontSizes, columnAligns, columnHeaderAligns, mergeImageName, managerAlign, logo, textElements, kpName, title, footerNote } = kpSettings
  const logoSrc = logo.serverUrl ? getImageUrl(logo.serverUrl) : (logo.customUrl || "/ui/big_logo.png")

  // Visible columns
  const visibleCols = ALL_COLUMNS.filter(col => {
    // When merged, hide separate image column — name becomes "Товар" with embedded image
    if (mergeImageName && col.key === 'image') return false
    if (col.key === 'name') return true
    return columns[col.key as keyof KPColumnSettings]
  })

  // Build pages using measured heights
  const pages = buildPages(kpItems, columns, columnWidths, logo.enabled, logo.width, measuredHeights, columnFontSizes)
  const totalContentHeight = A4_HEIGHT * pages.length + PAGE_GAP * Math.max(0, pages.length - 1)

  // ── Render table cell (shared by measurement + visible tables) ──
  const renderCell = (colKey: string, item: KPItem, globalIndex: number) => {
    const fontSize = getColFontSize(colKey, columnWidths, columnFontSizes)
    const w = columnWidths[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 50
    const align = columnAligns[colKey] || DEFAULT_COLUMN_ALIGNS[colKey] || 'left'
    const cellStyle: React.CSSProperties = { verticalAlign: 'top', border: '1px solid #d1d5db', padding: '4px', textAlign: align }

    switch (colKey) {
      case 'number':
        return <td key={colKey} style={{ ...cellStyle, fontSize }}>{globalIndex + 1}</td>
      case 'image': {
        const imgSize = Math.max(16, w - 12)
        const imgMargin: React.CSSProperties = align === 'center'
          ? { marginLeft: 'auto', marginRight: 'auto' }
          : align === 'right' ? { marginLeft: 'auto' } : {}
        return (
          <td key={colKey} style={cellStyle}>
            {item.image_url ? (
              <img
                src={getImageUrl(item.image_url)}
                alt=""
                style={{ maxWidth: imgSize, maxHeight: imgSize, width: 'auto', height: 'auto', borderRadius: 4, display: 'block', ...imgMargin }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : <span style={{ color: '#d1d5db', fontSize }}>—</span>}
          </td>
        )
      }
      case 'name':
        if (mergeImageName) {
          return (
            <td key={colKey} style={{ ...cellStyle, fontSize: getColFontSize('name', columnWidths, columnFontSizes) }}>
              <div style={{ fontWeight: 500, lineHeight: 1.2 }}>{item.name}</div>
              {item.image_url && (
                <img
                  src={getImageUrl(item.image_url)}
                  alt=""
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: 4, marginTop: 4 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
            </td>
          )
        }
        return <td key={colKey} style={{ ...cellStyle, fontSize: getColFontSize('name', columnWidths, columnFontSizes) }}><div style={{ fontWeight: 500, lineHeight: 1.2 }}>{item.name}</div></td>
      case 'description':
        return (
          <td key={colKey} style={{ ...cellStyle, fontSize, color: '#6b7280' }}>
            <div style={{ lineHeight: 1.2 }}>{item.description || '—'}</div>
            <div style={{ height: fontSize }} />
          </td>
        )
      case 'characteristics': {
        const chars = visibleCharacteristics(item.characteristics)
        return (
          <td key={colKey} style={{ ...cellStyle, fontSize }}>
            {chars.length ? (
              <div style={{ lineHeight: 1.2 }}>
                {chars.map((ch, i) => (
                  <div key={i}><span style={{ fontWeight: 'bold', color: '#000' }}>{ch.key}:</span> <span style={{ color: '#6b7280' }}>{ch.value}</span></div>
                ))}
                <div style={{ height: fontSize }} />
              </div>
            ) : <span style={{ color: '#d1d5db', fontSize }}>—</span>}
          </td>
        )
      }
      case 'article':
        return <td key={colKey} style={{ ...cellStyle, fontSize, color: '#6b7280' }}>{item.article || '—'}</td>
      case 'quantity':
        return <td key={colKey} style={{ ...cellStyle, fontSize }}>{item.quantity}</td>
      case 'price':
        return <td key={colKey} style={{ ...cellStyle, fontSize }}>{formatProductPrice(item.price)}</td>
      case 'total':
        return <td key={colKey} style={{ ...cellStyle, fontSize, fontWeight: 500 }}>{formatProductPrice(item.price * item.quantity)}</td>
      default:
        return null
    }
  }

  // Colgroup definition (shared) — proportionally scales columns to fit TABLE_CONTENT_WIDTH
  const renderColgroup = () => {
    // Get raw widths for all visible columns
    const rawWidths = visibleCols.map(col => {
      if (col.key === 'name' && !columnWidths.name) return 0 // computed below
      return columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 50
    })

    // If name has no explicit width, give it remaining space
    const nameIdx = visibleCols.findIndex(c => c.key === 'name')
    if (nameIdx >= 0 && rawWidths[nameIdx] === 0) {
      const othersTotal = rawWidths.reduce((s, w) => s + w, 0)
      rawWidths[nameIdx] = Math.max(60, TABLE_CONTENT_WIDTH - othersTotal)
    }

    // Scale proportionally if total exceeds available width
    const total = rawWidths.reduce((s, w) => s + w, 0)
    const ratio = total > TABLE_CONTENT_WIDTH ? TABLE_CONTENT_WIDTH / total : 1

    return (
      <colgroup>
        {visibleCols.map((col, i) => (
          <col key={col.key} style={{ width: Math.round(rawWidths[i] * ratio) }} />
        ))}
      </colgroup>
    )
  }

  // ── Empty state ───────────────────────────────
  if (kpItems.length === 0) {
    // Делим историю на две группы: жёлтые сохранённые vs зелёные подписанные.
    const savedKps = kpHistory.filter(e => !e.signed_at)
    const signedKps = kpHistory.filter(e => !!e.signed_at)
    const hasAnyHistory = kpHistory.length > 0

    const renderEntry = (entry: typeof kpHistory[number], isSigned: boolean) => (
      <div
        key={entry.id}
        className={
          "flex items-center justify-between p-3 rounded-lg border transition-colors group " +
          (isSigned
            ? "bg-green-50 border-green-200 hover:border-green-500 hover:bg-green-100"
            : "bg-yellow-50 border-yellow-200 hover:border-yellow-500 hover:bg-yellow-100")
        }
      >
        <button
          className="flex-1 text-left min-w-0 text-black"
          disabled={loadingHistoryId === entry.id}
          onClick={async () => {
            setLoadingHistoryId(entry.id)
            const result = await loadFromHistory(entry.id)
            if (result.positions?.logoPos) setLogoPos(result.positions.logoPos)
            if (result.positions?.managerPos) setManagerPos(result.positions.managerPos)
            setLoadingHistoryId(null)
          }}
        >
          <div className="font-medium truncate flex items-center gap-2">
            {entry.name}
            {isSigned && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-200 text-green-900 border border-green-300">
                Подписан
              </span>
            )}
          </div>
          <div className="text-sm text-gray-700 flex items-center gap-3 mt-0.5">
            <span>{new Date(entry.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="font-medium">{entry.total_amount.toLocaleString()} тг</span>
          </div>
        </button>
        {loadingHistoryId === entry.id ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 ml-3 shrink-0" />
        ) : (
          <button
            onClick={async (e) => {
              e.stopPropagation()
              await deleteFromHistory(entry.id)
            }}
            className="ml-3 shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Удалить из истории"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    )

    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Коммерческое предложение</h1>
          </div>
          {/* Когда есть история — большая карточка пустого состояния не нужна,
              но нужен короткий доступ к поиску чтобы начать новое КП. */}
          {hasAnyHistory && (
            <Button asChild className="bg-brand-yellow hover:bg-yellow-500 text-black rounded-full">
              <Link href="/search"><Search className="h-4 w-4 mr-2" />Найти товары</Link>
            </Button>
          )}
        </div>

        {/* Большая пустая карточка только если истории нет вообще. */}
        {!hasAnyHistory && (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">Список КП пуст</h2>
              <p className="text-gray-600 mb-4">Добавьте товары из поиска для создания коммерческого предложения</p>
              <Button asChild className="bg-brand-yellow hover:bg-yellow-500 text-black">
                <Link href="/search"><Search className="h-4 w-4 mr-2" />Найти товары</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Две колонки: жёлтые сохранённые + зелёные подписанные. На мобильных
            стекаются (но в мобилке этот раздел не используется по факту). */}
        {hasAnyHistory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Жёлтая колонка — сохранённые КП */}
            <Card className="border-yellow-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-5 w-5 text-yellow-600" />
                  <h2 className="text-lg font-semibold">Ранее сформированные КП</h2>
                  <span className="text-sm text-gray-500">({savedKps.length})</span>
                </div>
                {savedKps.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Сохранённых КП пока нет</p>
                ) : (
                  <div className="space-y-2">
                    {savedKps.map((entry) => renderEntry(entry, false))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Зелёная колонка — подписанные контракты */}
            <Card className="border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileSignature className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-semibold">Подписанные контракты</h2>
                  <span className="text-sm text-gray-500">({signedKps.length})</span>
                </div>
                {signedKps.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Подписанных контрактов нет</p>
                ) : (
                  <div className="space-y-2">
                    {signedKps.map((entry) => renderEntry(entry, true))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  return (
    <div className="h-[calc(100vh-96px)] flex flex-col overflow-hidden">
      {/* Hidden measurement table — same styles as A4, used to get real row heights */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          width: TABLE_CONTENT_WIDTH,
          visibility: 'hidden',
          pointerEvents: 'none',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <table ref={measureRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          {renderColgroup()}
          <tbody>
            {kpItems.map((item, index) => (
              <tr key={item.id}>
                {visibleCols.map(col => renderCell(col.key, item, index))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-lg font-bold">Коммерческое предложение</h1>
          <Badge variant="secondary">{kpCount} {kpCount === 1 ? 'позиция' : kpCount < 5 ? 'позиции' : 'позиций'}</Badge>
          {pages.length > 1 && (
            <Badge variant="outline" className="text-gray-500">{pages.length} стр.</Badge>
          )}
        </div>

        {/* История КП — слева после badges */}
        {kpHistory.length > 0 && (
          <div className="relative ml-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-black bg-white border border-yellow-400 hover:bg-yellow-50 rounded-full transition-colors [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]"
            >
              <History className="h-4 w-4" />
              История КП ({kpHistory.length})
              {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showHistory && (
              <div className="absolute top-full mt-1 left-0 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 space-y-1 max-h-64 overflow-y-auto">
                {kpHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-yellow-50 hover:border-yellow-400 border border-transparent transition-colors group"
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      disabled={loadingHistoryId === entry.id}
                      onClick={async () => {
                        setLoadingHistoryId(entry.id)
                        const result = await loadFromHistory(entry.id)
                        if (result.positions?.logoPos) setLogoPos(result.positions.logoPos)
                        if (result.positions?.managerPos) setManagerPos(result.positions.managerPos)
                        setLoadingHistoryId(null)
                        if (result.success) setShowHistory(false)
                      }}
                    >
                      <div className="text-sm font-medium truncate">{entry.name}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <span>{new Date(entry.created_at).toLocaleDateString('ru-RU')}</span>
                        <span>{entry.total_amount.toLocaleString()} тг</span>
                      </div>
                    </button>
                    {loadingHistoryId === entry.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 ml-2 shrink-0" />
                    ) : (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await deleteFromHistory(entry.id)
                        }}
                        className="ml-2 shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить из истории"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Правая часть: Корп. расчётник + Сохранить + Выйти + Очистить */}
        <div className="flex items-center gap-2">
          {kpCount > 0 && (
            <button
              onClick={() => router.push('/calculator')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-black bg-white border border-yellow-400 hover:bg-yellow-50 rounded-full transition-colors [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]"
            >
              <Calculator className="h-4 w-4" />
              Корп. расчётник
            </button>
          )}

          {kpCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={savingKP}
              onClick={async () => {
                setSavingKP(true)
                try {
                  const ok = await saveToHistory({ logoPos, managerPos })
                  toast({
                    title: ok ? "КП сохранён" : "Не удалось сохранить",
                    description: ok ? "Запись добавлена в историю КП" : "Попробуйте ещё раз",
                    variant: ok ? "default" : "destructive",
                  })
                } finally {
                  setSavingKP(false)
                }
              }}
              className="bg-white border-green-500 text-green-700 hover:bg-green-50 rounded-full text-sm [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]"
            >
              {savingKP ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Сохранить КП
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/search')}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full text-sm [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Выйти
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowClearConfirm(true)}
            className="bg-white border-red-400 text-red-600 hover:bg-red-50 rounded-full text-sm [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]"
            size="sm"
          >
            Очистить КП
          </Button>
        </div>
      </div>

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-80 p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2">Очистить КП?</h3>
            <p className="text-sm text-gray-500 mb-5">Все товары и настройки будут удалены из текущего КП.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)} className="rounded-full px-5">
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={() => { clearAll(); setShowClearConfirm(false) }}
                className="rounded-full px-5 bg-red-500 hover:bg-red-600 text-white"
              >
                Очистить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3-panel resizable layout */}
      <PanelGroup direction="horizontal" className="flex-1">

        {/* ══ LEFT: Product list ══ */}
        <Panel defaultSize={25} minSize={15}>
          <div className="h-full overflow-y-auto border-r bg-gray-50">
            <div className="p-3 space-y-2">
              <h2 className="text-sm font-semibold text-gray-600 px-1">Товары в КП</h2>
              {kpItems.map((item) => (
                <KPProductCard
                  key={item.kpId}
                  item={item}
                  updateItem={updateItem}
                  updateItemQuantity={updateItemQuantity}
                  removeItem={removeItem}
                />
              ))}
              <div className="bg-white rounded-lg border p-2 mt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{kpCount} поз.</span>
                  <span className="font-bold">Итого: {formatProductPrice(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

        {/* ══ CENTER: A4 Preview (multi-page) ══ */}
        <Panel defaultSize={50} minSize={25}>
          <div className="h-full overflow-auto bg-gray-200 p-4 flex justify-center">
            <div ref={containerRef} className="w-full max-w-[820px]">
              <div style={{ height: totalContentHeight * scale }}>
                <div
                  ref={pagesRef}
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: A4_WIDTH,
                  }}
                >
                  {pages.map((page, pageIdx) => (
                    <div
                      key={pageIdx}
                      data-kp-page
                      className="shadow-2xl"
                      style={{
                        width: A4_WIDTH,
                        height: A4_HEIGHT,
                        fontFamily: 'Arial, sans-serif',
                        marginBottom: pageIdx < pages.length - 1 ? PAGE_GAP : 0,
                        backgroundColor: '#ffffff',
                        position: 'relative',
                        userSelect: 'none',
                      }}
                      onClick={handlePreviewClick}
                    >
                      {/* ─ Page content ─ */}
                      <div style={{ position: 'absolute', inset: 0, padding: 48, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                        {page.isFirst && (
                          <>
                            <div style={{ textAlign: 'right', fontSize: 14, color: '#6b7280', marginBottom: 32, marginLeft: 'auto' }}>
                              {new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <h2
                              style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, marginTop: logo.enabled ? Math.max(0, logo.width * 0.3) : 0 }}
                            >
                              {title}
                            </h2>
                          </>
                        )}

                        {!page.isFirst && (
                          <div style={{ fontSize: 10, color: '#d1d5db', marginBottom: 8, textAlign: 'right' }}>Продолжение</div>
                        )}

                        {/* Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                          {renderColgroup()}
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              {visibleCols.map(col => (
                                <td
                                  key={col.key}
                                  style={{
                                    border: '1px solid #d1d5db',
                                    padding: '8px 4px',
                                    fontSize: getColFontSize(col.key, columnWidths, columnHeaderFontSizes),
                                    textAlign: columnHeaderAligns[col.key] || columnAligns[col.key] || DEFAULT_COLUMN_ALIGNS[col.key] || 'center',
                                    verticalAlign: 'middle',
                                    fontWeight: 'bold',
                                    background: selectedColumn === col.key ? '#dbeafe' : '#f3f4f6',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedColumn(col.key)
                                  }}
                                >
                                  {mergeImageName && col.key === 'name' ? 'Товар' : col.label}
                                </td>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {page.items.map(({ item, globalIndex }) => (
                              <tr key={item.id}>
                                {visibleCols.map(col => renderCell(col.key, item, globalIndex))}
                              </tr>
                            ))}
                          </tbody>
                          {page.isLast && (
                            <tfoot>
                              <tr style={{ background: '#f9fafb', fontWeight: 'bold' }}>
                                <td
                                  colSpan={visibleCols.length - (columns.total ? 1 : 0)}
                                  style={{ border: '1px solid #d1d5db', padding: '10px 6px', fontSize: 11, textAlign: 'right', verticalAlign: 'middle' }}
                                >
                                  Итого:
                                </td>
                                {columns.total && (
                                  <td
                                    style={{ border: '1px solid #d1d5db', padding: '10px 6px', fontSize: getColFontSize('total', columnWidths, columnFontSizes), textAlign: 'center', verticalAlign: 'middle' }}
                                  >
                                    {formatProductPrice(totalAmount)}
                                  </td>
                                )}
                              </tr>
                            </tfoot>
                          )}
                        </table>

                        {page.isLast && footerNote && (
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
                            <p>{footerNote}</p>
                          </div>
                        )}

                        {/* Manager info — draggable, inline-block to fit content */}
                        {page.isLast && user && (
                          <div
                            style={{
                              marginTop: 16,
                              position: 'relative',
                              left: managerPos.x,
                              top: managerPos.y,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                color: '#4b5563',
                                display: 'inline-block',
                                textAlign: managerAlign,
                                cursor: dragging === 'manager' ? 'grabbing' : 'grab',
                                outline: selectedElement === 'manager' ? '2px solid #3b82f6' : 'none',
                                outlineOffset: 2,
                                padding: '2px 6px',
                              }}
                              onMouseDown={handleManagerDragStart}
                              onClick={(e) => { e.stopPropagation(); setSelectedElement('manager') }}
                            >
                              {user.full_name && <div style={{ fontWeight: 500 }}>Менеджер: {user.full_name}</div>}
                              {user.email && <div>Mail: {user.email}</div>}
                              {user.phone && <div>Телефон: {user.phone}</div>}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Draggable logo — first page */}
                      {page.isFirst && logo.enabled && (
                        <div
                          style={{
                            position: 'absolute',
                            left: logoPos.x,
                            top: logoPos.y,
                            cursor: dragging === 'logo' ? 'grabbing' : 'grab',
                            outline: selectedElement === 'logo' ? '2px solid #3b82f6' : 'none',
                            outlineOffset: 4,
                            zIndex: 10,
                          }}
                          onMouseDown={handleLogoDragStart}
                          onClick={(e) => { e.stopPropagation(); setSelectedElement('logo') }}
                        >
                          <img
                            src={logoSrc}
                            alt="Logo"
                            style={{ width: logo.width, height: logo.height > 0 ? logo.height : 'auto' }}
                            draggable={false}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                          {/* Bottom-right resize handle */}
                          {selectedElement === 'logo' && (
                            <div
                              style={{
                                position: 'absolute',
                                width: 18,
                                height: 18,
                                background: '#3b82f6',
                                border: '2px solid white',
                                borderRadius: '50%',
                                bottom: -9,
                                right: -9,
                                cursor: 'nwse-resize',
                                zIndex: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onMouseDown={(e) => handleLogoResizeStart('bottom-right', e)}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: 'rotate(0deg)' }}>
                                <path d="M1 9L9 1M9 1H3M9 1V7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Draggable text elements — per page */}
                      {textElements.filter(el => (el.page ?? 0) === pageIdx).map((el) => (
                        <div
                          key={el.id}
                          style={{
                            position: 'absolute',
                            left: el.x,
                            top: el.y,
                            fontSize: el.fontSize,
                            fontWeight: el.fontWeight,
                            textAlign: el.textAlign,
                            cursor: editingElement === el.id ? 'text' : (dragging === el.id ? 'grabbing' : 'grab'),
                            outline: selectedElement === el.id ? '2px solid #3b82f6' : '1px dashed transparent',
                            outlineOffset: 2,
                            padding: '2px 4px',
                            minWidth: 60,
                            zIndex: selectedElement === el.id ? 20 : 5,
                            userSelect: editingElement === el.id ? 'text' : 'none',
                          }}
                          onMouseDown={(e) => {
                            if (editingElement === el.id) return
                            handleDragStart(el.id, e)
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedElement(el.id) }}
                          onDoubleClick={() => handleDoubleClick(el.id)}
                        >
                          {editingElement === el.id ? (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleBlur(el.id, e.currentTarget.textContent || '')}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() } }}
                              className="outline-none border-b-2 border-blue-400 min-w-[60px]"
                              style={{ fontSize: el.fontSize, fontWeight: el.fontWeight }}
                              ref={(node) => {
                                if (node) {
                                  node.focus()
                                  const range = document.createRange()
                                  range.selectNodeContents(node)
                                  const sel = window.getSelection()
                                  sel?.removeAllRanges()
                                  sel?.addRange(range)
                                }
                              }}
                            >
                              {el.text}
                            </div>
                          ) : (
                            <span>{el.text}</span>
                          )}
                        </div>
                      ))}

                      {/* Page number */}
                      {pages.length > 1 && (
                        <div style={{ position: 'absolute', bottom: 16, right: 48, fontSize: 10, color: '#9ca3af' }}>
                          Стр. {pageIdx + 1} из {pages.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

        {/* ══ RIGHT: Settings panel ══ */}
        <Panel defaultSize={25} minSize={15}>
          <div className="h-full overflow-y-auto border-l bg-white">
            <div className="p-4 space-y-5">

              {/* KP Name */}
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Название КП</Label>
                <Input
                  value={kpName}
                  onChange={(e) => updateSettings({ kpName: e.target.value })}
                  className="mt-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Название для файла..."
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Имя файла: {kpName || 'КП'}_{new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}</p>
              </div>

              {/* Title */}
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Заголовок документа</Label>
                <Input
                  value={title}
                  onChange={(e) => updateSettings({ title: e.target.value })}
                  className="mt-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Коммерческое предложение"
                />
              </div>

              {/* Logo */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Логотип</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="logo-enabled"
                    checked={logo.enabled}
                    onCheckedChange={(checked) => updateLogo({ enabled: !!checked })}
                  />
                  <label htmlFor="logo-enabled" className="text-sm">Показать логотип</label>
                </div>
                {logo.enabled && (
                  <>
                    {/* Current logo preview */}
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                      <img
                        src={logoSrc}
                        alt="Logo"
                        className="h-8 max-w-[80px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/ui/big_logo.png' }}
                      />
                      <span className="text-[10px] text-gray-500 truncate flex-1">
                        {logo.logoFilename || (logo.customUrl ? 'Загруженный' : 'По умолчанию')}
                      </span>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleOpenLogoModal} className="w-full text-xs">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      Выбрать логотип
                    </Button>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-16 flex-shrink-0">Ширина</Label>
                      <Slider
                        value={[logo.width]}
                        onValueChange={([v]) => updateLogo({ width: v })}
                        min={30}
                        max={500}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-[10px] text-gray-500 w-8 text-right">{logo.width}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-16 flex-shrink-0">Высота</Label>
                      <Slider
                        value={[logo.height || 0]}
                        onValueChange={([v]) => updateLogo({ height: v })}
                        min={0}
                        max={400}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-[10px] text-gray-500 w-8 text-right">{logo.height || 'авто'}</span>
                    </div>

                    {(logo.serverUrl || logo.customUrl) && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => updateLogo({ serverUrl: undefined, logoFilename: undefined, customUrl: undefined })}
                        className="w-full text-xs text-red-500"
                      >
                        Сбросить на лого по умолчанию
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Merge toggle */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="merge-image-name"
                    checked={mergeImageName}
                    onCheckedChange={(checked) => updateSettings({ mergeImageName: !!checked })}
                  />
                  <label htmlFor="merge-image-name" className="text-sm cursor-pointer">
                    Совместить Фото и Наименование
                  </label>
                </div>
              </div>

              {/* Columns */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Колонки таблицы</Label>
                {ALL_COLUMNS.map(col => {
                  const isName = col.key === 'name'
                  const isImage = col.key === 'image'
                  // When merged, skip separate image/name rows — show combined "Товар" row on name
                  if (mergeImageName && isImage) return null
                  const isEnabled = isName || columns[col.key as keyof KPColumnSettings]
                  const isSelected = selectedColumn === col.key
                  const currentWidth = columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 50
                  const currentFontSize = columnFontSizes[col.key] || getColFontSize(col.key, columnWidths)
                  const currentHeaderFontSize = columnHeaderFontSizes[col.key] || getColFontSize(col.key, columnWidths)
                  const currentAlign = columnAligns[col.key] || DEFAULT_COLUMN_ALIGNS[col.key] || 'left'
                  const currentHeaderAlign = columnHeaderAligns[col.key] || currentAlign
                  const displayLabel = (mergeImageName && isName) ? 'Товар (Фото + Наименование)' : col.settingsLabel
                  // Show sliders for all enabled columns (including Name)
                  const showSliders = isEnabled && !(mergeImageName && isImage)
                  return (
                    <div
                      key={col.key}
                      className={`px-1.5 py-1.5 rounded cursor-pointer ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedColumn(col.key)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`col-${col.key}`}
                          checked={isEnabled}
                          disabled={isName}
                          onCheckedChange={(checked) => updateColumns({ [col.key]: !!checked })}
                        />
                        <label
                          htmlFor={`col-${col.key}`}
                          className={`text-sm flex-1 cursor-pointer ${isName && !mergeImageName ? 'text-gray-400' : ''} ${isSelected ? 'font-medium text-blue-700' : ''}`}
                        >
                          {displayLabel}
                        </label>
                      </div>
                      {showSliders && (
                        <div className="mt-1.5 pl-6 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">Ширина</span>
                            <Slider
                              value={[currentWidth]}
                              onValueChange={([v]) => updateColumnWidth(col.key, v)}
                              min={20}
                              max={300}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-[10px] text-gray-500 w-8 text-right">{currentWidth}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">Шрифт</span>
                            <Slider
                              value={[currentFontSize]}
                              onValueChange={([v]) => updateColumnFontSize(col.key, v)}
                              min={6}
                              max={18}
                              step={0.5}
                              className="flex-1"
                            />
                            <span className="text-[10px] text-gray-500 w-8 text-right">{currentFontSize}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">Шр. загол.</span>
                            <Slider
                              value={[currentHeaderFontSize]}
                              onValueChange={([v]) => updateColumnHeaderFontSize(col.key, v)}
                              min={6}
                              max={18}
                              step={0.5}
                              className="flex-1"
                            />
                            <span className="text-[10px] text-gray-500 w-8 text-right">{currentHeaderFontSize}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">Текст</span>
                            <div className="flex flex-1 gap-0.5">
                              {([['left', 'Лево'], ['center', 'Центр'], ['right', 'Право']] as const).map(([val, label]) => (
                                <button
                                  key={val}
                                  className={`flex-1 text-[10px] py-0.5 rounded ${currentAlign === val ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                  onClick={() => updateColumnAlign(col.key, val)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">Ц. загол.</span>
                            <div className="flex flex-1 gap-0.5">
                              {([['left', 'Лево'], ['center', 'Центр'], ['right', 'Право']] as const).map(([val, label]) => (
                                <button
                                  key={val}
                                  className={`flex-1 text-[10px] py-0.5 rounded ${currentHeaderAlign === val ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                  onClick={() => updateColumnHeaderAlign(col.key, val)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Text elements */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Текстовые элементы</Label>
                  <div className="flex items-center gap-1">
                    {pages.length > 1 && (
                      <Select value={String(newTextPage)} onValueChange={(v) => setNewTextPage(parseInt(v))}>
                        <SelectTrigger className="h-7 text-xs w-20 focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {pages.map((_, i) => (
                            <SelectItem key={i} value={String(i)}>Стр. {i + 1}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="outline" size="sm" onClick={() => addTextElement(undefined, newTextPage)} className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить
                    </Button>
                  </div>
                </div>
                {textElements.map((el) => (
                  <Card key={el.id} className={`shadow-sm ${selectedElement === el.id ? 'ring-2 ring-blue-400' : ''}`}>
                    <CardContent className="p-2 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Type className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <Input
                          value={el.text}
                          onChange={(e) => updateTextElement(el.id, { text: e.target.value })}
                          className="text-xs h-7 flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Текст..."
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeTextElement(el.id)} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: pages.length > 1 ? '1fr 1fr 1fr' : '1fr 1fr' }}>
                        <div>
                          <Label className="text-[10px] text-gray-400 mb-0.5 block">Шрифт</Label>
                          <Input
                            type="number" min={8} max={48} value={el.fontSize}
                            onChange={(e) => updateTextElement(el.id, { fontSize: parseInt(e.target.value) || 14 })}
                            className="text-xs h-7 w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-gray-400 mb-0.5 block">Стиль</Label>
                          <Select value={el.fontWeight} onValueChange={(v) => updateTextElement(el.id, { fontWeight: v as 'normal' | 'bold' })}>
                            <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Обычный</SelectItem>
                              <SelectItem value="bold">Жирный</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {pages.length > 1 && (
                          <div>
                            <Label className="text-[10px] text-gray-400 mb-0.5 block">Страница</Label>
                            <Select value={String(el.page ?? 0)} onValueChange={(v) => updateTextElement(el.id, { page: parseInt(v) })}>
                              <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {pages.map((_, i) => (
                                  <SelectItem key={i} value={String(i)}>Стр. {i + 1}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Footer note */}
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Примечание</Label>
                <Input
                  value={footerNote}
                  onChange={(e) => updateSettings({ footerNote: e.target.value })}
                  className="mt-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Текст примечания..."
                />
              </div>

              {/* Manager info settings */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Данные менеджера</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-16 flex-shrink-0">Выравн.</Label>
                  <Select value={managerAlign} onValueChange={(v) => updateSettings({ managerAlign: v as 'left' | 'center' | 'right' })}>
                    <SelectTrigger className="h-8 text-sm focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Слева</SelectItem>
                      <SelectItem value="center">По центру</SelectItem>
                      <SelectItem value="right">Справа</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(managerPos.x !== 0 || managerPos.y !== 0) && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setManagerPos(MANAGER_DEFAULT_POS)}
                    className="w-full text-xs text-gray-500 hover:text-blue-600"
                  >
                    Сбросить позицию
                  </Button>
                )}
              </div>

              {/* Export */}
              <Button
                onClick={handleExportPDF}
                disabled={exporting || kpItems.length === 0}
                className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium"
                size="sm"
              >
                {exporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Формирование PDF...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" />Сформировать КП (PDF)</>
                )}
              </Button>
            </div>
          </div>
        </Panel>

      </PanelGroup>

      {/* Logo selection modal */}
      {showLogoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowLogoModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-sm font-semibold">Выбор логотипа</h3>
              <button onClick={() => setShowLogoModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Default logo option */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer mb-3 transition-colors ${
                  !logo.serverUrl && !logo.customUrl ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => { updateLogo({ serverUrl: undefined, logoFilename: undefined, customUrl: undefined }); setShowLogoModal(false) }}
              >
                <img src="/ui/big_logo.png" alt="Default" className="h-10 max-w-[100px] object-contain" />
                <span className="text-sm flex-1">По умолчанию</span>
                {!logo.serverUrl && !logo.customUrl && <Check className="h-4 w-4 text-blue-500" />}
              </div>

              {/* User logos */}
              {logosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : userLogos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Нет загруженных логотипов</p>
              ) : (
                <div className="space-y-2">
                  {userLogos.map((item) => (
                    <div
                      key={item.filename}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        logo.logoFilename === item.filename ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleSelectLogo(item)}
                    >
                      <img
                        src={getImageUrl(item.url)}
                        alt={item.filename}
                        className="h-10 max-w-[100px] object-contain bg-white"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className="text-xs text-gray-700 truncate flex-1">{item.filename}</span>
                      {logo.logoFilename === item.filename && <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteLogo(item.filename) }}
                        className="text-gray-300 hover:text-red-500 flex-shrink-0"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t flex gap-2">
              <input ref={logoUploadRef} type="file" accept="image/*" onChange={handleLogoUploadToServer} className="hidden" />
              <Button
                variant="outline" size="sm"
                onClick={() => logoUploadRef.current?.click()}
                disabled={logoUploading}
                className="flex-1 text-xs"
              >
                {logoUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                Загрузить новый
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLogoModal(false)} className="text-xs">
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
