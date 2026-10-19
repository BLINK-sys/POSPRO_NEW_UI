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
}

const AdminUIContext = createContext<AdminUIContextValue>({
  hideHeader: false,
  setHideHeader: () => {},
})

export function AdminUIProvider({ children }: { children: ReactNode }) {
  const [hideHeader, setHideHeader] = useState(false)
  return (
    <AdminUIContext.Provider value={{ hideHeader, setHideHeader }}>
      {children}
    </AdminUIContext.Provider>
  )
}

export const useAdminUI = () => useContext(AdminUIContext)
