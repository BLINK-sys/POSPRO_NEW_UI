"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home, LayoutGrid, ShoppingCart, Phone, User } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useCart } from "@/context/cart-context"
import { cn } from "@/lib/utils"
import MobileCatalogBrowser from "./mobile-catalog-browser"

interface NavItem {
  label: string
  icon: React.ElementType
  href?: string
  action?: "catalog"
}

const navItems: NavItem[] = [
  { label: "Главная", icon: Home, href: "/" },
  { label: "Каталог", icon: LayoutGrid, action: "catalog" },
  { label: "Корзина", icon: ShoppingCart, href: "/profile/cart" },
  { label: "Контакты", icon: Phone, href: "/contacts" },
  { label: "Профиль", icon: User, href: "/profile" },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { cartCount } = useCart()
  const [catalogOpen, setCatalogOpen] = useState(false)

  const isActive = (item: NavItem) => {
    if (item.action === "catalog") return catalogOpen
    if (item.href === "/") return pathname === "/" || pathname === ""
    return item.href ? pathname.startsWith(item.href) : false
  }

  const handleNavClick = (item: NavItem) => {
    if (item.action === "catalog") {
      setCatalogOpen(!catalogOpen)
    } else {
      setCatalogOpen(false)
    }
  }

  // Для неавторизованных — профиль ведёт на авторизацию
  const getHref = (item: NavItem) => {
    if (item.href === "/profile" && !user) return "/auth"
    return item.href
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const active = isActive(item)
            const Icon = item.icon
            const href = getHref(item)

            const content = (
              <div className="flex flex-col items-center gap-0.5 py-1 px-3">
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-colors",
                      active ? "text-brand-yellow" : "text-gray-500"
                    )}
                  />
                  {/* Badge для корзины */}
                  {item.label === "Корзина" && cartCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-brand-yellow text-black text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    active ? "text-brand-yellow" : "text-gray-500"
                  )}
                >
                  {item.label}
                </span>
              </div>
            )

            if (item.action) {
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  className="flex-1 flex justify-center"
                >
                  {content}
                </button>
              )
            }

            return (
              <Link
                key={item.label}
                href={href || "/"}
                className="flex-1 flex justify-center"
                onClick={() => handleNavClick(item)}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Каталог браузер */}
      <MobileCatalogBrowser open={catalogOpen} onClose={() => setCatalogOpen(false)} />
    </>
  )
}
