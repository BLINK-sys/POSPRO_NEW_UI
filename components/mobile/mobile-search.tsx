"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ArrowLeft, Search, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isWholesaleUser } from "@/lib/utils"
import { searchProducts, type ProductData } from "@/app/actions/public"
import { useAuth } from "@/context/auth-context"
import MobileProductCard from "@/components/mobile/mobile-product-card"

interface MobileSearchProps {
  open: boolean
  onClose: () => void
}

export default function MobileSearch({ open, onClose }: MobileSearchProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery("")
      setResults([])
    }
  }, [open])

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const data = await searchProducts(searchQuery.trim())
      setResults(data)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col">
      {/* Шапка поиска */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 dark:border-gray-800">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Поиск товаров..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            className="pl-9 pr-9 h-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-0 focus-visible:ring-0"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => {
                setQuery("")
                setResults([])
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Результаты */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Ничего не найдено
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            {results.map((product) => (
              <div key={product.id} onClick={onClose}>
                <MobileProductCard
                  product={product}
                  wholesaleUser={wholesaleUser}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && !query.trim() && (
          <div className="text-center py-12 text-gray-400">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Введите название товара</p>
          </div>
        )}
      </div>
    </div>
  )
}
