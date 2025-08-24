"use client"

import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, ShoppingCart, Package, Users, Settings, Store, Tags, FileText, LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"

interface AdminSidebarProps {
  isCollapsed: boolean
}

export default function AdminSidebar({ isCollapsed }: AdminSidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const navItems = [
    { href: "/", icon: Store, label: "Страница магазина" },
    { href: "/admin", icon: LayoutDashboard, label: "Дашборд" },
    { href: "/admin/orders", icon: ShoppingCart, label: "Заказы" },
  ]

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === href
    }
    return pathname.startsWith(href) && href !== "/"
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-white dark:bg-gray-950 transition-all duration-300",
        isCollapsed ? "w-0 -translate-x-full" : "w-64 translate-x-0",
      )}
    >
      <div className="flex h-full max-h-screen flex-col gap-2 overflow-y-auto">
        {/* Header - на одном уровне с главным header */}
        <div className="flex h-14 shrink-0 items-center border-b px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="h-6 w-6 text-brand-yellow" />
            <span>Shop.co</span>
          </Link>
        </div>

        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                  isActive(href) && "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="catalog" className="border-b-0">
                <AccordionTrigger
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50 [&[data-state=open]>svg]:rotate-180",
                    (isActive("/admin/catalog/categories") || isActive("/admin/catalog/products")) &&
                      "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4" />
                    <span>Каталог</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8">
                  <Link
                    href="/admin/catalog/categories"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                      isActive("/admin/catalog/categories") && "text-gray-900 dark:text-gray-50",
                    )}
                  >
                    Категории
                  </Link>
                  <Link
                    href="/admin/catalog/products"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                      isActive("/admin/catalog/products") && "text-gray-900 dark:text-gray-50",
                    )}
                  >
                    Товары
                  </Link>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                isActive("/admin/users") && "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50",
              )}
            >
              <Users className="h-4 w-4" />
              {"Пользователи"}
            </Link>
            <Link
              href="/admin/brands-and-statuses"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                isActive("/admin/brands-and-statuses") &&
                  "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50",
              )}
            >
              <Tags className="h-4 w-4" />
              {"Бренды и Статусы"}
            </Link>
            <Link
              href="/admin/pages"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                isActive("/admin/pages") && "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50",
              )}
            >
              <FileText className="h-4 w-4" />
              {"Страницы"}
            </Link>
            <Link
              href="/admin/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                isActive("/admin/settings") && "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50",
              )}
            >
              <Settings className="h-4 w-4" />
              {"Настройки"}
            </Link>
          </nav>
        </div>
        <div className="mt-auto p-4 border-t shrink-0">
          <div className="flex items-center justify-between">
            {user && (
              <div className="flex flex-col overflow-hidden">
                <span className="font-semibold text-sm truncate">{user.full_name || user.ip_name || user.too_name || "Администратор"}</span>
                <span className="text-xs text-gray-500 truncate">{user.email}</span>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
