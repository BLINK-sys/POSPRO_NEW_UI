"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  Tags,
  FileText,
  LogOut,
  Truck,
  BookOpen,
  HardDrive,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"

interface AdminSidebarProps {
  isCollapsed: boolean
}

// Стиль пункта меню — мини-карточка с объёмом. На каждом пункте
// тень и рамка, hover слегка приподнимает карточку (translate-y-[-1px])
// и усиливает тень. Активный — насыщенно жёлтый, тень сильнее.
function navItemClass(active: boolean) {
  return cn(
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm bg-white",
    "transition-all duration-150 ease-out will-change-transform",
    active
      ? "bg-brand-yellow/25 text-black font-semibold border border-brand-yellow shadow-[0_4px_12px_rgba(250,204,21,0.35)]"
      : "text-gray-600 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.10)] hover:-translate-y-[1px] hover:text-gray-900 hover:border-gray-300",
  )
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
}) {
  return (
    <Link href={href} className={navItemClass(active)}>
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-black" : "text-gray-400 group-hover:text-gray-700")} />
      <span>{label}</span>
    </Link>
  )
}

function SubItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm bg-white",
        "transition-all duration-150 ease-out",
        active
          ? "text-black font-semibold bg-brand-yellow/25 border border-brand-yellow shadow-[0_3px_10px_rgba(250,204,21,0.30)]"
          : "text-gray-500 border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] hover:text-gray-800 hover:border-gray-300",
      )}
    >
      {label}
    </Link>
  )
}

export default function AdminSidebar({ isCollapsed }: AdminSidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  // Проверка доступа по полю access
  // Если access не задан (нет ограничений) — показываем всё
  const hasAccess = (key: string) => {
    if (!user) return false
    if (!user.access) return true
    return user.access[key] === true
  }

  // AI Консультант (раздел настроек) — гейт через API. Backend решает
  // на основе owner-email + opted-in списка системных пользователей.
  const [aiSettingsAccess, setAiSettingsAccess] = useState(false)
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

  // Нормализуем pathname: убираем trailing slash чтобы сравнения были устойчивы.
  // Для дашборда href="/admin" — должен быть активен только на ровно /admin
  // (а не на /admin/orders и т.п.). Для остальных — на точном совпадении или
  // подстраницах через "/" (так "/admin/orderXYZ" не зацепит "/admin/order").
  const normPath = pathname.replace(/\/$/, "") || "/"
  const isActive = (href: string) => {
    if (href === "/") return false  // ссылка на сайт — никогда не активна в админке
    if (normPath === href) return true
    if (href !== "/admin" && normPath.startsWith(href + "/")) return true
    return false
  }

  const catalogActive = isActive("/admin/catalog/categories") || isActive("/admin/catalog/products")
  const userName = user?.full_name || user?.ip_name || user?.too_name || "Администратор"

  return (
    <aside
      className={cn(
        // Минималистичный край — лёгкая граница и мягкая тень.
        "fixed inset-y-0 left-0 z-30 flex flex-col bg-white transition-all duration-300",
        "border-r border-gray-200 shadow-[2px_0_8px_rgba(0,0,0,0.04)]",
        isCollapsed ? "w-0 -translate-x-full" : "w-64 translate-x-0",
      )}
    >
      <div className="flex h-full max-h-screen flex-col overflow-y-auto">
        {/* Бренд-блок: на одном уровне с шапкой админки (h-16), с тонкой нижней границей */}
        <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-yellow flex items-center justify-center">
              <Package className="h-4 w-4 text-black" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm text-black">Админка</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400">PosPro</span>
            </div>
          </div>
        </div>

        {/* Меню. gap-2 даёт «воздух» между карточками-кнопками и подчёркивает
            их объёмность за счёт раздельных теней. */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {hasAccess("dashboard") && (
            <NavItem href="/admin" icon={LayoutDashboard} label="Дашборд" active={isActive("/admin")} />
          )}

          {hasAccess("orders") && (
            <NavItem href="/admin/orders" icon={ShoppingCart} label="Заказы" active={isActive("/admin/orders")} />
          )}

          {hasAccess("catalog") && (
            <Accordion type="single" collapsible className="w-full" defaultValue={catalogActive ? "catalog" : undefined}>
              <AccordionItem value="catalog" className="border-b-0">
                <AccordionTrigger
                  className={cn(
                    navItemClass(catalogActive),
                    // Убираем дефолтное подчёркивание hover у AccordionTrigger
                    // и переворот стрелки — оставляем только нашу стилизацию.
                    "hover:no-underline [&[data-state=open]>svg]:rotate-180",
                  )}
                >
                  <Package
                    className={cn(
                      "h-4 w-4 shrink-0",
                      catalogActive ? "text-black" : "text-gray-400 group-hover:text-gray-700",
                    )}
                  />
                  <span>Каталог</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-0 pl-5 space-y-1.5">
                  <SubItem
                    href="/admin/catalog/categories"
                    label="Категории"
                    active={isActive("/admin/catalog/categories")}
                  />
                  <SubItem
                    href="/admin/catalog/products"
                    label="Товары"
                    active={isActive("/admin/catalog/products")}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {hasAccess("users") && (
            <NavItem href="/admin/users" icon={Users} label="Пользователи" active={isActive("/admin/users")} />
          )}

          {(hasAccess("brands") || hasAccess("statuses")) && (
            <NavItem
              href="/admin/brands-and-statuses"
              icon={Tags}
              label="Бренды и Статусы"
              active={isActive("/admin/brands-and-statuses")}
            />
          )}

          {hasAccess("catalog") && (
            <NavItem href="/admin/drivers" icon={HardDrive} label="Драйверы" active={isActive("/admin/drivers")} />
          )}

          {hasAccess("catalog") && (
            <NavItem href="/admin/suppliers" icon={Truck} label="Поставщики" active={isActive("/admin/suppliers")} />
          )}

          {hasAccess("pages") && (
            <NavItem href="/admin/pages" icon={FileText} label="Страницы" active={isActive("/admin/pages")} />
          )}

          {hasAccess("settings") && (
            <NavItem href="/admin/settings" icon={Settings} label="Настройки" active={isActive("/admin/settings")} />
          )}

          {aiSettingsAccess && (
            <NavItem
              href="/admin/ai-consultant"
              icon={Sparkles}
              label="AI настройки"
              active={isActive("/admin/ai-consultant")}
            />
          )}

          <NavItem href="/admin/help" icon={BookOpen} label="Справка" active={isActive("/admin/help")} />
        </nav>

        {/* Карточка пользователя снизу. Чёткая рамка + объёмная тень,
            без аватара — только имя/email слева и иконка выйти справа. */}
        <div className="shrink-0 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 border border-gray-300 shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.14)] transition-shadow">
            {user && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <span className="font-medium text-sm truncate leading-tight">{userName}</span>
                <span className="text-xs text-gray-500 truncate leading-tight">{user.email}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-8 w-8 shrink-0 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
