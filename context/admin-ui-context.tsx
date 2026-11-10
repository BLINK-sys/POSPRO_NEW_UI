"use client"

/**
 * Контекст admin-layout'а для флагов, которые отдельная страница может
 * выставить для подстройки layout'а. Пока одно поле — `hideHeader`:
 * позволяет странице (напр. /admin/deals/sources в режиме панели вариантов)
 * спрятать AdminHeaderNav чтобы освободить вертикальное место.
 *
 * Использование со страницы:
 *   const { setHideHeader } = useAdminUI()
 *   useEffect(() => { setHideHeader(true); return () => setHideHeader(false) }, [...])
 */

import { createContext, useContext, useState, type ReactNode } from "react"

interface AdminUIContextValue {
  hideHeader: boolean
  setHideHeader: (v: boolean) => void
  /** Схлопнут ли сайдбар. Раньше пробрасывалось в страницы через
   *  `React.cloneElement(children, { isSidebarCollapsed })`, но cloneElement
   *  сбивает intercepting routes (детали см. комментарий в
   *  app/admin/layout.tsx), поэтому перевели на контекст. */
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (v: boolean) => void
}

const AdminUIContext = createContext<AdminUIContextValue>({
  hideHeader: false,
  setHideHeader: () => {},
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: () => {},
})

export function AdminUIProvider({ children }: { children: ReactNode }) {
  const [hideHeader, setHideHeader] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  return (
    <AdminUIContext.Provider value={{
      hideHeader, setHideHeader,
      isSidebarCollapsed, setIsSidebarCollapsed,
    }}>
      {children}
    </AdminUIContext.Provider>
  )
}

export const useAdminUI = () => useContext(AdminUIContext)
