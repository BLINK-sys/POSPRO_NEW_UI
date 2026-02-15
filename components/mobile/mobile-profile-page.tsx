"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ShoppingCart, Star, Package, History, Settings, LogOut, User, ChevronRight } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"

const menuItems = [
  { label: "Заказы", icon: Package, href: "/profile/orders" },
  { label: "История покупок", icon: History, href: "/profile/history" },
  { label: "Избранное", icon: Star, href: "/profile/favorites" },
  { label: "Корзина", icon: ShoppingCart, href: "/profile/cart" },
  { label: "Настройки", icon: Settings, href: "/profile/settings" },
]

export default function MobileProfilePage() {
  const { user, logout } = useAuth()
  const router = useRouter()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <User className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Войдите в аккаунт</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">Для доступа к профилю необходимо авторизоваться</p>
        <Link
          href="/auth"
          className="bg-brand-yellow text-black font-medium px-6 py-2.5 rounded-xl hover:bg-yellow-500 transition-colors"
        >
          Войти
        </Link>
      </div>
    )
  }

  const displayName = user.full_name || user.ip_name || user.too_name || user.email

  return (
    <div className="pb-4">
      {/* Карточка профиля */}
      <div className="px-4 py-6 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-yellow rounded-full flex items-center justify-center">
            <User className="h-7 w-7 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate">{displayName}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
          </div>
        </div>
      </div>

      {/* Меню */}
      <div className="divide-y divide-gray-100">
        {menuItems.map((item) => {
          // Для admin — не показываем клиентские пункты
          if (user.role !== "client" && ["Заказы", "История покупок", "Избранное", "Корзина"].includes(item.label)) {
            return null
          }

          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <Icon className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium flex-1">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          )
        })}

        {/* Админ панель */}
        {user.role === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <Settings className="h-5 w-5 text-brand-yellow" />
            <span className="text-sm font-medium flex-1 text-brand-yellow">Админ панель</span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        )}

        {/* Выход */}
        <button
          onClick={async () => { await logout(); router.push("/") }}
          className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors w-full text-left"
        >
          <LogOut className="h-5 w-5 text-red-500" />
          <span className="text-sm font-medium text-red-500">Выйти</span>
        </button>
      </div>
    </div>
  )
}
