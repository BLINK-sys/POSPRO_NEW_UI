"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'

// --- Item types ---
export interface KPItem {
  id: number
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
  customUrl?: string
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

// --- Context type ---
interface KPContextType {
  kpItems: KPItem[]
  kpCount: number
  addItem: (item: Omit<KPItem, 'quantity' | 'addedAt'>) => void
  removeItem: (productId: number) => void
  updateItemQuantity: (productId: number, quantity: number) => void
  updateItem: (productId: number, updates: Partial<KPItem>) => void
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
}

const KP_STORAGE_KEY = "kp-items"
const KP_SETTINGS_KEY = "kp-settings"
const API_SAVE_DEBOUNCE = 2000

const KPContext = createContext<KPContextType | undefined>(undefined)

export function KPProvider({ children }: { children: ReactNode }) {
  const [kpItems, setKpItems] = useState<KPItem[]>([])
  const [kpSettings, setKpSettings] = useState<KPSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)
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
        if (Array.isArray(parsed)) setKpItems(parsed)
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
  const addItem = useCallback((item: Omit<KPItem, 'quantity' | 'addedAt'>) => {
    if (!isSystemUser) return
    setKpItems(prev => {
      const exists = prev.find(i => i.id === item.id)
      if (exists) {
        toast({ title: 'Уже в КП', description: `${item.name} уже добавлен в КП` })
        return prev
      }
      toast({ title: 'Добавлено в КП', description: `${item.name} добавлен в КП` })
      return [...prev, { ...item, quantity: 1, addedAt: Date.now() }]
    })
  }, [isSystemUser, toast])

  const removeItem = useCallback((productId: number) => {
    setKpItems(prev => prev.filter(item => item.id !== productId))
  }, [])

  const updateItemQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity < 1) return
    setKpItems(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item))
  }, [])

  const updateItem = useCallback((productId: number, updates: Partial<KPItem>) => {
    setKpItems(prev => prev.map(item => item.id === productId ? { ...item, ...updates } : item))
  }, [])

  const clearAll = useCallback(() => { setKpItems([]) }, [])

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

  const value: KPContextType = {
    kpItems, kpCount: kpItems.length,
    addItem, removeItem, updateItemQuantity, updateItem, clearAll, isInKP,
    kpSettings, updateSettings, updateColumns, updateColumnWidth, updateColumnFontSize, updateColumnHeaderFontSize, updateColumnAlign, updateColumnHeaderAlign, updateLogo,
    addTextElement, updateTextElement, removeTextElement,
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
