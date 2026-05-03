"use client"

import React from "react"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import AdminSidebar from "@/components/admin-sidebar"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, refreshUser } = useAuth()

  // Проверяем авторизацию при каждом переходе в админке
  useEffect(() => {
    const checkAuth = async () => {
      await refreshUser()
      setAuthChecked(true)
    }
    checkAuth()
  }, [pathname, refreshUser])

  // Редирект на главную если не авторизован
  useEffect(() => {
    if (authChecked && !user) {
      router.replace("/")
    }
  }, [authChecked, user, router])

  if (!authChecked || !user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar isCollapsed={isSidebarCollapsed} />
      <div className="relative flex-1">
        {/*
          Шапка админки. Минимализм: чистый белый фон, мягкая нижняя тень
          по всей длине, логотип по центру без карточки, справа кнопка
          «На сайт». Слева — округлая иконка collapse, ничего лишнего.
        */}
        <div className="sticky top-0 z-40 h-16 flex items-center px-4 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-gray-100"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>

          {/* Логотип ровно посередине шапки — просто, без обводок */}
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
            title="На сайт"
          >
            <Image
              src="/ui/big_logo.png"
              alt="PosPro"
              width={120}
              height={40}
              className="h-9 w-auto"
              priority
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = "none"
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = '<span class="text-xl font-bold text-brand-yellow">PosPro</span>'
                }
              }}
            />
          </Link>

          {/* Правый край: ссылка «Перейти на сайт» в стиле клиентских кнопок */}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                "bg-brand-yellow text-black hover:bg-yellow-500 transition-colors shadow-sm hover:shadow-md",
              )}
            >
              <ExternalLink className="h-4 w-4" />
              На сайт
            </Link>
          </div>
        </div>

        <main className={cn("p-4 md:p-6 transition-all duration-300", isSidebarCollapsed ? "ml-0" : "ml-64")}>
          {React.cloneElement(children as React.ReactElement, { isSidebarCollapsed })}
        </main>
      </div>
    </div>
  )
}
