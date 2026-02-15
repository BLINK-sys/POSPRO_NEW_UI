"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Search, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import MobileSearch from "./mobile-search"

export default function MobileHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)

  const isHomePage = pathname === "/" || pathname === ""
  const showBack = !isHomePage

  return (
    <>
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Левая часть: назад или поиск */}
          <div className="w-10 flex items-center">
            {showBack ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Центр: логотип */}
          <Link href="/" className="flex items-center">
            <Image
              src="/ui/big_logo.png"
              alt="PosPro"
              width={100}
              height={32}
              className="h-8 w-auto"
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

          {/* Правая часть: поиск (на подстраницах) + избранное */}
          <div className="flex items-center gap-1">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
            {user && user.role === "client" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => router.push("/profile/favorites")}
              >
                <Star className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Полноэкранный поиск */}
      <MobileSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
