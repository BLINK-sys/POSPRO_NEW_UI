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
}

// --- Settings types ---
export interface KPTextElement {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  fontWeight: 'normal' | 'bold'
  textAlign: 'left' | 'center' | 'right'
  page: number // 0-based page index
}

export interface KPLogoSettings {
  enabled: boolean
  width: number
  height: number
  customUrl?: string      // legacy: Base64 DataURL (kept for backward compat)
  serverUrl?: string      // server path: /uploads/kp-logos/{userId}/{filename}
  logoFilename?: string   // filename on server for identification
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
  logo: KPLogoSettings
  textElements: KPTextElement[]
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
  textElements: [],
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
  if (parsed.textElements) {
    merged.textElements = parsed.textElements.map((el: any) => ({
      ...el,
      page: typeof el.page === 'number' ? el.page : 0,
    }))
  }
  return merged
}

// --- History types ---
export interface KPHistoryEntry {
  id: number
  name: string
  total_amount: number
  created_at: string
}

// --- Context type ---
interface KPContextType {
  kpItems: KPItem[]
  kpCount: number
  addItem: (item: Omit<KPItem, 'kpId' | 'quantity' | 'addedAt'>) => string
  removeItem: (kpId: string) => void
  updateItemQuantity: (kpId: string, quantity: number) => void
  updateItem: (kpId: string, updates: Partial<KPItem>) => void
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
  addTextElement: (text?: string, page?: number) => void
  updateTextElement: (id: string, updates: Partial<KPTextElement>) => void
  removeTextElement: (id: string) => void
  // Calculator data
  calculatorData: any | null
  setCalculatorData: (data: any | null) => void
  // History
  kpHistory: KPHistoryEntry[]
  historyLoading: boolean
  activeHistoryId: number | null
  fetchHistory: () => Promise<void>
  saveToHistory: (positions?: { logoPos?: { x: number; y: number }; managerPos?: { x: number; y: number } }, calculatorData?: any) => Promise<boolean>
  loadFromHistory: (id: number) => Promise<{ success: boolean; positions?: { logoPos?: { x: number; y: number }; managerPos?: { x: number; y: number } }; calculatorData?: any }>
  deleteFromHistory: (id: number) => Promise<boolean>
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
  const [calculatorData, setCalculatorData] = useState<any | null>(null)
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
    setKpItems(prev => {
      toast({ title: 'Добавлено в КП', description: `${item.name} добавлен в КП` })
      return [...prev, { ...item, kpId, quantity: 1, addedAt: Date.now() }]
    })
    return kpId
  }, [isSystemUser, toast])

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

  const clearAll = useCallback(() => { setKpItems([]); setActiveHistoryId(null); setCalculatorData(null) }, [])

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

  const addTextElement = useCallback((text?: string, page?: number) => {
    const newElement: KPTextElement = {
      id: `text-${Date.now()}`,
      text: text || 'Новый текст',
      x: 48,
      y: 500,
      fontSize: 14,
      fontWeight: 'normal',
      textAlign: 'left',
      page: page ?? 0,
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

  // --- History functions ---
  const fetchHistory = useCallback(async () => {
    if (!isSystemUser) return
    setHistoryLoading(true)
    try {
      const resp = await fetch('/api/kp-history')
      const data = await resp.json()
      if (data.success && Array.isArray(data.history)) {
        setKpHistory(data.history)
      }
    } catch (e) {
      console.error('Ошибка загрузки истории КП:', e)
    } finally {
      setHistoryLoading(false)
    }
  }, [isSystemUser])

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
  }, [isSystemUser, kpItems, kpSettings, calculatorData, activeHistoryId, fetchHistory])

  const loadFromHistory = useCallback(async (id: number): Promise<{ success: boolean; positions?: { logoPos?: { x: number; y: number }; managerPos?: { x: number; y: number } }; calculatorData?: any }> => {
    if (!isSystemUser) return { success: false }
    try {
      const resp = await fetch(`/api/kp-history/${id}`)
      const data = await resp.json()
      if (data.success && data.data) {
        const { items, settings, calculator_data } = data.data
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
        return { success: true, positions, calculatorData: calculator_data }
      }
    } catch (e) {
      console.error('Ошибка загрузки КП из истории:', e)
    }
    return { success: false }
  }, [isSystemUser])

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

  // Загружаем историю при первом входе
  useEffect(() => {
    if (isLoaded && isSystemUser) {
      fetchHistory()
    }
  }, [isLoaded, isSystemUser, fetchHistory])

  const value: KPContextType = {
    kpItems, kpCount: kpItems.length,
    addItem, removeItem, updateItemQuantity, updateItem, clearAll, isInKP,
    kpSettings, updateSettings, updateColumns, updateColumnWidth, updateColumnFontSize, updateColumnHeaderFontSize, updateColumnAlign, updateColumnHeaderAlign, updateLogo,
    addTextElement, updateTextElement, removeTextElement,
    calculatorData, setCalculatorData,
    kpHistory, historyLoading, activeHistoryId, fetchHistory, saveToHistory, loadFromHistory, deleteFromHistory,
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
