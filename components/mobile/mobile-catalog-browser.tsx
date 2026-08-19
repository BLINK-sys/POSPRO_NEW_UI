"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight, Loader2, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCatalogCategories, CategoryData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"
import { motion, AnimatePresence } from "framer-motion"

interface MobileCatalogBrowserProps {
  open: boolean
  onClose: () => void
}

/**
 * Мобильный каталог — drill-down по карточкам. На каждом уровне: сетка
 * 2 колонки с картинкой и названием категории. Тап по карточке с детьми
 * — уходим на уровень глубже (кнопка «назад» в шапке возвращает). Тап
 * по листовой категории — открываем её страницу и закрываем каталог.
 *
 * Для промежуточных категорий (у которых есть свои товары И подкатегории)
 * добавлена карточка «Все в <название>» в начале уровня — даёт способ
 * посмотреть все товары ветки, не проваливаясь дальше.
 */
export default function MobileCatalogBrowser({ open, onClose }: MobileCatalogBrowserProps) {
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(true)
  const [stack, setStack] = useState<CategoryData[]>([])

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

  const currentParent = stack.length > 0 ? stack[stack.length - 1] : null
  const currentItems: CategoryData[] = currentParent?.children ?? categories

  const title = currentParent ? currentParent.name : "Каталог"

  const handleClose = () => {
    setStack([])
    onClose()
  }

  const handleBack = () => {
    setStack((prev) => prev.slice(0, -1))
  }

  const handleCardTap = (category: CategoryData) => {
    const hasChildren = category.children && category.children.length > 0
    if (hasChildren) {
      setStack((prev) => [...prev, category])
    } else {
      // Листовая — навигация закрывается через onClose ниже (клик по Link).
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bottom-16 z-[60] bg-white dark:bg-gray-950 flex flex-col">
      {/* Шапка: назад / название / закрыть */}
      <div className="flex items-center h-14 px-2 border-b border-gray-200 dark:border-gray-800">
        {currentParent ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={handleBack}
            aria-label="Назад"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="w-10 h-10" />
        )}
        <h2 className="flex-1 text-center text-base font-semibold truncate px-2">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={handleClose}
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Контент: анимируемая drill-down сетка */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentParent ? `p-${currentParent.id}` : "root"}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="p-3"
            >
              <div className="grid grid-cols-2 gap-3">
                {/* «Все в <категории>» — только когда мы внутри ветки
                    (есть родитель) и у самой ветки есть страница. */}
                {currentParent && (
                  <Link
                    href={`/category/${currentParent.slug}`}
                    onClick={handleClose}
                    className="block"
                  >
                    <div className="overflow-hidden rounded-xl bg-brand-yellow shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-shadow duration-200 aspect-[4/5] flex flex-col">
                      <div className="flex-1 flex items-center justify-center">
                        <LayoutGrid className="h-10 w-10 text-black" />
                      </div>
                      <div className="bg-black/90 text-white px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-white/60 leading-tight">
                            Все в разделе
                          </p>
                          <p className="text-xs font-bold truncate leading-tight">
                            {currentParent.name}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      </div>
                    </div>
                  </Link>
                )}

                {currentItems.map((category) => (
                  <CatalogTile
                    key={category.id}
                    category={category}
                    onDrill={() => handleCardTap(category)}
                    onLeafNavigate={handleClose}
                  />
                ))}
              </div>

              {currentItems.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  В этой категории нет подразделов
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

/**
 * Плитка категории. Если у категории есть children — тап уходит на
 * уровень глубже (обёртка button). Если нет — рендерим Link прямо на
 * страницу категории (правый клик / long-press откроют в новом табе,
 * привычная навигация браузера сохраняется).
 */
function CatalogTile({
  category,
  onDrill,
  onLeafNavigate,
}: {
  category: CategoryData
  onDrill: () => void
  onLeafNavigate: () => void
}) {
  const hasChildren = !!(category.children && category.children.length > 0)

  const inner = (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-shadow duration-200 aspect-[4/5] flex flex-col">
      <div className="flex-1 relative bg-white flex items-center justify-center p-2">
        {category.image_url ? (
          <div className="relative w-full h-full">
            <Image
              src={getImageUrl(category.image_url)}
              alt={category.name}
              fill
              className="object-contain"
              sizes="(max-width: 640px) 50vw, 200px"
            />
          </div>
        ) : (
          <span className="text-3xl text-gray-300 font-bold">
            {category.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="relative bg-brand-yellow px-3 py-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-gray-900 leading-tight line-clamp-2 flex-1 min-w-0 pr-4">
          {category.name}
        </p>
        <div className="absolute top-0 right-0 w-6 h-6 bg-gray-900 rounded-bl-lg flex items-center justify-center">
          <ChevronRight className="h-3 w-3 text-white" />
        </div>
      </div>
    </div>
  )

  if (hasChildren) {
    return (
      <button type="button" onClick={onDrill} className="block text-left">
        {inner}
      </button>
    )
  }

  return (
    <Link href={`/category/${category.slug}`} onClick={onLeafNavigate} className="block">
      {inner}
    </Link>
  )
}
