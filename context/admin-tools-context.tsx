"use client"

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react"

/**
 * Глобальный тумблер видимости «инструментов админа» на витрине:
 * карандашей «Редактировать» на карточках/блоках, кнопок цвета фона
 * блока, тумблера скрытия категорий и т.п.
 *
 * По умолчанию инструменты включены. Значение хранится в localStorage,
 * чтобы переживать перезагрузку страницы (у нас нет серверного профиля
 * настроек для админа — этой единичной настройки достаточно local'а).
 */
const STORAGE_KEY = "admin-tools-visible"

interface AdminToolsContextValue {
  visible: boolean
  setVisible: (v: boolean) => void
  toggle: () => void
}

const AdminToolsContext = createContext<AdminToolsContextValue | null>(null)

export function AdminToolsProvider({ children }: { children: ReactNode }) {
  // На первом рендере (в т.ч. SSR) возвращаем `true`, чтобы не было
  // мигания: инструменты «включены → скрылись → включились». После
  // монтирования подхватываем реальное значение из localStorage.
  const [visible, setVisibleState] = useState<boolean>(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === "0" || raw === "false") setVisibleState(false)
    } catch {
      // localStorage может быть недоступен (private mode/Firefox strict)
    }
  }, [])

  const setVisible = useCallback((v: boolean) => {
    setVisibleState(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0")
    } catch {
      // no-op
    }
  }, [])

  const toggle = useCallback(() => setVisible(!visible), [visible, setVisible])

  return (
    <AdminToolsContext.Provider value={{ visible, setVisible, toggle }}>
      {children}
    </AdminToolsContext.Provider>
  )
}

export function useAdminTools(): AdminToolsContextValue {
  const ctx = useContext(AdminToolsContext)
  if (!ctx) {
    // Компонент вне провайдера — считаем инструменты видимыми, чтобы
    // ничего случайно не спрятать. Провайдер поднят в корневом layout,
    // так что это только safety net.
    return { visible: true, setVisible: () => {}, toggle: () => {} }
  }
  return ctx
}
