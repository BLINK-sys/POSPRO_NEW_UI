"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, Package } from "lucide-react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import type { AdminNavItem, AdminNavSection } from "@/lib/admin-nav-config"

interface AdminSidebarProps {
  isCollapsed: boolean
  /** Активный раздел (из шапки). Если null — сайдбар не рисует список. */
  section: AdminNavSection | null
}

function navItemClass(active: boolean) {
  return cn(
    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm bg-white",
    "transition-all duration-150 ease-out will-change-transform",
    active
      ? "bg-brand-yellow/25 text-black font-semibold border border-brand-yellow shadow-[0_4px_12px_rgba(250,204,21,0.35)]"
      : "text-gray-600 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.10)] hover:-translate-y-[1px] hover:text-gray-900 hover:border-gray-300",
  )
}

function subItemClass(active: boolean) {
  return cn(
    "block rounded-md px-2.5 py-1.5 text-sm bg-white transition-all duration-150 ease-out",
    active
      ? "text-black font-semibold bg-brand-yellow/25 border border-brand-yellow shadow-[0_3px_10px_rgba(250,204,21,0.30)]"
      : "text-gray-500 border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] hover:text-gray-800 hover:border-gray-300",
  )
}

export default function AdminSidebar({ isCollapsed, section }: AdminSidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const normPath = pathname.replace(/\/$/, "") || "/"
  const isActive = (href: string) => {
    if (href === "/") return false
    if (normPath === href) return true
    if (href !== "/admin" && normPath.startsWith(href + "/")) return true
    return false
  }
  const isChildActive = (item: AdminNavItem) => (item.children ?? []).some((c) => isActive(c.href))

  const userName = user?.full_name || user?.ip_name || user?.too_name || "Администратор"

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col bg-white transition-all duration-300",
        "border-r border-gray-200 shadow-[2px_0_8px_rgba(0,0,0,0.04)]",
        isCollapsed ? "w-0 -translate-x-full" : "w-64 translate-x-0",
      )}
    >
      <div className="flex h-full max-h-screen flex-col overflow-y-auto">
        {/* Бренд-блок — «Админка» + название текущего раздела как sub-label. */}
        <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 shrink-0 rounded-lg bg-brand-yellow flex items-center justify-center">
              <Package className="h-4 w-4 text-black" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-semibold text-sm text-black">Админка</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 truncate">
                {section?.label ?? "PosPro"}
              </span>
            </div>
          </div>
        </div>

        {/* Пункты активного раздела. Для пунктов с children (Каталог)
            родитель — это тоже link (ведёт на первый child); дети рендерятся
            inline с левым отступом, без accordion — сайдбар и так контекстный,
            прятать нечего. */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {section?.items.map((item) => {
            const active = isActive(item.href) || isChildActive(item)
            const Icon = item.icon
            if (item.children && item.children.length > 0) {
              return (
                <div key={item.href + item.label} className="space-y-1">
                  <Link href={item.href} className={navItemClass(active)}>
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-black" : "text-gray-400 group-hover:text-gray-700",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                  <div className="pl-4 space-y-1">
                    {item.children.map((child) => (
                      <Link key={child.href} href={child.href} className={subItemClass(isActive(child.href))}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            }
            return (
              <Link key={item.href} href={item.href} className={navItemClass(active)}>
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-black" : "text-gray-400 group-hover:text-gray-700",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Карточка пользователя */}
        <div className="shrink-0 p-2">
          <div className="flex items-center gap-2 rounded-lg bg-white p-2 border border-gray-300 shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.14)] transition-shadow">
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
              className="h-7 w-7 shrink-0 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900"
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
