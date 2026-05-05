"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  logoutAction,
  refreshProfile,
  checkTokenValid,
  refreshAccessToken,
} from "@/app/actions/auth"

interface User {
  id: number
  email: string
  phone?: string
  organization_type?: "individual" | "ip" | "too"
  full_name?: string
  ip_name?: string
  too_name?: string
  delivery_address?: string
  iin?: string
  bin?: string
  role: "client" | "admin" | "system"
  is_wholesale?: boolean | string | number
  isWholesale?: boolean | string | number
  wholesale?: boolean | string | number
  [key: string]: any
}

interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: User | null
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  useEffect(() => {
    setUser(initialUser)
    setIsLoading(false)
  }, [initialUser])

  // Background refresh каждые 25 минут — access-токен живёт 30 мин,
  // обновляем за 5 мин до истечения. Если refresh-токен валидный —
  // юзер остаётся залогинен незаметно. Если refresh не прошёл —
  // setUser(null), фронт отрендерит как «не авторизован».
  //
  // 2-минутная checkTokenValid оставлена как safety net на случай
  // когда access всё-таки протух (clock-skew, pause/sleep вкладки и т.п.) —
  // тогда сначала пробуем refresh, и только если он тоже не прошёл —
  // вылогиниваем.
  useEffect(() => {
    if (!user) return

    const proactiveRefresh = setInterval(async () => {
      const ok = await refreshAccessToken()
      if (!ok) setUser(null)
    }, 25 * 60 * 1000)

    const reactiveCheck = setInterval(async () => {
      const valid = await checkTokenValid()
      if (valid) return
      // Access невалиден — попытка refresh
      const refreshed = await refreshAccessToken()
      if (!refreshed) setUser(null)
    }, 2 * 60 * 1000)

    return () => {
      clearInterval(proactiveRefresh)
      clearInterval(reactiveCheck)
    }
  }, [user])

  const handleLogout = useCallback(async () => {
    setUser(null)
    await logoutAction()
    router.push("/")
    router.refresh()
  }, [router])

  const handleRefreshUser = useCallback(async () => {
    const freshUser = await refreshProfile()
    if (freshUser) {
      setUser(freshUser as User)
    } else {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, logout: handleLogout, refreshUser: handleRefreshUser, isLoading, setIsLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
