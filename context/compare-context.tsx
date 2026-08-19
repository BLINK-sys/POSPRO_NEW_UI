"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

const STORAGE_KEY = "compare-list"
export const COMPARE_MAX = 5

export interface CompareItem {
  id: number
  slug: string
  categoryId?: number
  categoryName?: string
}

interface PendingReplace {
  incoming: CompareItem
  currentCategoryName?: string
}

interface CompareContextType {
  items: CompareItem[]
  count: number
  has: (productId: number) => boolean
  /**
   * Пробует добавить товар. Возвращает:
   *  - "added": добавлен
   *  - "removed": уже был — удалили (toggle-поведение)
   *  - "full": достигнут лимит COMPARE_MAX
   *  - "conflict": другая категория — показан диалог подтверждения замены
   */
  toggle: (item: CompareItem) => "added" | "removed" | "full" | "conflict"
  remove: (productId: number) => void
  clear: () => void
  // Диалог подтверждения замены при cross-category
  pendingReplace: PendingReplace | null
  confirmReplace: () => void
  cancelReplace: () => void
}

const CompareContext = createContext<CompareContextType | undefined>(undefined)

function loadFromStorage(): CompareItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x: any) => typeof x?.id === "number" && typeof x?.slug === "string")
  } catch {
    return []
  }
}

function saveToStorage(items: CompareItem[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage full/disabled — ok
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([])
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null)

  useEffect(() => {
    setItems(loadFromStorage())
  }, [])

  const persist = useCallback((next: CompareItem[]) => {
    setItems(next)
    saveToStorage(next)
  }, [])

  const has = useCallback((productId: number) => {
    return items.some((i) => i.id === productId)
  }, [items])

  const toggle = useCallback((item: CompareItem): "added" | "removed" | "full" | "conflict" => {
    const existing = items.find((i) => i.id === item.id)
    if (existing) {
      persist(items.filter((i) => i.id !== item.id))
      return "removed"
    }
    // Cross-category: сравниваем и по id, и по имени (в разных API у нас
    // приходит то одно, то другое). Если ни по id, ни по имени совпадения
    // нет — не пропускаем: показываем модалку. Это строже, чем «доверять
    // по умолчанию», зато не даёт слепить в сравнение товары из разных
    // категорий, когда бэк не отдал category-инфу.
    const first = items[0]
    if (first) {
      const sameById = !!(first.categoryId && item.categoryId && first.categoryId === item.categoryId)
      const sameByName = !!(first.categoryName && item.categoryName && first.categoryName === item.categoryName)
      if (!sameById && !sameByName) {
        setPendingReplace({ incoming: item, currentCategoryName: first.categoryName })
        return "conflict"
      }
    }
    if (items.length >= COMPARE_MAX) {
      return "full"
    }
    persist([...items, item])
    return "added"
  }, [items, persist])

  const remove = useCallback((productId: number) => {
    persist(items.filter((i) => i.id !== productId))
  }, [items, persist])

  const clear = useCallback(() => {
    persist([])
  }, [persist])

  const confirmReplace = useCallback(() => {
    if (!pendingReplace) return
    persist([pendingReplace.incoming])
    setPendingReplace(null)
  }, [pendingReplace, persist])

  const cancelReplace = useCallback(() => {
    setPendingReplace(null)
  }, [])

  return (
    <CompareContext.Provider
      value={{
        items,
        count: items.length,
        has,
        toggle,
        remove,
        clear,
        pendingReplace,
        confirmReplace,
        cancelReplace,
      }}
    >
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error("useCompare must be used within CompareProvider")
  return ctx
}
