'use client'

import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Trash2, Plus, Minus, FileText, Search, Upload, Type, X, Download, Loader2, History, ChevronDown, ChevronUp, ImageIcon, Check, Calculator, Save, LogOut, FileSignature, Share2, Filter, Users, User, Info, Building2, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { KpShareDialog } from '@/components/kp-share-dialog'
import { KpClientPickerDialog } from '@/components/kp-client-picker-dialog'
import { KpTemplateManagerDialog } from '@/components/kp-template-manager-dialog'
import { getKpShareTargets, type KpShareTarget } from '@/app/actions/kp-share'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { useKP, KPItem, KPColumnSettings, KPTextElement, KP_FONT_FAMILIES, DEFAULT_COLUMN_WIDTHS, DEFAULT_COLUMN_ALIGNS } from '@/context/kp-context'
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
  logos: { x: number; y: number; width: number; height: number }[],
  footerReserve: number,
  measuredHeights: number[],
  customSizes?: Record<string, number>,
): PageSlice[] {
  if (items.length === 0) return []

  // Реальная высота резерва под лого — максимум по эффективным высотам
  // (height или width*0.4 fallback) среди всех слотов. Раньше при single-logo
  // считалось от width, из-за чего тяга за правый край сдвигала таблицу.
  const maxLogoH = logos.length === 0
    ? 0
    : Math.max(...logos.map(l => l.height > 0 ? l.height : l.width * 0.4))
  const firstPageHeaderH = logos.length > 0 ? 60 + maxLogoH : 80
  // Колонтитул занимает место снизу на ВСЕХ страницах — таблица сжимается.
  const firstAvail = USABLE_HEIGHT - firstPageHeaderH - TABLE_HEADER_H - footerReserve
  const otherAvail = USABLE_HEIGHT - TABLE_HEADER_H - 16 - footerReserve

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

// ── Sortable wrapper для карточки товара ──
// `useSortable` даёт нам attributes/listeners для grip-handle и стиль для
// transform. Карточка сама внутри обрабатывает свои клики/инпуты; grip
// единственная зона которая инициирует drag.
function SortableKPProductCard({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.kpId })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <KPProductCard
        item={item}
        updateItem={updateItem}
        updateItemQuantity={updateItemQuantity}
        removeItem={removeItem}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  )
}

// ── Product card with description & characteristics ──
function KPProductCard({
  item,
  updateItem,
  updateItemQuantity,
  removeItem,
  dragHandleProps,
  isDragOverlay,
}: {
  item: KPItem
  updateItem: (kpId: string, updates: Partial<KPItem>) => void
  updateItemQuantity: (kpId: string, qty: number) => void
  removeItem: (kpId: string) => void
  // Из @dnd-kit/sortable приходят props для grip-кнопки. Опционально:
  // на A4-превью (если когда-то отрендерим этот же компонент) они не нужны.
  dragHandleProps?: { attributes?: React.HTMLAttributes<HTMLElement>; listeners?: any }
  isDragOverlay?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [charsExpanded, setCharsExpanded] = useState(false)
  const visibleChars = visibleCharacteristics(item.characteristics)
  const warehousePrices = item.warehousePrices || []
  const hasDescription = (item.description || '').trim().length > 0

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
    <Card className={`shadow-sm ${isDragOverlay ? 'ring-2 ring-yellow-400 shadow-lg rotate-1' : ''}`}>
      <CardContent className="p-2">
        {/* Header row — always visible: drag-handle, image, name, actions */}
        <div className="flex gap-1.5 items-center">
          {/* Grip-handle. Только она реагирует на drag — а не вся карточка,
              чтобы внутри можно было кликать кнопки/раскрывать секции без
              перетаскивания. */}
          <button
            {...(dragHandleProps?.attributes || {})}
            {...(dragHandleProps?.listeners || {})}
            type="button"
            className="h-7 w-5 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
            title="Перетащить для изменения порядка"
            aria-label="Перетащить"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <Link href={`/product/${item.slug}`} className="relative w-10 h-10 bg-white rounded overflow-hidden flex-shrink-0 border border-gray-100">
            {item.image_url ? (
              <Image src={getImageUrl(item.image_url)} alt={item.name} fill className="object-contain p-0.5" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400"><FileText className="h-3 w-3" /></div>
            )}
          </Link>
          <span className="text-xs font-medium text-gray-900 flex-1 min-w-0 line-clamp-2 leading-tight" title={item.name}>{item.name}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => removeItem(item.kpId)} className="h-6 w-6 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-md border border-red-200 bg-white transition-colors" title="Удалить из КП">
              <Trash2 className="h-3 w-3" />
            </button>
            <button onClick={() => setExpanded(!expanded)} className="h-6 w-6 flex items-center justify-center text-gray-700 hover:bg-yellow-50 rounded-md border border-yellow-400 bg-white transition-colors" title={expanded ? 'Свернуть' : 'Развернуть'}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Expanded body — name/warehouse/price/qty + collapsed sections */}
        {expanded && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
            {/* Name edit */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Название</label>
              <AutoTextarea
                value={item.name}
                onChange={(val) => updateItem(item.kpId, { name: val })}
                className="text-xs font-medium text-gray-900 w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-blue-400 rounded p-1.5 outline-none resize-none leading-tight mt-0.5"
              />
            </div>

            {/* Warehouse selector */}
            {warehousePrices.length > 0 && (
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Поставщик / склад</label>
                <select
                  value={item.selectedWarehouseId ? String(item.selectedWarehouseId) : ''}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  className="text-xs w-full bg-white border border-gray-200 focus:border-blue-400 rounded px-1.5 h-7 outline-none text-gray-700 mt-0.5"
                >
                  <option value="">Выбрать поставщика/склад…</option>
                  {warehousePrices.map((wp) => (
                    <option key={wp.warehouse_id} value={String(wp.warehouse_id)}>
                      {wp.supplier_name ? `${wp.supplier_name} — ` : ''}{wp.warehouse_name}: {formatProductPrice(wp.calculated_price || 0)} ₸
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Price + Qty — единый «строка-блок» с разделителем сверху */}
            <div className="flex items-center justify-between gap-2 px-1 py-1.5 bg-gray-50 rounded-md border border-gray-100">
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateItem(item.kpId, { price: parseFloat(e.target.value) || 0 })}
                  className="text-base font-bold text-gray-900 w-24 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-0.5 h-7 outline-none"
                />
                <span className="text-xs text-gray-500">₸</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => updateItemQuantity(item.kpId, item.quantity - 1)} disabled={item.quantity <= 1} className="w-6 h-6 rounded-full p-0 text-xs">
                  <Minus className="h-3 w-3" />
                </Button>
                <input
                  type="text"
                  value={item.quantity}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) updateItemQuantity(item.kpId, v) }}
                  className="w-9 text-center text-xs border border-gray-200 bg-white rounded h-6"
                />
                <Button variant="outline" size="sm" onClick={() => updateItemQuantity(item.kpId, item.quantity + 1)} className="w-6 h-6 rounded-full p-0 text-xs bg-yellow-400 hover:bg-yellow-500 border-yellow-400">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* ── Описание (collapsible) ── */}
            <div className="border border-gray-100 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setDescExpanded(!descExpanded)}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  Описание
                  {hasDescription && <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-yellow-100 text-yellow-800 text-[9px] font-bold">●</span>}
                </span>
                {descExpanded ? <ChevronUp className="h-3 w-3 text-gray-500" /> : <ChevronDown className="h-3 w-3 text-gray-500" />}
              </button>
              {descExpanded && (
                <div className="p-1.5 bg-white">
                  <AutoTextarea
                    value={item.description || ''}
                    onChange={(val) => updateItem(item.kpId, { description: val })}
                    placeholder="Описание товара…"
                    className="text-[11px] text-gray-700 w-full bg-gray-50 border border-gray-200 focus:border-blue-400 rounded p-1.5 resize-none leading-tight outline-none"
                  />
                </div>
              )}
            </div>

            {/* ── Характеристики (collapsible) ── */}
            <div className="border border-gray-100 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setCharsExpanded(!charsExpanded)}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  Характеристики
                  {visibleChars.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-yellow-100 text-yellow-800 text-[9px] font-bold">
                      {visibleChars.length}
                    </span>
                  )}
                </span>
                {charsExpanded ? <ChevronUp className="h-3 w-3 text-gray-500" /> : <ChevronDown className="h-3 w-3 text-gray-500" />}
              </button>
              {charsExpanded && (
                <div className="p-1.5 bg-white space-y-1">
                  <button
                    onClick={handleAddCharacteristic}
                    className="w-full text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center justify-center gap-0.5 py-1 border border-dashed border-blue-200 rounded transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5" /> Добавить характеристику
                  </button>
                  {visibleChars.map((ch, idx) => (
                    <div key={idx} className="flex items-center gap-1">
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
                    <p className="text-[10px] text-gray-400 text-center py-1">Нет характеристик</p>
                  )}
                </div>
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
    kpItems, kpCount, removeItem, updateItemQuantity, updateItem, reorderItems, clearAll,
    kpSettings, updateSettings, updateColumns, updateColumnWidth, updateColumnFontSize, updateColumnHeaderFontSize, updateColumnAlign, updateColumnHeaderAlign, addLogoSlot, updateLogoSlot, removeLogoSlot,
    addTextElement, updateTextElement, removeTextElement,
    updateFooter, addFooterTextElement, addFooterImageElement, updateFooterElement, removeFooterElement,
    kpHistory, historyLoading, activeHistoryId, fetchHistory, saveToHistory, loadFromHistory, deleteFromHistory,
    activeAccessLevel, isSuperAdmin, hasOtherVisible, historyFilter, setHistoryFilter,
    activeClient, setActiveClient,
  } = useKP()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLTableElement>(null)
  // DnD-сенсоры: pointer (с минимальной дистанцией чтобы не сбивать клики
  // по другим интерактивным элементам внутри карточки) + клавиатура.
  const kpDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const [scale, setScale] = useState(0.5)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [editingElement, setEditingElement] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)
  const [measuredHeights, setMeasuredHeights] = useState<number[]>([])
  const [exporting, setExporting] = useState(false)
  const [loadingHistoryId, setLoadingHistoryId] = useState<number | null>(null)
  const [newTextPage, setNewTextPage] = useState(0)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [savingKP, setSavingKP] = useState(false)
  // KP sharing UI
  const [shareDialog, setShareDialog] = useState<{ id: number; name: string } | null>(null)
  // Модалка адресной книги клиентов. activeClient (из контекста) живёт
  // независимо — она остаётся выбранной даже когда модалка закрыта.
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  // Локальный фильтр карточек по клиенту. "all" = не фильтруем, число = id
  // конкретного клиента. Применяется поверх historyFilter (mine/shared/all).
  const [clientFilter, setClientFilter] = useState<number | "all">("all")

  // Уникальные клиенты, которые встречаются в текущем списке КП. Строится из
  // денормализованного `entry.client` (бэк уже отдаёт его в short=True), без
  // отдельного запроса в /api/kp-clients. Список зависит от текущего фильтра
  // (mine/shared/all) — показываем только тех, кто реально виден.
  const clientOptions = useMemo(() => {
    const map = new Map<number, { id: number; display_name: string }>()
    for (const entry of kpHistory) {
      if (entry.client && !map.has(entry.client.id)) {
        map.set(entry.client.id, { id: entry.client.id, display_name: entry.client.display_name })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.display_name.localeCompare(b.display_name, 'ru'))
  }, [kpHistory])

  // Если выбранный клиент пропал из списка (после смены mine/shared/all
  // или удаления привязки) — сбрасываем фильтр в "all", чтобы юзер не
  // увидел пустые колонки и не путался.
  useEffect(() => {
    if (clientFilter !== "all" && !clientOptions.some((c) => c.id === clientFilter)) {
      setClientFilter("all")
    }
  }, [clientFilter, clientOptions])
  // Список системных пользователей для фильтра «По пользователю» (только super-admin)
  const [shareTargets, setShareTargets] = useState<KpShareTarget[]>([])
  // Подтверждение удаления карточки КП — без явной модалки можно случайно
  // снести подписанный контракт. Храним id+имя удаляемой записи.
  const [deletingKp, setDeletingKp] = useState<{ id: number; name: string } | null>(null)
  const [deletingInProgress, setDeletingInProgress] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoUploadRef = useRef<HTMLInputElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)

  // Logo gallery state. galleryTarget — кому передать выбранный файл:
  // {kind: 'logo', id} — слот лого; {kind: 'footer-image', id} — картинка
  // в колонтитуле. null = модалка закрыта. Унификация одной модалки
  // под обе сущности избавляет от дублирования UI.
  const [galleryTarget, setGalleryTarget] = useState<{ kind: 'logo' | 'footer-image'; id: string } | null>(null)
  const [userLogos, setUserLogos] = useState<Array<{ filename: string; url: string; size: number; uploaded_at: string }>>([])
  const [logosLoading, setLogosLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  const isSystemUser = user?.role === "admin" || user?.role === "system"

  useEffect(() => {
    if (user && !isSystemUser) router.push('/')
  }, [user, isSystemUser, router])

  // Список юзеров для фильтра «По пользователю» — нужен только super-admin'у.
  // Грузим один раз когда понимаем что юзер super-admin.
  useEffect(() => {
    if (!isSuperAdmin) return
    if (shareTargets.length > 0) return
    getKpShareTargets().then(setShareTargets)
  }, [isSuperAdmin, shareTargets.length])

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

    // Clamp Y по зоне. Для 'header' — верхняя часть страницы (0..220),
    // чтобы header-блоки физически не уехали ниже шапки. Для 'free' —
    // вся страница как и раньше.
    const isHeader = element.zone === 'header'
    const maxY = isHeader ? 220 : A4_HEIGHT - 30

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      updateTextElement(elementId, {
        x: Math.max(0, Math.min(A4_WIDTH - 100, startElX + dx)),
        y: Math.max(0, Math.min(maxY, startElY + dy)),
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

  // ── Logo slot drag/resize (multi-logo) ─────────
  // Позиции и размеры лого живут в kpSettings.logos[]. Драг/resize
  // апдейтят слот по id через updateLogoSlot из контекста — никакого
  // отдельного state'а тут больше не держим.
  const handleLogoSlotDragStart = useCallback((slotId: string, startSlot: { x: number; y: number }, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedElement(`logo:${slotId}`)
    const startX = e.clientX
    const startY = e.clientY
    const startLX = startSlot.x
    const startLY = startSlot.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      updateLogoSlot(slotId, {
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
  }, [scale, updateLogoSlot])

  const handleLogoSlotResizeStart = useCallback((slotId: string, startSlot: { width: number; height: number }, corner: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = startSlot.width
    const startHeight = startSlot.height || 0
    const imgEl = (e.target as HTMLElement).parentElement?.querySelector('img')
    const actualHeight = startHeight > 0 ? startHeight : (imgEl?.offsetHeight || 80)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      const signX = corner.includes('right') ? 1 : -1
      const signY = corner.includes('bottom') ? 1 : -1
      const newWidth = Math.max(30, Math.min(500, Math.round(startWidth + dx * signX)))
      const newHeight = Math.max(20, Math.min(400, Math.round(actualHeight + dy * signY)))
      updateLogoSlot(slotId, { width: newWidth, height: newHeight })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [scale, updateLogoSlot])

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
        // Авто-выбор сразу в цель модалки (логослот или картинка футера).
        if (galleryTarget?.kind === 'logo') {
          updateLogoSlot(galleryTarget.id, {
            serverUrl: data.logo.url,
            logoFilename: data.logo.filename,
            customUrl: undefined,
          })
        } else if (galleryTarget?.kind === 'footer-image') {
          updateFooterElement(galleryTarget.id, {
            serverUrl: data.logo.url,
            logoFilename: data.logo.filename,
            customUrl: undefined,
          })
        }
      }
    } catch (err) {
      console.error('Failed to upload logo:', err)
    } finally {
      setLogoUploading(false)
    }
  }, [galleryTarget, updateLogoSlot, updateFooterElement])

  const handleDeleteLogo = useCallback(async (filename: string) => {
    try {
      const resp = await fetch(`/api/kp-logos/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      const data = await resp.json()
      if (data.success) {
        setUserLogos(prev => prev.filter(l => l.filename !== filename))
        // Сбрасываем у всех слотов лого И картинок колонтитула.
        kpSettings.logos.forEach(slot => {
          if (slot.logoFilename === filename) {
            updateLogoSlot(slot.id, { serverUrl: undefined, logoFilename: undefined })
          }
        })
        kpSettings.footer.elements.forEach(el => {
          if (el.type === 'image' && el.logoFilename === filename) {
            updateFooterElement(el.id, { serverUrl: undefined, logoFilename: undefined })
          }
        })
      }
    } catch (err) {
      console.error('Failed to delete logo:', err)
    }
  }, [kpSettings.logos, kpSettings.footer.elements, updateLogoSlot, updateFooterElement])

  const handleSelectLogo = useCallback((logoItem: { filename: string; url: string }) => {
    if (!galleryTarget) return
    if (galleryTarget.kind === 'logo') {
      updateLogoSlot(galleryTarget.id, {
        serverUrl: logoItem.url,
        logoFilename: logoItem.filename,
        customUrl: undefined,
      })
    } else if (galleryTarget.kind === 'footer-image') {
      updateFooterElement(galleryTarget.id, {
        serverUrl: logoItem.url,
        logoFilename: logoItem.filename,
        customUrl: undefined,
      })
    }
    setGalleryTarget(null)
  }, [galleryTarget, updateLogoSlot, updateFooterElement])

  const handleOpenLogoModal = useCallback((slotId: string) => {
    setGalleryTarget({ kind: 'logo', id: slotId })
    fetchUserLogos()
  }, [fetchUserLogos])

  const handleOpenFooterImageGallery = useCallback((elementId: string) => {
    setGalleryTarget({ kind: 'footer-image', id: elementId })
    fetchUserLogos()
  }, [fetchUserLogos])

  const handleAddLogo = useCallback(() => {
    // Создаём слот и сразу открываем галерею для выбора файла.
    const newId = addLogoSlot()
    setGalleryTarget({ kind: 'logo', id: newId })
    fetchUserLogos()
  }, [addLogoSlot, fetchUserLogos])

  const handleAddFooterImage = useCallback(() => {
    const newId = addFooterImageElement()
    setGalleryTarget({ kind: 'footer-image', id: newId })
    fetchUserLogos()
  }, [addFooterImageElement, fetchUserLogos])

  // ── Footer element drag/resize (внутри bounding-box) ──
  const handleFooterElementDragStart = useCallback((elementId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedElement(`footer:${elementId}`)
    setDragging(`footer:${elementId}`)

    const startX = e.clientX
    const startY = e.clientY
    const el = kpSettings.footer.elements.find(x => x.id === elementId)
    if (!el) return
    const startElX = el.x
    const startElY = el.y
    const footerH = kpSettings.footer.height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      updateFooterElement(elementId, {
        x: Math.max(0, Math.min(A4_WIDTH - 60, startElX + dx)),
        y: Math.max(0, Math.min(footerH - 16, startElY + dy)),
      })
    }
    const handleMouseUp = () => {
      setDragging(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [kpSettings.footer.elements, kpSettings.footer.height, scale, updateFooterElement])

  const handleFooterImageResizeStart = useCallback((elementId: string, startSize: { width: number; height: number }, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = startSize.width
    const startHeight = startSize.height || 0
    const imgEl = (e.target as HTMLElement).parentElement?.querySelector('img')
    const actualHeight = startHeight > 0 ? startHeight : (imgEl?.offsetHeight || 30)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      const newWidth = Math.max(20, Math.min(400, Math.round(startWidth + dx)))
      const newHeight = Math.max(16, Math.min(300, Math.round(actualHeight + dy)))
      updateFooterElement(elementId, { width: newWidth, height: newHeight })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [scale, updateFooterElement])

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

      // Автосохранение в историю (с позициями). logoPos больше не
      // нужен — позиции лежат в kpSettings.logos[].
      saveToHistory({ managerPos })
    } catch (err) {
      console.error('PDF export error:', err)
      // Restore scale on error
      if (pagesRef.current) {
        pagesRef.current.style.transform = `scale(${scale})`
      }
    } finally {
      setExporting(false)
    }
  }, [exporting, scale, kpSettings.kpName, selectedElement, saveToHistory, managerPos])

  // ── Guard ─────────────────────────────────────
  if (!isSystemUser) return null

  // ── Derived data ──────────────────────────────
  const totalAmount = kpItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const { columns, columnWidths, columnFontSizes, columnHeaderFontSizes, columnAligns, columnHeaderAligns, mergeImageName, managerAlign, logos, textElements, footer, kpName, title, footerNote } = kpSettings
  // Резолвер src для одного слота. Если файла нет — placeholder.
  const resolveLogoSrc = (slot: { serverUrl?: string; customUrl?: string }) =>
    slot.serverUrl ? getImageUrl(slot.serverUrl) : (slot.customUrl || "/ui/big_logo.png")

  // Visible columns
  const visibleCols = ALL_COLUMNS.filter(col => {
    // When merged, hide separate image column — name becomes "Товар" with embedded image
    if (mergeImageName && col.key === 'image') return false
    if (col.key === 'name') return true
    return columns[col.key as keyof KPColumnSettings]
  })

  // Build pages using measured heights
  const footerReserve = footer.enabled ? footer.height : 0
  const pages = buildPages(kpItems, columns, columnWidths, logos, footerReserve, measuredHeights, columnFontSizes)
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
    // Применяем клиентский фильтр поверх — он чисто на стороне клиента, без
    // запроса на бэк (данные уже в kpHistory с денормализованным client).
    const filteredHistory = clientFilter === "all"
      ? kpHistory
      : kpHistory.filter((e) => e.client_id === clientFilter)
    const savedKps = filteredHistory.filter(e => !e.signed_at)
    const signedKps = filteredHistory.filter(e => !!e.signed_at)
    const hasAnyHistory = kpHistory.length > 0

    const renderEntry = (entry: typeof kpHistory[number], isSigned: boolean) => {
      // Я владелец КП если backend вернул user_id == моего id (или поле не
      // заполнено — старый формат, считаем что моё). access_level отдаётся
      // бэком, для своих он 'owner'.
      const isMine = !entry.user_id || entry.user_id === user?.id
      const isView = entry.access_level === "view"
      const sharedByName = entry.shared_by?.full_name || entry.shared_by?.email
      // Объёмная карточка: чёткая рамка + лёгкая тень + сильнее на hover.
      // Цветовая палитра разная для подписанных и сохранённых, но шейдоу
      // одинаковый — карточки должны выглядеть как одна сетка.
      const cardClass = isSigned
        ? "bg-green-50 border-green-300 hover:border-green-500 hover:bg-green-100"
        : "bg-yellow-50 border-yellow-300 hover:border-yellow-500 hover:bg-yellow-100"
      return (
        <div
          key={entry.id}
          className={
            "flex items-center justify-between p-4 rounded-xl border-2 transition-all " +
            "shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.14)] " +
            cardClass
          }
        >
          <button
            className="flex-1 text-left min-w-0 text-black"
            disabled={loadingHistoryId === entry.id}
            onClick={async () => {
              setLoadingHistoryId(entry.id)
              const result = await loadFromHistory(entry.id)
              // Legacy logoPos из старых КП → первый слот лого.
              if (result.positions?.logoPos && kpSettings.logos[0]) {
                updateLogoSlot(kpSettings.logos[0].id, {
                  x: result.positions.logoPos.x,
                  y: result.positions.logoPos.y,
                })
              }
              if (result.positions?.managerPos) setManagerPos(result.positions.managerPos)
              setLoadingHistoryId(null)
            }}
          >
            <div className="font-medium truncate flex items-center gap-1.5 flex-wrap">
              {entry.name}
              {isSigned && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-200 text-green-900 border border-green-300">
                  Подписан
                </span>
              )}
              {!isMine && sharedByName && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200"
                  title={`Поделено · от ${sharedByName}`}
                >
                  <Users className="h-2.5 w-2.5" />
                  от {sharedByName}
                </span>
              )}
              {!isMine && isView && (
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  только просмотр
                </span>
              )}
            </div>
            <div className="text-sm text-gray-700 flex items-center gap-3 mt-0.5">
              <span>{new Date(entry.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="font-medium">{entry.total_amount.toLocaleString()} тг</span>
            </div>
            {/* Денормализованное имя клиента из бэка (short=True). Длинные
                имена/объекты занимают всю ширину. */}
            {entry.client && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-gray-700 bg-white/70 border border-gray-200 rounded-full px-2 py-0.5 max-w-full">
                <User className="h-3 w-3 shrink-0 text-gray-500" />
                <span className="truncate">{entry.client.display_name}</span>
              </div>
            )}
          </button>

          <div className="ml-3 shrink-0 flex items-center gap-2">
            {loadingHistoryId === entry.id && (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            )}
            {/* Кнопки всегда видимы (без opacity-0/group-hover), увеличены —
                клик попадает легче, юзер сразу видит что доступно. */}
            {(isMine || isSuperAdmin) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShareDialog({ id: entry.id, name: entry.name })
                }}
                className="h-9 w-9 rounded-full bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 transition-colors flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                title="Поделиться"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
            {isMine && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeletingKp({ id: entry.id, name: entry.name })
                }}
                className="h-9 w-9 rounded-full bg-white border border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                title="Удалить из истории"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )
    }

    // Текущий выбор фильтра как строка для Select. Для kind='user' кодируем
    // как `user:<id>` — иначе один Select не покрывает оба случая.
    const filterValue =
      historyFilter.kind === "mine" ? "mine" :
      historyFilter.kind === "shared" ? "shared" :
      historyFilter.kind === "all" ? "all" :
      `user:${historyFilter.userId}`

    // Большая «Список КП пуст» карточка появляется только когда юзер
    // на default-фильтре и у него нет НИЧЕГО — ни своих КП, ни доступных
    // через шаринг/super-admin. Если хоть что-то есть (например ему
    // что-то расшарили) — показываем колонки и фильтр, чтобы он мог
    // переключиться на «Только расшаренные» и увидеть документы.
    //
    // Дополнительно: пока историю догружаем (после смены фильтра) — НЕ
    // показываем онбординг, иначе видно мерцание «карточка/колонки/карточка»
    // при каждом переключении (kpHistory кратко становится пустым между
    // setHistoryFilter и завершением fetch'а).
    const showEmptyOnboarding =
      !hasAnyHistory &&
      historyFilter.kind === "mine" &&
      !hasOtherVisible &&
      !historyLoading
    const showHeaderControls = !showEmptyOnboarding

    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Коммерческое предложение</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Фильтр истории — Только мои / Только расшаренные / По пользователю.
                Последний пункт виден только super-admin'ам. */}
            {showHeaderControls && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select
                  value={filterValue}
                  onValueChange={(v) => {
                    if (v === "mine") setHistoryFilter({ kind: "mine" })
                    else if (v === "shared") setHistoryFilter({ kind: "shared" })
                    else if (v === "all") setHistoryFilter({ kind: "all" })
                    else if (v.startsWith("user:")) {
                      const uid = parseInt(v.slice(5), 10)
                      if (Number.isFinite(uid)) setHistoryFilter({ kind: "user", userId: uid })
                    }
                  }}
                >
                  <SelectTrigger className="w-[240px] rounded-full focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mine">Только мои</SelectItem>
                    <SelectItem value="shared">Только расшаренные</SelectItem>
                    {/* «Все документы» и «По пользователю» — привилегия
                        super-admin'а: видит всё, что есть в системе. */}
                    {isSuperAdmin && (
                      <SelectItem value="all">Все документы</SelectItem>
                    )}
                    {isSuperAdmin && shareTargets.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-gray-400">
                          По пользователю
                        </div>
                        {shareTargets.map((u) => (
                          <SelectItem key={u.id} value={`user:${u.id}`}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {/* Фильтр по клиенту. Опции строятся из текущей выборки kpHistory
                    (с учётом mine/shared/all), поэтому всегда консистентны.
                    Прячем целиком если ни одна карточка не привязана к клиенту. */}
                {clientOptions.length > 0 && (
                  <Select
                    value={clientFilter === "all" ? "all" : `client:${clientFilter}`}
                    onValueChange={(v) => {
                      if (v === "all") setClientFilter("all")
                      else if (v.startsWith("client:")) {
                        const cid = parseInt(v.slice(7), 10)
                        if (Number.isFinite(cid)) setClientFilter(cid)
                      }
                    }}
                  >
                    <SelectTrigger className="w-[260px] rounded-full focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                      <SelectValue placeholder="Все клиенты" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все клиенты</SelectItem>
                      <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-gray-400">
                        Клиенты
                      </div>
                      {clientOptions.map((c) => (
                        <SelectItem key={c.id} value={`client:${c.id}`}>
                          {c.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Большая «онбординг»-карточка ТОЛЬКО когда юзер на default-фильтре
            и его собственная история пуста. Пустой результат под другими
            фильтрами не считается — там просто покажем колонки. */}
        {showEmptyOnboarding && (
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

        {/* Панель управления шаблонами — НАД колонками. Шаблоны это
            «фирменный бланк» (настройки правой панели редактора КП),
            общий пул на всех системных юзеров: один менеджер настроил
            шапку/лого/колонтитул — другие импортируют одним кликом. */}
        {!showEmptyOnboarding && (
          <Card className="mb-6 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">Шаблоны КП</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Общая библиотека «фирменных бланков» — настроек логотипа, колонтитула,
                      колонок и текстов шапки. Один менеджер создаёт шаблон, остальные
                      импортируют его в свои настройки одним кликом.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setTemplateManagerOpen(true)}
                  className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Открыть
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Две колонки: жёлтые сохранённые + зелёные подписанные. Показываем
            всегда кроме первого онбординг-экрана. Если конкретный фильтр
            ничего не нашёл — колонки покажут свой собственный empty-state
            («Сохранённых КП пока нет» / «Подписанных контрактов нет»). */}
        {!showEmptyOnboarding && (
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

        {/* Модалка шаринга — открывается с любой карточки. После закрытия
            обновим историю чтобы новый шар был учтён в видимости (не критично
            для текущего юзера, но если изменили чужой — пригодится). */}
        {shareDialog && (
          <KpShareDialog
            open={!!shareDialog}
            onOpenChange={(o) => {
              if (!o) {
                setShareDialog(null)
                fetchHistory()
              }
            }}
            kpId={shareDialog.id}
            kpName={shareDialog.name}
          />
        )}

        {/* Подтверждение удаления — раньше клик по корзине удалял мгновенно,
            что страшно особенно для подписанных контрактов. Теперь два шага. */}
        <DeleteConfirmationDialog
          open={!!deletingKp}
          onOpenChange={(o) => { if (!o && !deletingInProgress) setDeletingKp(null) }}
          onConfirm={async () => {
            if (!deletingKp) return
            setDeletingInProgress(true)
            try {
              await deleteFromHistory(deletingKp.id)
            } finally {
              setDeletingInProgress(false)
              setDeletingKp(null)
            }
          }}
          title={`Удалить КП «${deletingKp?.name}»?`}
          description="Запись будет полностью удалена из истории. Действие необратимо. Все доступы, выданные другим пользователям, тоже пропадут."
        />

        {/* Шаблоны КП — модалка вызывается из синей панели над колонками.
            Должна жить в этом же return, иначе onClick «Открыть» не покажет
            ничего (диалог в основном редакторе не монтируется при пустом КП).
            source='list' — создание шаблона требует явного выбора одного из
            сохранённых КП как источника настроек (потому что юзер сейчас
            ничего не редактирует, у него только список). */}
        <KpTemplateManagerDialog
          open={templateManagerOpen}
          onOpenChange={setTemplateManagerOpen}
          source="list"
          currentSettings={kpSettings}
          historyEntries={kpHistory.map(e => ({ id: e.id, name: e.name }))}
          onFetchHistorySettings={async (id) => {
            try {
              const resp = await fetch(`/api/kp-history/${id}`)
              const data = await resp.json()
              if (data?.success && data?.data?.settings && typeof data.data.settings === 'object') {
                return data.data.settings as Record<string, any>
              }
              return null
            } catch {
              return null
            }
          }}
          onApply={(settings) => {
            const { kpName: _ignored, ...rest } = settings || {}
            updateSettings(rest)
          }}
        />
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

          {/* Применить шаблон к текущему КП. Открывает общую модалку —
              там же управление шаблонами. Право редактирования настроек
              ровно как у «Сохранить КП», поэтому при view-доступе кнопку
              прячем (применение бы перезаписало чужие настройки). */}
          {activeAccessLevel !== "view" && (
            <button
              onClick={() => setTemplateManagerOpen(true)}
              className="ml-3 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-black bg-white border border-blue-400 hover:bg-blue-50 rounded-full transition-colors [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]"
              title="Применить шаблон к этому КП или открыть управление шаблонами"
            >
              <FileText className="h-4 w-4 text-blue-600" />
              Шаблон
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Правая часть: Корп. расчётник + Сохранить + Выйти */}
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

          {/* «Сохранить КП» прячем при view-доступе — у юзера нет права
              писать. Также показываем заметную плашку «Только просмотр» —
              менеджер сразу понимает что это чужое КП. */}
          {kpCount > 0 && activeAccessLevel === "view" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-300">
              <Users className="h-4 w-4" />
              Только просмотр
            </span>
          )}

          {kpCount > 0 && activeAccessLevel !== "view" && (
            <Button
              variant="outline"
              size="sm"
              disabled={savingKP}
              onClick={async () => {
                setSavingKP(true)
                try {
                  const ok = await saveToHistory({ managerPos })
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

          {/* «Выйти» очищает текущее КП и возвращает к списку истории.
              Если есть несохранённые изменения (КП ни разу не сохраняли в
              историю) — спрашиваем подтверждение, чтобы не потерять работу. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (kpCount > 0 && !activeHistoryId) {
                setShowExitConfirm(true)
              } else {
                clearAll()
              }
            }}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full text-sm [box-shadow:2px_3px_6px_rgba(0,0,0,0.15)]"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Выйти
          </Button>
        </div>
      </div>

      {/* Exit confirmation — показывается только когда есть несохранённое КП.
          После подтверждения корзина очищается, и страница автоматически
          рендерит экран с двумя колонками истории (kpItems.length === 0). */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowExitConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-96 p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2">Выйти без сохранения?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Текущее КП ещё не сохранено. Все товары и настройки будут потеряны —
              их придётся собирать заново. Если хотите сохранить, нажмите «Отмена»
              и затем «Сохранить КП».
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" size="sm" onClick={() => setShowExitConfirm(false)} className="rounded-full px-5">
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={() => { clearAll(); setShowExitConfirm(false) }}
                className="rounded-full px-5 bg-red-500 hover:bg-red-600 text-white"
              >
                Выйти без сохранения
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
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-gray-600">Товары в КП</h2>
                {kpItems.length > 1 && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1" title="Перетащите за иконку слева для изменения порядка">
                    <GripVertical className="h-3 w-3" />
                    переставить
                  </span>
                )}
              </div>
              <DndContext
                sensors={kpDndSensors}
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event
                  if (!over || active.id === over.id) return
                  const oldIndex = kpItems.findIndex((it) => it.kpId === active.id)
                  const newIndex = kpItems.findIndex((it) => it.kpId === over.id)
                  if (oldIndex < 0 || newIndex < 0) return
                  reorderItems(oldIndex, newIndex)
                }}
              >
                <SortableContext items={kpItems.map((it) => it.kpId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {kpItems.map((item) => (
                      <SortableKPProductCard
                        key={item.kpId}
                        item={item}
                        updateItem={updateItem}
                        updateItemQuantity={updateItemQuantity}
                        removeItem={removeItem}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
                              style={{
                                fontSize: 20,
                                fontWeight: 'bold',
                                textAlign: 'center',
                                marginBottom: 24,
                                marginTop: logos.length > 0
                                  ? Math.max(...logos.map(l => l.height > 0 ? l.height : l.width * 0.4))
                                  : 0,
                              }}
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

                      {/* Draggable logo slots — first page */}
                      {page.isFirst && logos.map((slot) => {
                        const isSel = selectedElement === `logo:${slot.id}`
                        return (
                          <div
                            key={slot.id}
                            style={{
                              position: 'absolute',
                              left: slot.x,
                              top: slot.y,
                              cursor: dragging === `logo:${slot.id}` ? 'grabbing' : 'grab',
                              outline: isSel ? '2px solid #3b82f6' : 'none',
                              outlineOffset: 4,
                              zIndex: 10,
                            }}
                            onMouseDown={(e) => handleLogoSlotDragStart(slot.id, { x: slot.x, y: slot.y }, e)}
                            onClick={(e) => { e.stopPropagation(); setSelectedElement(`logo:${slot.id}`) }}
                          >
                            <img
                              src={resolveLogoSrc(slot)}
                              alt="Logo"
                              style={{ width: slot.width, height: slot.height > 0 ? slot.height : 'auto' }}
                              draggable={false}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            {isSel && (
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
                                onMouseDown={(e) => handleLogoSlotResizeStart(slot.id, { width: slot.width, height: slot.height }, 'bottom-right', e)}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M1 9L9 1M9 1H3M9 1V7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Draggable text elements. На каждой странице рендерим:
                          - zone='header' — только на первой странице (page игнорируется)
                          - zone='free'   — по polю el.page (как раньше)
                          - zone='footer' — не рендерим тут, появится с этапом колонтитула */}
                      {textElements.filter(el => {
                        if (el.zone === 'header') return page.isFirst
                        if (el.zone === 'footer') return false
                        return (el.page ?? 0) === pageIdx
                      }).map((el) => (
                        <div
                          key={el.id}
                          style={{
                            position: 'absolute',
                            left: el.x,
                            top: el.y,
                            fontSize: el.fontSize,
                            fontWeight: el.fontWeight,
                            textAlign: el.textAlign,
                            fontFamily: el.fontFamily || 'Inter',
                            lineHeight: el.lineHeight || 1.4,
                            whiteSpace: 'pre-wrap',
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
                            <textarea
                              autoFocus
                              defaultValue={el.text}
                              onBlur={(e) => handleBlur(el.id, e.currentTarget.value)}
                              onKeyDown={(e) => {
                                // Escape — отмена редактирования. Enter оставляем как перенос строки.
                                if (e.key === 'Escape') { (e.target as HTMLTextAreaElement).blur() }
                              }}
                              className="outline-none border-b-2 border-blue-400 bg-transparent resize-none"
                              style={{
                                fontSize: el.fontSize,
                                fontWeight: el.fontWeight,
                                fontFamily: el.fontFamily || 'Inter',
                                lineHeight: el.lineHeight || 1.4,
                                textAlign: el.textAlign,
                                minWidth: 200,
                                minHeight: 60,
                                width: '100%',
                              }}
                            />
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

                      {/* Running footer (колонтитул) — на всех страницах */}
                      {footer.enabled && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: footer.height,
                            borderTop: '1px dashed #d1d5db',
                            background: 'rgba(249, 250, 251, 0.5)',
                            overflow: 'hidden',
                          }}
                        >
                          {footer.elements.map((el) => {
                            const isSel = selectedElement === `footer:${el.id}`
                            if (el.type === 'text') {
                              return (
                                <div
                                  key={el.id}
                                  style={{
                                    position: 'absolute',
                                    left: el.x,
                                    top: el.y,
                                    fontSize: el.fontSize,
                                    fontWeight: el.fontWeight,
                                    textAlign: el.textAlign,
                                    fontFamily: el.fontFamily || 'Inter',
                                    lineHeight: el.lineHeight || 1.3,
                                    whiteSpace: 'pre-wrap',
                                    cursor: dragging === `footer:${el.id}` ? 'grabbing' : 'grab',
                                    outline: isSel ? '2px solid #3b82f6' : '1px dashed transparent',
                                    outlineOffset: 2,
                                    padding: '1px 3px',
                                    zIndex: isSel ? 20 : 5,
                                    userSelect: 'none',
                                    maxWidth: A4_WIDTH - 16,
                                  }}
                                  onMouseDown={(e) => handleFooterElementDragStart(el.id, e)}
                                  onClick={(e) => { e.stopPropagation(); setSelectedElement(`footer:${el.id}`) }}
                                >
                                  {el.text}
                                </div>
                              )
                            }
                            // image
                            const imgSrc = el.serverUrl ? getImageUrl(el.serverUrl) : (el.customUrl || '/ui/big_logo.png')
                            return (
                              <div
                                key={el.id}
                                style={{
                                  position: 'absolute',
                                  left: el.x,
                                  top: el.y,
                                  cursor: dragging === `footer:${el.id}` ? 'grabbing' : 'grab',
                                  outline: isSel ? '2px solid #3b82f6' : 'none',
                                  outlineOffset: 2,
                                  zIndex: isSel ? 20 : 5,
                                }}
                                onMouseDown={(e) => handleFooterElementDragStart(el.id, e)}
                                onClick={(e) => { e.stopPropagation(); setSelectedElement(`footer:${el.id}`) }}
                              >
                                <img
                                  src={imgSrc}
                                  alt="footer img"
                                  style={{ width: el.width, height: el.height > 0 ? el.height : 'auto' }}
                                  draggable={false}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                                {isSel && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      width: 16,
                                      height: 16,
                                      background: '#3b82f6',
                                      border: '2px solid white',
                                      borderRadius: '50%',
                                      bottom: -8,
                                      right: -8,
                                      cursor: 'nwse-resize',
                                      zIndex: 20,
                                    }}
                                    onMouseDown={(e) => handleFooterImageResizeStart(el.id, { width: el.width, height: el.height }, e)}
                                  />
                                )}
                              </div>
                            )
                          })}
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

              {/* Client (адресная книга) */}
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Клиент</Label>
                {!activeClient ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setClientPickerOpen(true)}
                    className="mt-1 w-full justify-start gap-2 text-sm font-normal"
                  >
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    Выбрать клиента
                  </Button>
                ) : (
                  <div className="mt-1 flex items-center gap-1.5 p-2 border border-yellow-200 bg-yellow-50 rounded-md">
                    <User className="h-4 w-4 text-yellow-700 shrink-0" />
                    <button
                      type="button"
                      onClick={() => setClientPickerOpen(true)}
                      className="flex-1 text-left text-sm font-medium text-gray-900 truncate hover:underline"
                      title="Изменить клиента"
                    >
                      {activeClient.display_name}
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-gray-500 hover:text-gray-900">
                          <Info className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3 space-y-1.5 text-xs" align="end">
                        <div className="font-semibold text-sm text-gray-900 pb-1.5 border-b">
                          {activeClient.display_name}
                        </div>
                        {activeClient.full_name && (
                          <div className="flex justify-between gap-2">
                            <span className="text-gray-500">ФИО:</span>
                            <span className="font-medium text-gray-800 text-right">{activeClient.full_name}</span>
                          </div>
                        )}
                        {activeClient.object && (
                          <div className="pt-1.5 border-t">
                            <div className="text-gray-500 mb-0.5">Объект:</div>
                            <div className="text-gray-700 whitespace-pre-wrap">{activeClient.object}</div>
                          </div>
                        )}
                        {activeClient.contacts && activeClient.contacts.length > 0 && (
                          <div className="pt-1.5 border-t space-y-1">
                            <div className="text-gray-500">Контакты:</div>
                            {activeClient.contacts.map((ct, i) => (
                              <div key={i} className="flex justify-between gap-2">
                                <span className="font-medium text-gray-800">{ct.phone}</span>
                                {ct.note && (
                                  <span className="text-gray-500 text-right truncate">{ct.note}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveClient(null)}
                      className="h-6 w-6 shrink-0 text-gray-400 hover:text-red-600"
                      title="Убрать клиента"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
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

              {/* Logos (multi-slot) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Логотипы</Label>
                  <span className="text-[10px] text-gray-400">{logos.length} шт</span>
                </div>

                {logos.length === 0 && (
                  <p className="text-[11px] text-gray-400">
                    Нет добавленных логотипов. Нажмите «+ Добавить лого» — слот появится в шапке первой страницы, его можно перетащить и изменить размер.
                  </p>
                )}

                {logos.map((slot, idx) => {
                  const isSel = selectedElement === `logo:${slot.id}`
                  return (
                    <div
                      key={slot.id}
                      className={`p-2 rounded border space-y-2 ${isSel ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
                      onClick={() => setSelectedElement(`logo:${slot.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={resolveLogoSrc(slot)}
                          alt="Logo"
                          className="h-8 max-w-[80px] object-contain bg-white rounded border border-gray-200"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/ui/big_logo.png' }}
                        />
                        <span className="text-[10px] text-gray-500 truncate flex-1">
                          #{idx + 1} {slot.logoFilename || (slot.customUrl ? 'Загруженный' : 'По умолчанию')}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeLogoSlot(slot.id) }}
                          className="text-gray-300 hover:text-red-500 flex-shrink-0"
                          title="Удалить слот"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <Button
                        variant="outline" size="sm"
                        onClick={(e) => { e.stopPropagation(); handleOpenLogoModal(slot.id) }}
                        className="w-full text-xs h-7"
                      >
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Выбрать файл
                      </Button>

                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-12 flex-shrink-0">Ширина</Label>
                        <Slider
                          value={[slot.width]}
                          onValueChange={([v]) => updateLogoSlot(slot.id, { width: v })}
                          min={30}
                          max={500}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-[10px] text-gray-500 w-8 text-right">{slot.width}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-12 flex-shrink-0">Высота</Label>
                        <Slider
                          value={[slot.height || 0]}
                          onValueChange={([v]) => updateLogoSlot(slot.id, { height: v })}
                          min={0}
                          max={400}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-[10px] text-gray-500 w-8 text-right">{slot.height || 'авто'}</span>
                      </div>
                    </div>
                  )
                })}

                <Button variant="outline" size="sm" onClick={handleAddLogo} className="w-full text-xs">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  + Добавить лого
                </Button>
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

              {/* Text elements — три зоны (header / footer / free) */}
              {(() => {
                // Локальный рендер карточки настроек одного текст-элемента.
                // Вынесен внутрь IIFE чтобы переиспользовать между секциями
                // без дублирования JSX.
                const renderTextCard = (el: KPTextElement) => (
                  <Card key={el.id} className={`shadow-sm ${selectedElement === el.id ? 'ring-2 ring-blue-400' : ''}`}>
                    <CardContent className="p-2 space-y-1.5">
                      <div className="flex items-start gap-1">
                        <Type className="h-3 w-3 text-gray-400 flex-shrink-0 mt-2" />
                        <textarea
                          value={el.text}
                          onChange={(e) => updateTextElement(el.id, { text: e.target.value })}
                          className="text-xs flex-1 min-h-[40px] resize-y rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:ring-0"
                          placeholder="Текст… (поддерживает переносы строк)"
                          rows={2}
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeTextElement(el.id)} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 mt-1">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-[10px] text-gray-400 mb-0.5 block">Размер</Label>
                          <Input
                            type="number" min={8} max={48} value={el.fontSize}
                            onChange={(e) => updateTextElement(el.id, { fontSize: parseInt(e.target.value) || 14 })}
                            className="text-xs h-7 w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-gray-400 mb-0.5 block">Жирность</Label>
                          <Select value={el.fontWeight} onValueChange={(v) => updateTextElement(el.id, { fontWeight: v as 'normal' | 'bold' })}>
                            <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Обычный</SelectItem>
                              <SelectItem value="bold">Жирный</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-[10px] text-gray-400 mb-0.5 block">Шрифт</Label>
                          <Select value={el.fontFamily || 'Inter'} onValueChange={(v) => updateTextElement(el.id, { fontFamily: v })}>
                            <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {KP_FONT_FAMILIES.map(f => (
                                <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-gray-400 mb-0.5 block">Межстрочный</Label>
                          <Input
                            type="number" min={1} max={3} step={0.1} value={el.lineHeight ?? 1.4}
                            onChange={(e) => updateTextElement(el.id, { lineHeight: parseFloat(e.target.value) || 1.4 })}
                            className="text-xs h-7 w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-[10px] text-gray-400 mb-0.5 block">Выравнивание</Label>
                          <Select value={el.textAlign} onValueChange={(v) => updateTextElement(el.id, { textAlign: v as 'left' | 'center' | 'right' })}>
                            <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">Слева</SelectItem>
                              <SelectItem value="center">По центру</SelectItem>
                              <SelectItem value="right">Справа</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {el.zone === 'free' && pages.length > 1 && (
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
                )

                const headerEls = textElements.filter(el => el.zone === 'header')
                const freeEls = textElements.filter(el => el.zone === 'free' || !el.zone)

                return (
                  <>
                    {/* Шапка */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Текст в шапке</Label>
                        <Button variant="outline" size="sm" onClick={() => addTextElement(undefined, 0, 'header')} className="h-7 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Добавить
                        </Button>
                      </div>
                      {headerEls.length === 0 && (
                        <p className="text-[11px] text-gray-400">Нет блоков. Нажмите «Добавить» — блок появится в шапке первой страницы.</p>
                      )}
                      {headerEls.map(renderTextCard)}
                    </div>

                    {/* Свободные блоки */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Свободные блоки</Label>
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
                          <Button variant="outline" size="sm" onClick={() => addTextElement(undefined, newTextPage, 'free')} className="h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" />
                            Добавить
                          </Button>
                        </div>
                      </div>
                      {freeEls.length === 0 && (
                        <p className="text-[11px] text-gray-400">Нет блоков. «Свободный» текст можно перетаскивать по всей странице.</p>
                      )}
                      {freeEls.map(renderTextCard)}
                    </div>
                  </>
                )
              })()}

              {/* Колонтитул */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Колонтитул</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="footer-enabled"
                      checked={footer.enabled}
                      onCheckedChange={(checked) => updateFooter({ enabled: !!checked })}
                    />
                    <label htmlFor="footer-enabled" className="text-xs cursor-pointer">Показывать</label>
                  </div>
                </div>

                {footer.enabled && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] w-16 flex-shrink-0">Высота</Label>
                      <Slider
                        value={[footer.height]}
                        onValueChange={([v]) => updateFooter({ height: v })}
                        min={30}
                        max={300}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-[10px] text-gray-500 w-10 text-right">{footer.height}px</span>
                    </div>

                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => addFooterTextElement()} className="flex-1 h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Текст
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleAddFooterImage} className="flex-1 h-7 text-xs">
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Картинка
                      </Button>
                    </div>

                    {footer.elements.length === 0 && (
                      <p className="text-[11px] text-gray-400">Нет элементов. Добавьте текст или картинку — они появятся в колонтитуле на каждой странице.</p>
                    )}

                    {footer.elements.map((el) => {
                      const isSel = selectedElement === `footer:${el.id}`
                      if (el.type === 'text') {
                        return (
                          <Card key={el.id} className={`shadow-sm ${isSel ? 'ring-2 ring-blue-400' : ''}`}>
                            <CardContent className="p-2 space-y-1.5">
                              <div className="flex items-start gap-1">
                                <Type className="h-3 w-3 text-gray-400 flex-shrink-0 mt-2" />
                                <textarea
                                  value={el.text}
                                  onChange={(e) => updateFooterElement(el.id, { text: e.target.value })}
                                  className="text-xs flex-1 min-h-[36px] resize-y rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:ring-0"
                                  placeholder="Текст колонтитула…"
                                  rows={2}
                                />
                                <Button variant="ghost" size="sm" onClick={() => removeFooterElement(el.id)} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 mt-1">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <Label className="text-[10px] text-gray-400 mb-0.5 block">Размер</Label>
                                  <Input
                                    type="number" min={6} max={36} value={el.fontSize}
                                    onChange={(e) => updateFooterElement(el.id, { fontSize: parseInt(e.target.value) || 10 })}
                                    className="text-xs h-7 w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400 mb-0.5 block">Жирность</Label>
                                  <Select value={el.fontWeight} onValueChange={(v) => updateFooterElement(el.id, { fontWeight: v as 'normal' | 'bold' })}>
                                    <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="normal">Обычный</SelectItem>
                                      <SelectItem value="bold">Жирный</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <Label className="text-[10px] text-gray-400 mb-0.5 block">Шрифт</Label>
                                  <Select value={el.fontFamily || 'Inter'} onValueChange={(v) => updateFooterElement(el.id, { fontFamily: v })}>
                                    <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {KP_FONT_FAMILIES.map(f => (
                                        <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400 mb-0.5 block">Выравнивание</Label>
                                  <Select value={el.textAlign} onValueChange={(v) => updateFooterElement(el.id, { textAlign: v as 'left' | 'center' | 'right' })}>
                                    <SelectTrigger className="h-7 text-xs w-full focus:ring-0 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Слева</SelectItem>
                                      <SelectItem value="center">По центру</SelectItem>
                                      <SelectItem value="right">Справа</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      }
                      // image card
                      const imgSrc = el.serverUrl ? getImageUrl(el.serverUrl) : (el.customUrl || '/ui/big_logo.png')
                      return (
                        <Card key={el.id} className={`shadow-sm ${isSel ? 'ring-2 ring-blue-400' : ''}`}>
                          <CardContent className="p-2 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <img
                                src={imgSrc}
                                alt="footer img"
                                className="h-8 max-w-[80px] object-contain bg-white rounded border border-gray-200"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/ui/big_logo.png' }}
                              />
                              <span className="text-[10px] text-gray-500 truncate flex-1">
                                {el.logoFilename || (el.customUrl ? 'Загруженный' : 'Не выбран')}
                              </span>
                              <Button variant="ghost" size="sm" onClick={() => removeFooterElement(el.id)} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleOpenFooterImageGallery(el.id)}
                              className="w-full text-xs h-7"
                            >
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Выбрать файл
                            </Button>
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] w-12 flex-shrink-0">Ширина</Label>
                              <Slider
                                value={[el.width]}
                                onValueChange={([v]) => updateFooterElement(el.id, { width: v })}
                                min={20}
                                max={400}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-[10px] text-gray-500 w-8 text-right">{el.width}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] w-12 flex-shrink-0">Высота</Label>
                              <Slider
                                value={[el.height || 0]}
                                onValueChange={([v]) => updateFooterElement(el.id, { height: v })}
                                min={0}
                                max={300}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-[10px] text-gray-500 w-8 text-right">{el.height || 'авто'}</span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </>
                )}
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

      {/* Image gallery modal — обслуживает и слоты лого, и картинки колонтитула */}
      {galleryTarget && (() => {
        // Текущий выбранный файл — нужен для подсветки активного.
        // Для лого берём из logos[], для footer-image из footer.elements.
        let currentFilename: string | undefined = undefined
        let isDefaultSelected = false
        if (galleryTarget.kind === 'logo') {
          const slot = logos.find(s => s.id === galleryTarget.id)
          currentFilename = slot?.logoFilename
          isDefaultSelected = !slot?.serverUrl && !slot?.customUrl
        } else {
          const el = footer.elements.find(x => x.id === galleryTarget.id)
          if (el && el.type === 'image') {
            currentFilename = el.logoFilename
            isDefaultSelected = !el.serverUrl && !el.customUrl
          }
        }
        const handleClickDefault = () => {
          if (galleryTarget.kind === 'logo') {
            updateLogoSlot(galleryTarget.id, { serverUrl: undefined, logoFilename: undefined, customUrl: undefined })
          } else {
            updateFooterElement(galleryTarget.id, { serverUrl: undefined, logoFilename: undefined, customUrl: undefined })
          }
          setGalleryTarget(null)
        }
        const title = galleryTarget.kind === 'logo' ? 'Выбор логотипа' : 'Картинка в колонтитуле'
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setGalleryTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-sm font-semibold">{title}</h3>
              <button onClick={() => setGalleryTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Default option (только для лого — у footer-image «по умолчанию» = пусто) */}
              {galleryTarget.kind === 'logo' && (
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer mb-3 transition-colors ${
                    isDefaultSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={handleClickDefault}
                >
                  <img src="/ui/big_logo.png" alt="Default" className="h-10 max-w-[100px] object-contain" />
                  <span className="text-sm flex-1">По умолчанию</span>
                  {isDefaultSelected && <Check className="h-4 w-4 text-blue-500" />}
                </div>
              )}

              {logosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : userLogos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Нет загруженных файлов</p>
              ) : (
                <div className="space-y-2">
                  {userLogos.map((item) => (
                    <div
                      key={item.filename}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        currentFilename === item.filename ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
                      {currentFilename === item.filename && <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />}
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
              <Button variant="outline" size="sm" onClick={() => setGalleryTarget(null)} className="text-xs">
                Закрыть
              </Button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Модалка шаринга в основном (не-empty) состоянии — например когда
          КП открыт и мы хотим поделиться им из шапки calculator/page. */}
      {shareDialog && (
        <KpShareDialog
          open={!!shareDialog}
          onOpenChange={(o) => {
            if (!o) {
              setShareDialog(null)
              fetchHistory()
            }
          }}
          kpId={shareDialog.id}
          kpName={shareDialog.name}
        />
      )}

      {/* Адресная книга клиентов. Сюда же — создание/правка нового. */}
      <KpClientPickerDialog
        open={clientPickerOpen}
        onOpenChange={setClientPickerOpen}
        selectedClientId={activeClient?.id ?? null}
        onPicked={(c) => {
          setActiveClient({
            id: c.id,
            display_name: c.display_name,
            full_name: c.full_name,
            object: c.object,
            contacts: c.contacts,
          })
        }}
      />

      {/* Шаблоны КП — общий пул на всех системных юзеров. Применение
          шаблона = разовое копирование settings (без kpName) в локальные
          kpSettings. Сам шаблон остаётся read-only при импорте.
          source='editor' — юзер работает над конкретным КП, поэтому
          «Создать на основе текущего» берёт настройки именно открытого
          сейчас КП (kpSettings) без выбора. */}
      <KpTemplateManagerDialog
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
        source="editor"
        currentSettings={kpSettings}
        onApply={(settings) => {
          // kpName из шаблона игнорируем — это идентификатор конкретного
          // КП, а не часть «фирменного бланка». Top-level поля
          // (columns/logos/footer/textElements/…) перезаписываются полностью
          // через спред в updateSettings — это семантика «заменить, а не слить».
          const { kpName: _ignored, ...rest } = settings || {}
          updateSettings(rest)
        }}
      />
    </div>
  )
}
