"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { logoutAction } from "@/app/actions/auth"

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
  useEffect(() => {
    setUser(initialUser)
    setIsLoading(false)
  }, [initialUser])

  const handleLogout = useCallback(async () => {
    // Сбрасываем user ДО вызова server action — после await код не выполнится,
    // потому что logoutAction() вызывает redirect("/") на сервере
    setUser(null)
    await logoutAction()
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, logout: handleLogout, isLoading, setIsLoading }}>
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
