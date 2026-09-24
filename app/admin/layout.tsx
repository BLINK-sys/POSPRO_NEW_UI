"use client"

import React from "react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import AdminSidebar from "@/components/admin-sidebar"
import AdminHeaderNav from "@/components/admin-header-nav"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import {
  buildAdminSections,
  findSectionForPath,
  isCrmPath,
  type AccessCtx,
  type AdminMode,
} from "@/lib/admin-nav-config"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, refreshUser } = useAuth()

  const [authChecked, setAuthChecked] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Проверка авторизации при каждом переходе.
  useEffect(() => {
    const check = async () => {
      await refreshUser()
      setAuthChecked(true)
    }
    check()
  }, [pathname, refreshUser])

  useEffect(() => {
    if (authChecked && !user) router.replace("/")
  }, [authChecked, user, router])

  // Режим (crm | shop). При заходе в админку — всегда PosPro Shop,
  // Главная. Исключение: если URL уже указывает на CRM-раздел (deep-link),
  // выбираем CRM. localStorage-«запомнил-последний-режим» намеренно НЕ
  // используем — юзер после перерыва хочет видеть привычный Дашборд, а не
  // застрявшую с прошлого раза CRM.
  const [mode, setMode] = useState<AdminMode>(() => {
    if (typeof window === "undefined") return "shop"
    if (isCrmPath(window.location.pathname)) return "crm"
    return "shop"
  })

  // Async-гейты доступа (перенесены сюда из сайдбара, чтобы шапка и сайдбар
  // считали разделы из одного источника — иначе pill'ы разделов могли бы
  // разъехаться с содержимым сайдбара).
  const [aiSettingsAccess, setAiSettingsAccess] = useState(false)
  const [kpManagementAccess, setKpManagementAccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/ai-consultant/settings-admin-access", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAiSettingsAccess(Boolean(d?.has_access))
      })
      .catch(() => {
        if (!cancelled) setAiSettingsAccess(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.email])

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/kp-super-admin-access/check", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setKpManagementAccess(Boolean(d?.is_owner))
      })
      .catch(() => {
        if (!cancelled) setKpManagementAccess(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.email])

  const access: AccessCtx = useMemo(
    () => ({
      hasKey: (k: string) => {
        if (!user) return false
        if (!user.access) return true
        return user.access[k] === true
      },
      aiSettingsAccess,
      kpManagementAccess,
    }),
    [user, aiSettingsAccess, kpManagementAccess],
  )

  const sections = useMemo(() => buildAdminSections(mode, access), [mode, access])

  // Активный раздел — по URL. Если нашли — показываем его пункты. Если нет
  // (напр. асинхронные гейты ещё не догрузились и раздел временно скрыт) —
  // fallback на первый раздел, чтобы сайдбар не был пустым.
  const activeSection = useMemo(
    () => findSectionForPath(sections, pathname) ?? sections[0] ?? null,
    [sections, pathname],
  )

  // Sync mode ← path. Если открыт CRM-URL, а режим не CRM — переключаем.
  // Обратно (crm → shop) НЕ переключаем автоматом: shop-режим только по клику.
  //
  // Зависимость ТОЛЬКО от `pathname`. Если положить сюда `mode`, эффект
  // откатывает переключение при кликe «PosPro Shop» с CRM-страницы: в этот
  // момент `mode` уже стал "shop", а `pathname` ещё не обновился на "/admin"
  // (router.push асинхронный) — эффект видит CRM-путь + mode!=crm и
  // возвращает "crm". Приходилось кликать второй раз. Функциональный setMode
  // читает актуальное значение через prev, без замыкания на mode.
  useEffect(() => {
    if (isCrmPath(pathname)) {
      setMode((prev) => (prev !== "crm" ? "crm" : prev))
    }
  }, [pathname])

  // Авто-сворачивание сайдбара. Триггер — смена id активного раздела:
  //   items.length ≤ 1  → collapse (выбирать нечего)
  //   items.length > 1  → expand
  // ref-guard не даёт эффекту переопределять ручной toggle chevron'а
  // на одном и том же разделе.
  const prevSectionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeSection) return
    if (prevSectionIdRef.current === activeSection.id) return
    prevSectionIdRef.current = activeSection.id
    setIsSidebarCollapsed(activeSection.items.length <= 1)
  }, [activeSection?.id, activeSection?.items.length])

  const handleModeChange = (newMode: AdminMode) => {
    if (newMode === mode) return
    setMode(newMode)
    // Если текущий URL не в новом наборе секций — уводим на первый пункт
    // первого раздела нового режима.
    const nextSections = buildAdminSections(newMode, access)
    const existing = findSectionForPath(nextSections, pathname)
    if (!existing && nextSections[0]?.items[0]) {
      router.push(nextSections[0].items[0].href)
    }
  }

  const handleSectionSelect = (sectionId: string) => {
    const target = sections.find((s) => s.id === sectionId)
    if (!target?.items[0]) return
    // Всегда навигируем на первый пункт раздела — это описанное поведение
    // «при выборе раздела выбирается первый пункт». Сайдбар свернётся/
    // развернётся автоматически через useEffect выше.
    router.push(target.items[0].href)
  }

  if (!authChecked || !user) return null

  return (
    // overflow-x-hidden на самом внешнем flex — гарантирует что даже если
    // страница внутри main захочет отрисовать что-то шире viewport'а
    // (например Kanban с большим числом стадий), горизонтальный скролл
    // всей страницы не появится. Само содержимое пусть скроллит свою
    // внутреннюю область через `overflow-x-auto`.
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      <AdminSidebar isCollapsed={isSidebarCollapsed} section={activeSection} />
      {/* min-w-0 нужен flex-child'у иначе он растягивается под свой
          content и `overflow-x-hidden` выше становится бесполезен. */}
      <div className="relative flex-1 min-w-0">
        <AdminHeaderNav
          isCollapsed={isSidebarCollapsed}
          onCollapseToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          mode={mode}
          onModeChange={handleModeChange}
          sections={sections}
          activeSectionId={activeSection?.id ?? null}
          onSectionSelect={handleSectionSelect}
        />
        <main
          className={cn(
            "p-4 md:p-6 transition-all duration-300 min-w-0",
            isSidebarCollapsed ? "ml-0" : "ml-64",
          )}
        >
          {React.cloneElement(children as React.ReactElement, { isSidebarCollapsed })}
        </main>
      </div>
    </div>
  )
}
