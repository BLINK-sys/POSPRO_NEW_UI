"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { X, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCatalogCategories, CategoryData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"
import { motion, AnimatePresence } from "framer-motion"

interface MobileCatalogBrowserProps {
  open: boolean
  onClose: () => void
}

export default function MobileCatalogBrowser({ open, onClose }: MobileCatalogBrowserProps) {
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true)
        const data = await getCatalogCategories()
        setCategories(data)
      } catch (error) {
        console.error("Error loading categories:", error)
      } finally {
        setLoading(false)
      }
    }
    if (open && categories.length === 0) {
      loadCategories()
    }
  }, [open, categories.length])

  const toggleExpand = (categoryId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const handleClose = () => {
    setExpandedIds(new Set())
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bottom-16 z-[60] bg-white dark:bg-gray-950 flex flex-col">
      {/* Шапка */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold">Каталог</h2>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {categories.map((category) => {
              const hasChildren = category.children && category.children.length > 0
              const isExpanded = expandedIds.has(category.id)

              return (
                <div key={category.id}>
                  <div className="flex items-center">
                    {/* Ссылка на категорию */}
                    <Link
                      href={`/category/${category.slug}`}
                      onClick={handleClose}
                      className="flex-1 flex items-center gap-3 px-4 py-3"
                    >
                      <div className="w-12 h-12 relative bg-gray-50 dark:bg-gray-900 rounded-lg shrink-0 overflow-hidden flex items-center justify-center">
                        {category.image_url ? (
                          <Image
                            src={getImageUrl(category.image_url)}
                            alt={category.name}
                            fill
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="text-lg font-semibold text-gray-400">
                            {category.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
                        {category.name}
                      </span>
                    </Link>

                    {/* Кнопка раскрытия подкатегорий */}
                    {hasChildren && (
                      <button
                        onClick={() => toggleExpand(category.id)}
                        className="w-12 h-12 flex items-center justify-center mr-2 rounded-lg bg-brand-yellow hover:bg-yellow-500 transition-colors"
                      >
                        <ChevronDown
                          className={`h-5 w-5 text-black transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Подкатегории (аккордеон) */}
                  <AnimatePresence>
                    {hasChildren && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-gray-50 dark:bg-gray-900"
                      >
                        {category.children?.map((child) => (
                          <Link
                            key={child.id}
                            href={`/category/${child.slug}`}
                            onClick={handleClose}
                            className="flex items-center gap-3 pl-12 pr-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="w-8 h-8 relative bg-white dark:bg-gray-800 rounded-md shrink-0 overflow-hidden flex items-center justify-center">
                              {child.image_url ? (
                                <Image
                                  src={getImageUrl(child.image_url)}
                                  alt={child.name}
                                  fill
                                  className="object-contain p-0.5"
                                />
                              ) : (
                                <span className="text-xs font-semibold text-gray-400">
                                  {child.name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {child.name}
                              </span>
                              {child.product_count !== undefined && child.product_count > 0 && (
                                <span className="text-xs text-gray-400 ml-2">
                                  ({child.product_count})
                                </span>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
