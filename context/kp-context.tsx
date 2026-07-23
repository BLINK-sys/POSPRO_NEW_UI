"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'

// --- Item types ---
export interface WarehousePriceOption {
  warehouse_id: number
  warehouse_name: string
  supplier_name: string | null
  cost_price: number
  calculated_price: number | null
  calculated_delivery: number | null
  currency_code: string // e.g. 'RUB', 'KZT', 'USD'
  // Работает ли склад с НДС. Прокидывается в корп.расчётник: при false
  // строка получает vatEnabled=false, и колонки Себестоимости считаются
  // «как есть» без НДС-разделения. Контрактная сторона всегда с НДС (16%).
  vat_enabled?: boolean
  // Множитель торговой наценки со склада (переменная `коэф_наценки`).
  // 1.16 = 16% сверху. null/undefined = не задан → корп.расчётник
  // берёт глобальный из шапки.
  margin_coef?: number | null
  // Примечание менеджера к связке product × warehouse. Если есть — в
  // корп.расчётнике в колонке Поставщик показывается иконка для просмотра/
  // редактирования. PWC.id нужен чтобы PUT'нуть изменение обратно на бэк.
  pwc_id?: number
  note?: string | null
}

export interface KPItem {
  id: number
  kpId: string // unique key per item instance (allows same product multiple times)
  name: string
  slug: string
  article?: string
  price: number
  wholesale_price?: number | null
  quantity: number
  image_url?: string
  description?: string
  brand_name?: string
  supplier_name?: string | null
  characteristics?: Array<{ key: string; value: string }>
  warehousePrices?: WarehousePriceOption[]
  selectedWarehouseId?: number | null
  addedAt: number
  // True если строка была добавлена в подписанный контракт (после signed_at).
  // Такие строки сразу замораживаются: их цена и курс взяты на момент
  // добавления и больше не пересчитываются автоматически.
  addedAfterSign?: boolean
}

// --- Settings types ---
// Зона позиционирования текстового блока:
//   - 'header' — фиксированная зона в шапке первой страницы. Поле `page`
//     игнорируется (всегда 0). Drag clamp'ится по Y верхней зоной.
//   - 'footer' — running footer, появится с этапом колонтитула. Резервируется
//     уже сейчас, чтобы тип не пришлось снова мигрировать.
//   - 'free' (default) — свободно располагается на любой странице, поведение
//     как раньше.
export type KPTextZone = 'header' | 'footer' | 'free'

export interface KPTextElement {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  fontWeight: 'normal' | 'bold'
  textAlign: 'left' | 'center' | 'right'
  page: number // 0-based page index (только для zone='free')
  zone: KPTextZone
  fontFamily: string  // 'Inter' | 'Arial' | 'Tahoma' | 'Times New Roman' | 'Courier New'
  lineHeight: number  // 1.0..2.0
}

// Системные шрифты — гарантированно рендерятся в html2canvas PDF без
// необходимости подгружать что-либо извне.
export const KP_FONT_FAMILIES = ['Inter', 'Arial', 'Tahoma', 'Times New Roman', 'Courier New'] as const

// Элементы колонтитула. Координаты относительные — `x/y` внутри
// bounding-box колонтитула (не страницы целиком). Это позволяет
// перетаскивать только в его пределах и автоматически растиражировать
// один и тот же layout на все страницы как running footer.
export interface KPFooterTextElement {
  id: string
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  textAlign: 'left' | 'center' | 'right'
  fontFamily: string
  lineHeight: number
}

export interface KPFooterImageElement {
  id: string
  type: 'image'
  x: number
  y: number
  width: number
  height: number  // 0 = auto по aspect-ratio
  serverUrl?: string
  logoFilename?: string
  customUrl?: string
}

export type KPFooterElement = KPFooterTextElement | KPFooterImageElement

export interface KPFooterSettings {
  enabled: boolean
  // Высота bounding-box в pixels (тех же что и A4_HEIGHT в page.tsx).
  // Таблица товаров сжимается вверх на это значение.
  height: number
  elements: KPFooterElement[]
}

export interface KPLogoSettings {
  enabled: boolean
  width: number
  height: number
  customUrl?: string      // legacy: Base64 DataURL (kept for backward compat)
  serverUrl?: string      // server path: /uploads/kp-logos/{userId}/{filename}
  logoFilename?: string   // filename on server for identification
}

// Один слот логотипа. На КП их может быть несколько — каждый со своим
// файлом, положением и размером. Рендерятся только на первой странице.
// Высота 0 = auto по aspect-ratio изображения.
export interface KPLogoSlot {
  id: string
  serverUrl?: string
  logoFilename?: string
  customUrl?: string
  x: number
  y: number
  width: number
  height: number
}

export interface KPColumnSettings {
  number: boolean
  name: boolean
  image: boolean
  description: boolean
  characteristics: boolean
  article: boolean
  quantity: boolean
  price: boolean
  total: boolean
}

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  number: 30,
  image: 60,
  description: 140,
  characteristics: 140,
  article: 65,
  quantity: 50,
  price: 75,
  total: 75,
}

export const DEFAULT_COLUMN_ALIGNS: Record<string, 'left' | 'center' | 'right'> = {
  number: 'center',
  image: 'center',
  name: 'left',
  description: 'left',
  characteristics: 'left',
  article: 'left',
  quantity: 'center',
  price: 'center',
  total: 'center',
}

export interface KPSettings {
  columns: KPColumnSettings
  columnWidths: Record<string, number>
  columnFontSizes: Record<string, number>
  columnHeaderFontSizes: Record<string, number>
  columnAligns: Record<string, 'left' | 'center' | 'right'>
  columnHeaderAligns: Record<string, 'left' | 'center' | 'right'>
  mergeImageName: boolean
  managerAlign: 'left' | 'center' | 'right'
  // Legacy: один логотип. Оставлен для обратной совместимости —
  // mergeWithDefaults() мигрирует его в logos[0] при загрузке.
  // Новый код должен работать с `logos` массивом.
  logo: KPLogoSettings
  logos: KPLogoSlot[]
  textElements: KPTextElement[]
  footer: KPFooterSettings
  kpName: string
  title: string
  footerNote: string
}

const DEFAULT_SETTINGS: KPSettings = {
  columns: {
    number: true,
    name: true,
    image: true,
    description: false,
    characteristics: false,
    article: false,
    quantity: true,
    price: true,
    total: true,
  },
  columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
  columnFontSizes: {},
  columnHeaderFontSizes: {},
  columnAligns: { ...DEFAULT_COLUMN_ALIGNS },
  columnHeaderAligns: {},
  mergeImageName: false,
  managerAlign: 'right',
  logo: {
    enabled: true,
    width: 150,
    height: 0,
  },
  logos: [],
  textElements: [],
  footer: {
    enabled: false,
    height: 80,
    elements: [],
  },
  kpName: '',
  title: 'Коммерческое предложение',
  footerNote: '* Цены указаны в тенге. Предложение действительно 14 дней.',
}

// --- Merge parsed settings with defaults ---
function mergeWithDefaults(parsed: any): KPSettings {
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS }
  const merged = { ...DEFAULT_SETTINGS, ...parsed }
  if (parsed.columns) merged.columns = { ...DEFAULT_SETTINGS.columns, ...parsed.columns }
  if (parsed.columnWidths) merged.columnWidths = { ...DEFAULT_SETTINGS.columnWidths, ...parsed.columnWidths }
  if (parsed.columnFontSizes) merged.columnFontSizes = { ...DEFAULT_SETTINGS.columnFontSizes, ...parsed.columnFontSizes }
  if (parsed.columnHeaderFontSizes) merged.columnHeaderFontSizes = { ...DEFAULT_SETTINGS.columnHeaderFontSizes, ...parsed.columnHeaderFontSizes }
  if (parsed.columnAligns) merged.columnAligns = { ...DEFAULT_COLUMN_ALIGNS, ...parsed.columnAligns }
  if (parsed.columnHeaderAligns) merged.columnHeaderAligns = { ...DEFAULT_SETTINGS.columnHeaderAligns, ...parsed.columnHeaderAligns }
  if (parsed.logo) merged.logo = { ...DEFAULT_SETTINGS.logo, ...parsed.logo }
  // Миграция legacy single-logo → logos[]. Происходит один раз: если
  // в сохранённых настройках уже есть массив logos — используем его, иначе
  // строим первый слот из старого `logo` + позиции в localStorage
  // ('kp-logo-pos'). Дальше единственный источник правды — logos.
  if (Array.isArray(parsed.logos)) {
    merged.logos = parsed.logos.map((slot: any, idx: number) => ({
      id: slot.id || `logo-${Date.now()}-${idx}`,
      serverUrl: slot.serverUrl,
      logoFilename: slot.logoFilename,
      customUrl: slot.customUrl,
      x: typeof slot.x === 'number' ? slot.x : 48,
      y: typeof slot.y === 'number' ? slot.y : 48,
      width: typeof slot.width === 'number' ? slot.width : 150,
      height: typeof slot.height === 'number' ? slot.height : 0,
    }))
  } else {
    // Нет массива logos — создаём один слот из legacy `logo` если он
    // был включён, иначе оставляем пустой массив.
    const legacy = merged.logo
    if (legacy?.enabled) {
      let posX = 48, posY = 48
      if (typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem('kp-logo-pos')
          if (stored) {
            const p = JSON.parse(stored)
            if (typeof p?.x === 'number') posX = p.x
            if (typeof p?.y === 'number') posY = p.y
          }
        } catch {}
      }
      merged.logos = [{
        id: `logo-legacy-${Date.now()}`,
        serverUrl: legacy.serverUrl,
        logoFilename: legacy.logoFilename,
        customUrl: legacy.customUrl,
        x: posX,
        y: posY,
        width: legacy.width || 150,
        height: legacy.height || 0,
      }]
    } else {
      merged.logos = []
    }
  }
  if (parsed.textElements) {
    merged.textElements = parsed.textElements.map((el: any) => ({
      ...el,
      page: typeof el.page === 'number' ? el.page : 0,
      // Миграция: старые элементы без zone → 'free' (текущее поведение).
      zone: (el.zone === 'header' || el.zone === 'footer' || el.zone === 'free') ? el.zone : 'free',
      fontFamily: typeof el.fontFamily === 'string' && el.fontFamily ? el.fontFamily : 'Inter',
      lineHeight: typeof el.lineHeight === 'number' && el.lineHeight > 0 ? el.lineHeight : 1.4,
    }))
  }
  if (parsed.footer && typeof parsed.footer === 'object') {
    merged.footer = {
      enabled: !!parsed.footer.enabled,
      height: typeof parsed.footer.height === 'number' && parsed.footer.height > 0 ? parsed.footer.height : 80,
      elements: Array.isArray(parsed.footer.elements) ? parsed.footer.elements.map((el: any) => ({
        ...el,
        // Дефолты для типобезопасности при ручной правке/обратной совместимости.
        x: typeof el.x === 'number' ? el.x : 24,
        y: typeof el.y === 'number' ? el.y : 24,
        ...(el.type === 'text' ? {
          fontFamily: typeof el.fontFamily === 'string' && el.fontFamily ? el.fontFamily : 'Inter',
          lineHeight: typeof el.lineHeight === 'number' && el.lineHeight > 0 ? el.lineHeight : 1.4,
        } : {}),
      })) : [],
    }
  }
  return merged
}

// --- Client types (адресная книга КП) ---
// Минимальный объект для денормализованного отображения в списке/чипе.
// Полные данные грузим отдельно через getKpClient(id).
export interface KPClientStub {
  id: number
  display_name: string
}

// --- History types ---
export type KPAccessLevel = "owner" | "edit" | "view"

export interface KPHistoryEntry {
  id: number
  name: string
  total_amount: number
  // ISO-дата подписания контракта. null/undefined = просто сохранённое КП
  // (жёлтая карточка). Заполнено = подписанный контракт (зелёная карточка).
  signed_at?: string | null
  created_at: string
  // Уровень доступа текущего юзера к этому КП. 'owner' — он создал, 'edit' —
  // расшарили с правом редактирования или он super-admin, 'view' — только просмотр.
  access_level?: KPAccessLevel
  // Если viewer не владелец — id владельца + денормализованные данные для UI
  user_id?: number
  shared_by_user_id?: number
  shared_by?: { id: number; email: string; full_name: string } | null
  // Привязка к клиенту из адресной книги. Сам id + минимальный денорм
  // для бейджа в списке. Полные данные подгружаются по запросу.
  client_id?: number | null
  client?: KPClientStub | null
}

// Дешёвый снимок клиента, который держим прямо в контексте чтобы не дёргать
// /api/kp-clients/<id> каждый раз при перерисовке settings panel.
// Полная форма редактирования всё равно тянет свежий объект через action.
export interface KPClientSnapshot extends KPClientStub {
  full_name?: string | null
  object?: string | null
  contacts?: { phone: string; note: string }[]
}

// Фильтр для списка истории — управляется UI выпадушкой над колонками.
//   mine    — только мои собственные (default)
//   shared  — только реально расшаренные мне через KPShare
//   all     — все КП всех пользователей (только super-admin/owner)
//   user    — КП конкретного юзера (только super-admin/owner)
export type KPHistoryFilter =
  | { kind: "mine" }
  | { kind: "shared" }
  | { kind: "all" }
  | { kind: "user"; userId: number }

// --- Context type ---
interface KPContextType {
  kpItems: KPItem[]
  kpCount: number
  addItem: (item: Omit<KPItem, 'kpId' | 'quantity' | 'addedAt'>) => string
  removeItem: (kpId: string) => void
  updateItemQuantity: (kpId: string, quantity: number) => void
  updateItem: (kpId: string, updates: Partial<KPItem>) => void
  reorderItems: (sourceIndex: number, destIndex: number) => void
  clearAll: () => void
  isInKP: (productId: number) => boolean
  // Settings
  kpSettings: KPSettings
  updateSettings: (updates: Partial<KPSettings>) => void
  updateColumns: (updates: Partial<KPColumnSettings>) => void
  updateColumnWidth: (key: string, width: number) => void
  updateColumnFontSize: (key: string, size: number) => void
  updateColumnHeaderFontSize: (key: string, size: number) => void
  updateColumnAlign: (key: string, align: 'left' | 'center' | 'right') => void
  updateColumnHeaderAlign: (key: string, align: 'left' | 'center' | 'right') => void
  updateLogo: (updates: Partial<KPLogoSettings>) => void
  // Multi-logo API. addLogoSlot создаёт новый слот без файла (юзер
  // потом выбирает файл через UI), возвращает id.
  addLogoSlot: () => string
  updateLogoSlot: (id: string, updates: Partial<KPLogoSlot>) => void
  removeLogoSlot: (id: string) => void
  addTextElement: (text?: string, page?: number, zone?: KPTextZone) => void
  updateTextElement: (id: string, updates: Partial<KPTextElement>) => void
  removeTextElement: (id: string) => void
  // Footer (running колонтитул на каждой странице). Содержит свободные
  // элементы: текст + картинки. Drag/resize — только внутри bounding-box.
  updateFooter: (updates: Partial<KPFooterSettings>) => void
  addFooterTextElement: () => string
  addFooterImageElement: () => string
  updateFooterElement: (id: string, updates: Partial<KPFooterTextElement> | Partial<KPFooterImageElement>) => void
  removeFooterElement: (id: string) => void
  // Calculator data
  calculatorData: any | null
  setCalculatorData: (data: any | null) => void
  // History
  kpHistory: KPHistoryEntry[]
  historyLoading: boolean
  activeHistoryId: number | null
  // signed_at активного КП (если оно загружено из истории и подписано).
  // Используется UI чтобы решать, можно ли менять автомиксующиеся настройки
  // и показывать ли пометку «Добавлен после подписания» у новых строк.
  activeSignedAt: string | null
  // access_level активного КП — нужно UI чтобы спрятать/серить кнопки
  // «Сохранить»/«Подписать»/«Удалить» если у viewer'а только просмотр.
  activeAccessLevel: KPAccessLevel
  // Является ли текущий юзер super-admin'ом (владелец + грантованные).
  // True = видит фильтр «По пользователю» + раздел /admin/kp-management.
  isSuperAdmin: boolean
  // True если юзеру есть что увидеть кроме своих собственных КП:
  // расшаренные ему ИЛИ (для super-admin) хоть один чужой в системе.
  // UI на этом решает показывать ли онбординг-карточку.
  hasOtherVisible: boolean
  // Текущий фильтр истории. По умолчанию kind='mine'.
  historyFilter: KPHistoryFilter
  setHistoryFilter: (f: KPHistoryFilter) => void
  fetchHistory: () => Promise<void>
  saveToHistory: (positions?: { logoPos?: { x: number; y: number }; managerPos?: { x: number; y: number } }, calculatorData?: any) => Promise<boolean>
  loadFromHistory: (id: number) => Promise<{ success: boolean; positions?: { logoPos?: { x: number; y: number }; managerPos?: { x: number; y: number } }; calculatorData?: any; signedAt?: string | null }>
  deleteFromHistory: (id: number) => Promise<boolean>
  // Подписать активное КП. Возвращает true если успех. Сервер ставит
  // signed_at = текущий timestamp и активный кп переходит в режим
  // «подписанный» — правки автоматически не валятся, сохраняем снимок.
  signActiveContract: () => Promise<boolean>
  // --- Адресная книга КП: текущий выбранный клиент ---
  // Хранится в контексте, чтобы быть доступным settings-панели и пройти
  // через сохранение/загрузку КП. null = клиент не выбран (старое поведение).
  activeClient: KPClientSnapshot | null
  setActiveClient: (client: KPClientSnapshot | null) => void
}

const KP_STORAGE_KEY = "kp-items"
const KP_SETTINGS_KEY = "kp-settings"
const API_SAVE_DEBOUNCE = 2000

const KPContext = createContext<KPContextType | undefined>(undefined)

export function KPProvider({ children }: { children: ReactNode }) {
  const [kpItems, setKpItems] = useState<KPItem[]>([])
  const [kpSettings, setKpSettings] = useState<KPSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)
  const [kpHistory, setKpHistory] = useState<KPHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null)
  const [activeSignedAt, setActiveSignedAt] = useState<string | null>(null)
  const [activeAccessLevel, setActiveAccessLevel] = useState<KPAccessLevel>("owner")
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [hasOtherVisible, setHasOtherVisible] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<KPHistoryFilter>({ kind: "mine" })
  const [calculatorData, setCalculatorData] = useState<any | null>(null)
  const [activeClient, setActiveClient] = useState<KPClientSnapshot | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const isSystemUser = user?.role === "admin" || user?.role === "system"

  // Refs for API sync
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipApiSaveRef = useRef(false)
  const apiLoadedRef = useRef(false)

  // Загрузка из localStorage при монтировании (быстрый offline-кэш)
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const storedItems = localStorage.getItem(KP_STORAGE_KEY)
      if (storedItems) {
        const parsed = JSON.parse(storedItems)
        if (Array.isArray(parsed)) {
          // Migrate old items without kpId
          const migrated = parsed.map((item: any, idx: number) => ({
            ...item,
            kpId: item.kpId || `kp-migrated-${item.addedAt || Date.now()}-${idx}`,
          }))
          setKpItems(migrated)
        }
      }

      const storedSettings = localStorage.getItem(KP_SETTINGS_KEY)
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings)
        setKpSettings(mergeWithDefaults(parsed))
      }
    } catch (error) {
      console.error("Ошибка загрузки КП из localStorage:", error)
    }
    setIsLoaded(true)
  }, [])

  // Загрузка настроек с сервера (приоритет над localStorage)
  useEffect(() => {
    if (!isLoaded || !isSystemUser || apiLoadedRef.current) return

    const fetchFromApi = async () => {
      try {
        const resp = await fetch('/api/kp-settings')
        const res = await resp.json() as { success: boolean; settings: KPSettings | null }
        if (res.success && res.settings) {
          apiLoadedRef.current = true
          skipApiSaveRef.current = true
          const merged = mergeWithDefaults(res.settings)
          setKpSettings(merged)
          // Обновляем localStorage
          try { localStorage.setItem(KP_SETTINGS_KEY, JSON.stringify(merged)) } catch {}
        }
      } catch (e) {
        console.error("Ошибка загрузки настроек КП с сервера:", e)
      }
    }

    fetchFromApi()
  }, [isLoaded, isSystemUser])

  // Сброс apiLoadedRef при смене пользователя
  useEffect(() => {
    apiLoadedRef.current = false
  }, [user?.id])

  // Сохранение items в localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return
    try {
      localStorage.setItem(KP_STORAGE_KEY, JSON.stringify(kpItems))
    } catch (error) {
      console.error("Ошибка сохранения КП items:", error)
    }
  }, [kpItems, isLoaded])

  // Сохранение settings в localStorage + debounced API save
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return

    // Всегда сохраняем в localStorage (мгновенно)
    try {
      localStorage.setItem(KP_SETTINGS_KEY, JSON.stringify(kpSettings))
    } catch (error) {
      console.error("Ошибка сохранения КП settings:", error)
    }

    // Сохранение на сервер с debounce
    if (!isSystemUser) return

    if (skipApiSaveRef.current) {
      skipApiSaveRef.current = false
      return
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch('/api/kp-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: kpSettings }),
        })
      } catch (e) {
        console.error("Ошибка сохранения настроек КП на сервер:", e)
      }
    }, API_SAVE_DEBOUNCE)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [kpSettings, isLoaded, isSystemUser])

  // --- Item functions ---
  const addItem = useCallback((item: Omit<KPItem, 'kpId' | 'quantity' | 'addedAt'>): string => {
    if (!isSystemUser) return ''
    const kpId = `kp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    // Если активное КП — подписанный контракт, помечаем новую строку
    // флагом addedAfterSign. Это даёт UI визуально отличать «дополнительные»
    // строки и сразу их фиксировать как часть снимка (текущие цены/курс).
    const addedAfterSign = activeSignedAt ? true : undefined
    setKpItems(prev => {
      toast({ title: 'Добавлено в КП', description: `${item.name} добавлен в КП` })
      return [...prev, { ...item, kpId, quantity: 1, addedAt: Date.now(), addedAfterSign }]
    })
    return kpId
  }, [isSystemUser, toast, activeSignedAt])

  const removeItem = useCallback((kpId: string) => {
    setKpItems(prev => prev.filter(item => item.kpId !== kpId))
  }, [])

  const updateItemQuantity = useCallback((kpId: string, quantity: number) => {
    if (quantity < 1) return
    setKpItems(prev => prev.map(item => item.kpId === kpId ? { ...item, quantity } : item))
  }, [])

  const updateItem = useCallback((kpId: string, updates: Partial<KPItem>) => {
    setKpItems(prev => prev.map(item => item.kpId === kpId ? { ...item, ...updates } : item))
  }, [])

  // Перестановка строк в КП. Используется и левой панелью (drag&drop через
  // @dnd-kit), и автоматически распространяется на A4-превью — оно
  // рендерится из того же kpItems массива.
  const reorderItems = useCallback((sourceIndex: number, destIndex: number) => {
    setKpItems(prev => {
      if (sourceIndex === destIndex) return prev
      if (sourceIndex < 0 || sourceIndex >= prev.length) return prev
      if (destIndex < 0 || destIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(destIndex, 0, moved)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setKpItems([])
    setActiveHistoryId(null)
    setActiveSignedAt(null)
    setActiveAccessLevel("owner")
    setCalculatorData(null)
    setActiveClient(null)
  }, [])

  const isInKP = useCallback((productId: number) => {
    return kpItems.some(item => item.id === productId)
  }, [kpItems])

  // --- Settings functions ---
  const updateSettings = useCallback((updates: Partial<KPSettings>) => {
    setKpSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const updateColumns = useCallback((updates: Partial<KPColumnSettings>) => {
    setKpSettings(prev => ({ ...prev, columns: { ...prev.columns, ...updates } }))
  }, [])

  const updateColumnWidth = useCallback((key: string, width: number) => {
    setKpSettings(prev => ({
      ...prev,
      columnWidths: { ...prev.columnWidths, [key]: Math.max(20, Math.round(width)) }
    }))
  }, [])

  const updateColumnFontSize = useCallback((key: string, size: number) => {
    setKpSettings(prev => ({
      ...prev,
      columnFontSizes: { ...prev.columnFontSizes, [key]: Math.max(6, Math.min(20, Math.round(size * 10) / 10)) }
    }))
  }, [])

  const updateColumnHeaderFontSize = useCallback((key: string, size: number) => {
    setKpSettings(prev => ({
      ...prev,
      columnHeaderFontSizes: { ...prev.columnHeaderFontSizes, [key]: Math.max(6, Math.min(20, Math.round(size * 10) / 10)) }
    }))
  }, [])

  const updateColumnAlign = useCallback((key: string, align: 'left' | 'center' | 'right') => {
    setKpSettings(prev => ({
      ...prev,
      columnAligns: { ...prev.columnAligns, [key]: align }
    }))
  }, [])

  const updateColumnHeaderAlign = useCallback((key: string, align: 'left' | 'center' | 'right') => {
    setKpSettings(prev => ({
      ...prev,
      columnHeaderAligns: { ...prev.columnHeaderAligns, [key]: align }
    }))
  }, [])

  const updateLogo = useCallback((updates: Partial<KPLogoSettings>) => {
    setKpSettings(prev => ({ ...prev, logo: { ...prev.logo, ...updates } }))
  }, [])

  const addLogoSlot = useCallback((): string => {
    const id = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setKpSettings(prev => {
      // Сдвигаем новый слот по диагонали на каждом следующем добавлении,
      // чтобы не накладывался на существующие. Step 20px от позиции
      // последнего слота, либо от (48, 48) если массив пуст.
      const last = prev.logos[prev.logos.length - 1]
      const baseX = last ? last.x + 20 : 48
      const baseY = last ? last.y + 20 : 48
      const newSlot: KPLogoSlot = {
        id,
        x: baseX,
        y: baseY,
        width: 150,
        height: 0,
      }
      return { ...prev, logos: [...prev.logos, newSlot] }
    })
    return id
  }, [])

  const updateLogoSlot = useCallback((id: string, updates: Partial<KPLogoSlot>) => {
    setKpSettings(prev => ({
      ...prev,
      logos: prev.logos.map(s => s.id === id ? { ...s, ...updates } : s),
    }))
  }, [])

  const removeLogoSlot = useCallback((id: string) => {
    setKpSettings(prev => ({
      ...prev,
      logos: prev.logos.filter(s => s.id !== id),
    }))
  }, [])

  const addTextElement = useCallback((text?: string, page?: number, zone: KPTextZone = 'free') => {
    // Стартовые координаты подбираем под зону: 'header' — в верхней
    // полосе страницы 1, 'footer' — внизу, 'free' — посередине.
    const startY = zone === 'header' ? 120 : zone === 'footer' ? 1050 : 500
    const newElement: KPTextElement = {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: text || 'Новый текст',
      x: 48,
      y: startY,
      fontSize: 14,
      fontWeight: 'normal',
      textAlign: 'left',
      page: zone === 'free' ? (page ?? 0) : 0,
      zone,
      fontFamily: 'Inter',
      lineHeight: 1.4,
    }
    setKpSettings(prev => ({
      ...prev,
      textElements: [...prev.textElements, newElement],
    }))
  }, [])

  const updateTextElement = useCallback((id: string, updates: Partial<KPTextElement>) => {
    setKpSettings(prev => ({
      ...prev,
      textElements: prev.textElements.map(el => el.id === id ? { ...el, ...updates } : el),
    }))
  }, [])

  const removeTextElement = useCallback((id: string) => {
    setKpSettings(prev => ({
      ...prev,
      textElements: prev.textElements.filter(el => el.id !== id),
    }))
  }, [])

  // --- Footer ---
  const updateFooter = useCallback((updates: Partial<KPFooterSettings>) => {
    setKpSettings(prev => ({ ...prev, footer: { ...prev.footer, ...updates } }))
  }, [])

  const addFooterTextElement = useCallback((): string => {
    const id = `footer-text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setKpSettings(prev => {
      const el: KPFooterTextElement = {
        id,
        type: 'text',
        x: 24,
        y: Math.max(8, Math.min(prev.footer.height - 24, prev.footer.height / 2 - 8)),
        text: 'Текст',
        fontSize: 10,
        fontWeight: 'normal',
        textAlign: 'left',
        fontFamily: 'Inter',
        lineHeight: 1.3,
      }
      return { ...prev, footer: { ...prev.footer, elements: [...prev.footer.elements, el] } }
    })
    return id
  }, [])

  const addFooterImageElement = useCallback((): string => {
    const id = `footer-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setKpSettings(prev => {
      const el: KPFooterImageElement = {
        id,
        type: 'image',
        x: 24,
        y: 8,
        width: 80,
        height: 0,
      }
      return { ...prev, footer: { ...prev.footer, elements: [...prev.footer.elements, el] } }
    })
    return id
  }, [])

  const updateFooterElement = useCallback((id: string, updates: any) => {
    setKpSettings(prev => ({
      ...prev,
      footer: {
        ...prev.footer,
        elements: prev.footer.elements.map(el => el.id === id ? { ...el, ...updates } : el),
      },
    }))
  }, [])

  const removeFooterElement = useCallback((id: string) => {
    setKpSettings(prev => ({
      ...prev,
      footer: {
        ...prev.footer,
        elements: prev.footer.elements.filter(el => el.id !== id),
      },
    }))
  }, [])

  // --- History functions ---
  const fetchHistory = useCallback(async () => {
    if (!isSystemUser) return
    setHistoryLoading(true)
    try {
      // Маппим внутренний filter-объект на query string бэка
      const params = new URLSearchParams()
      if (historyFilter.kind === "mine") params.set("filter", "mine")
      else if (historyFilter.kind === "shared") params.set("filter", "shared")
      else if (historyFilter.kind === "all") params.set("filter", "all")
      else if (historyFilter.kind === "user") {
        params.set("filter", "user")
        params.set("user_id", String(historyFilter.userId))
      }
      const qs = params.toString()
      const resp = await fetch(`/api/kp-history${qs ? `?${qs}` : ""}`)
      const data = await resp.json()
      if (data.success && Array.isArray(data.history)) {
        setKpHistory(data.history)
        // Бэк сообщает super-admin статус — UI на этом основывает наличие
        // фильтра «По пользователю» и пункта в админ-сайдбаре.
        if (typeof data.is_super_admin === "boolean") {
          setIsSuperAdmin(data.is_super_admin)
        }
        // Есть ли у юзера хоть один доступный чужой КП (расшаренный или
        // системный для super-admin'а). Решает показывать ли онбординг.
        if (typeof data.has_other_visible === "boolean") {
          setHasOtherVisible(data.has_other_visible)
        }
      }
    } catch (e) {
      console.error('Ошибка загрузки истории КП:', e)
    } finally {
      setHistoryLoading(false)
    }
  }, [isSystemUser, historyFilter])

  const saveToHistory = useCallback(async (positions?: { logoPos?: { x: number; y: number }; managerPos?: { x: number; y: number } }, calcData?: any): Promise<boolean> => {
    if (!isSystemUser || kpItems.length === 0) return false
    try {
      const totalAmount = kpItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const settingsWithPositions = {
        ...kpSettings,
        _logoPos: positions?.logoPos,
        _managerPos: positions?.managerPos,
      }
      const payload: any = {
        name: kpSettings.kpName || 'КП без названия',
        items: kpItems,
        settings: settingsWithPositions,
        total_amount: totalAmount,
        // Привязка к клиенту из адресной книги. Бэк сам валидирует id и
        // тихо обнуляет если клиент удалён или не существует.
        client_id: activeClient?.id ?? null,
      }
      // Include calculator data if provided
      if (calcData !== undefined) {
        payload.calculator_data = calcData
      } else if (calculatorData !== null) {
        payload.calculator_data = calculatorData
      }

      let resp: Response
      if (activeHistoryId) {
        // Перезаписываем существующее КП
        resp = await fetch(`/api/kp-history/${activeHistoryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        // Создаём новое
        resp = await fetch('/api/kp-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await resp.json()
      if (data.success) {
        if (!activeHistoryId && data.id) {
          setActiveHistoryId(data.id)
        }
        await fetchHistory()
        return true
      }
    } catch (e) {
      console.error('Ошибка сохранения КП в историю:', e)
    }
    return false
  }, [isSystemUser, kpItems, kpSettings, calculatorData, activeClient, activeHistoryId, fetchHistory])

  const loadFromHistory = useCallback(async (id: number): Promise<{ success: boolean; positions?: { logoPos?: { x: number; y: number }; managerPos?: { x: number; y: number } }; calculatorData?: any; signedAt?: string | null }> => {
    if (!isSystemUser) return { success: false }
    try {
      const resp = await fetch(`/api/kp-history/${id}`)
      const data = await resp.json()
      if (data.success && data.data) {
        const { items, settings, calculator_data, signed_at, access_level, client } = data.data
        if (Array.isArray(items)) {
          const migrated = items.map((item: any, idx: number) => ({
            ...item,
            kpId: item.kpId || `kp-migrated-${item.addedAt || Date.now()}-${idx}`,
          }))
          setKpItems(migrated)
        }
        const positions = {
          logoPos: settings?._logoPos,
          managerPos: settings?._managerPos,
        }
        if (settings && typeof settings === 'object') {
          skipApiSaveRef.current = true
          setKpSettings(mergeWithDefaults(settings))
        }
        setCalculatorData(calculator_data || null)
        setActiveHistoryId(id)
        setActiveSignedAt(signed_at || null)
        // Уровень доступа viewer'а к этому КП — определяет можно ли менять
        // и сохранять. Бэк отдаёт 'owner'/'edit'/'view'.
        setActiveAccessLevel((access_level as KPAccessLevel) || 'view')
        // Привязанный клиент. Бэк отдаёт денормализованный stub
        // {id, organization_type, display_name}; при редактировании в
        // settings-панели подтягиваем полный объект через getKpClient.
        setActiveClient(client ? { ...client } : null)
        return { success: true, positions, calculatorData: calculator_data, signedAt: signed_at || null }
      }
    } catch (e) {
      console.error('Ошибка загрузки КП из истории:', e)
    }
    return { success: false }
  }, [isSystemUser])

  const signActiveContract = useCallback(async (): Promise<boolean> => {
    if (!isSystemUser || !activeHistoryId) return false
    try {
      const resp = await fetch(`/api/kp-history/${activeHistoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_at: 'now' }),
      })
      const data = await resp.json()
      if (data.success) {
        // Сервер ставит signed_at = now. Подтянем свежий объект, чтобы
        // получить точный timestamp и обновить и активное, и список.
        try {
          const refresh = await fetch(`/api/kp-history/${activeHistoryId}`)
          const fresh = await refresh.json()
          if (fresh.success && fresh.data?.signed_at) {
            setActiveSignedAt(fresh.data.signed_at)
          } else {
            // Fallback — клиентское время. Сервер всё равно правильное хранит.
            setActiveSignedAt(new Date().toISOString())
          }
        } catch {
          setActiveSignedAt(new Date().toISOString())
        }
        await fetchHistory()
        return true
      }
    } catch (e) {
      console.error('Ошибка подписания контракта:', e)
    }
    return false
  }, [isSystemUser, activeHistoryId, fetchHistory])

  const deleteFromHistory = useCallback(async (id: number): Promise<boolean> => {
    if (!isSystemUser) return false
    try {
      const resp = await fetch(`/api/kp-history/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (data.success) {
        setKpHistory(prev => prev.filter(entry => entry.id !== id))
        return true
      }
    } catch (e) {
      console.error('Ошибка удаления КП из истории:', e)
    }
    return false
  }, [isSystemUser])

  // Загружаем историю при первом входе И при смене фильтра.
  // fetchHistory сам читает historyFilter, useCallback с ним в deps —
  // меняем фильтр → ссылка fetchHistory обновляется → useEffect срабатывает.
  useEffect(() => {
    if (isLoaded && isSystemUser) {
      fetchHistory()
    }
  }, [isLoaded, isSystemUser, fetchHistory])

  const value: KPContextType = {
    kpItems, kpCount: kpItems.length,
    addItem, removeItem, updateItemQuantity, updateItem, reorderItems, clearAll, isInKP,
    kpSettings, updateSettings, updateColumns, updateColumnWidth, updateColumnFontSize, updateColumnHeaderFontSize, updateColumnAlign, updateColumnHeaderAlign, updateLogo, addLogoSlot, updateLogoSlot, removeLogoSlot,
    addTextElement, updateTextElement, removeTextElement,
    updateFooter, addFooterTextElement, addFooterImageElement, updateFooterElement, removeFooterElement,
    calculatorData, setCalculatorData,
    kpHistory, historyLoading, activeHistoryId, activeSignedAt,
    activeAccessLevel, isSuperAdmin, hasOtherVisible, historyFilter, setHistoryFilter,
    fetchHistory, saveToHistory, loadFromHistory, deleteFromHistory, signActiveContract,
    activeClient, setActiveClient,
  }

  return (
    <KPContext.Provider value={value}>
      {children}
    </KPContext.Provider>
  )
}

export function useKP() {
  const context = useContext(KPContext)
  if (context === undefined) {
    throw new Error('useKP must be used within a KPProvider')
  }
  return context
}
