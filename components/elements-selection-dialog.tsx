"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, ChevronRight, ChevronDown, Check, ChevronsUpDown } from "lucide-react"
import { getIcon } from "@/lib/icon-mapping"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { API_BASE_URL } from "@/lib/api-address"
import {
  HOMEPAGE_BLOCK_TYPES,
  HOMEPAGE_BLOCK_TYPE_LABELS,
} from "@/lib/constants"
import { getCategories } from "@/app/actions/categories"
import { getProducts, getProductsByIds } from "@/app/actions/products"
import { getBrands } from "@/app/actions/brands"
import { getBenefits } from "@/app/actions/benefits"
import { getSmallBanners } from "@/app/actions/small-banners"
import { getSectionCards } from "@/app/actions/section-cards"
import { getSuppliers } from "@/app/actions/suppliers"
import { ParentCategoryDialog } from "./parent-category-dialog"
import { BrandSelectDialog } from "./brand-select-dialog"
import { getImageUrl as buildImageUrl } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import type { Category } from "@/app/actions/categories"
import type { Brand } from "@/app/actions/brands"
import type { Supplier } from "@/app/actions/suppliers"
import type { Product } from "@/app/actions/products"

interface ElementsSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blockType: string
  selectedItems: number[]
  onItemsChange: (items: number[]) => void
}

interface CategoryTreeItemProps {
  category: any
  level: number
  selectedItems: number[]
  onToggleItem: (itemId: number) => void
  resolveImageUrl: (url: string | null | undefined) => string
}

function CategoryTreeItem({
  category,
  level,
  selectedItems,
  onToggleItem,
  resolveImageUrl,
}: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = category.children && category.children.length > 0
  const isSelected = selectedItems.includes(category.id)

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleSelect = () => {
    onToggleItem(category.id)
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
          isSelected && "bg-blue-100 dark:bg-blue-900"
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
      >
        <button
          onClick={handleToggle}
          className={cn(
            "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
            !hasChildren && "invisible"
          )}
        >
          {hasChildren && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
        </button>

        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 dark:border-gray-600"
          )}
          onClick={handleSelect}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

        <div className="flex items-center space-x-2 flex-1" onClick={handleSelect}>
          <Image
            src={category.image_url ? resolveImageUrl(category.image_url) : "/placeholder.svg"}
            alt={category.name || "Категория"}
            width={24}
            height={24}
            className="rounded object-cover"
            unoptimized
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg"
            }}
          />
          <span className="flex-1 text-sm">{category.name || "Без названия"}</span>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {category.children!.map((child: any) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              selectedItems={selectedItems}
              onToggleItem={onToggleItem}
              resolveImageUrl={resolveImageUrl}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const PRODUCTS_PER_PAGE = 50

function resolveImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string" || url.trim() === "") {
    return "/placeholder.svg"
  }

  const trimmedUrl = url.trim()

  if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
    return trimmedUrl
  }

  if (trimmedUrl.startsWith("/uploads/")) {
    return `${API_BASE_URL}${trimmedUrl}`
  }

  return `${API_BASE_URL}${trimmedUrl.startsWith("/") ? trimmedUrl : `/${trimmedUrl}`}`
}

function GenericElementsSelectionDialog({
  open,
  onOpenChange,
  blockType,
  selectedItems,
  onItemsChange,
}: ElementsSelectionDialogProps) {
  const [elements, setElements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()
  const blockTypeLabel = HOMEPAGE_BLOCK_TYPE_LABELS[blockType as keyof typeof HOMEPAGE_BLOCK_TYPE_LABELS]

  const loadElements = useCallback(async () => {
    try {
      setLoading(true)
      let data: any[] = []

      switch (blockType) {
        case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
          data = await getCategories()
          break
        case HOMEPAGE_BLOCK_TYPES.BRANDS:
          data = await getBrands()
          break
        case HOMEPAGE_BLOCK_TYPES.BENEFITS:
          data = await getBenefits()
          break
        case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
          data = await getSmallBanners()
          break
        case HOMEPAGE_BLOCK_TYPES.SECTION_CARDS:
          data = await getSectionCards()
          break
        default:
          data = []
      }

      setElements(data || [])
    } catch (error) {
      console.error("Error loading elements:", error)
      toast({
        title: "Ошибка",
        description: `Не удалось загрузить элементы: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
        variant: "destructive",
      })
      setElements([])
    } finally {
      setLoading(false)
    }
  }, [blockType, toast])

  useEffect(() => {
    if (open) {
      setSearchTerm("")
      loadElements()
    }
  }, [open, loadElements])

  const handleToggleItem = (itemId: number) => {
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter((id) => id !== itemId)
      : [...selectedItems, itemId]
    onItemsChange(newSelection)
  }

  const handleSelectAll = () => {
    const collectCategoryIds = (categories: any[]): number[] => {
      const ids: number[] = []
      for (const category of categories) {
        ids.push(category.id)
        if (category.children && category.children.length > 0) {
          ids.push(...collectCategoryIds(category.children))
        }
      }
      return ids
    }

    const allIds =
      blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES
        ? collectCategoryIds(elements)
        : elements.map((el) => el.id)

    onItemsChange(allIds)
  }

  const handleClearAll = () => {
    onItemsChange([])
  }

  const filteredElements = elements.filter((element) => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()

    if (blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES) {
      return element.name?.toLowerCase().includes(searchLower)
    }

    if (blockType === HOMEPAGE_BLOCK_TYPES.BRANDS) {
      return element.name?.toLowerCase().includes(searchLower)
    }

    if (blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS || blockType === HOMEPAGE_BLOCK_TYPES.INFO_CARDS) {
      return (
        element.title?.toLowerCase().includes(searchLower) ||
        (element.description && element.description.toLowerCase().includes(searchLower))
      )
    }

    if (blockType === HOMEPAGE_BLOCK_TYPES.SECTION_CARDS) {
      return (
        element.name?.toLowerCase().includes(searchLower) ||
        (element.description && element.description.toLowerCase().includes(searchLower))
      )
    }

    return true
  })

  const renderElementItem = (element: any) => {
    const isSelected = selectedItems.includes(element.id)

    const getImageSource = () => {
      switch (blockType) {
        case HOMEPAGE_BLOCK_TYPES.BENEFITS:
          return element.icon || element.image_url
        case HOMEPAGE_BLOCK_TYPES.BRANDS:
        case HOMEPAGE_BLOCK_TYPES.INFO_CARDS:
        case HOMEPAGE_BLOCK_TYPES.CATEGORIES:
        default:
          return element.image_url
      }
    }

    const imageSource = getImageSource()

    return (
      <div
        key={element.id}
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md.cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group.relative",
          isSelected && "bg-blue-100 dark:bg-blue-900"
        )}
        onClick={() => handleToggleItem(element.id)}
      >
        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 dark:border-gray-600"
          )}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

        {blockType === HOMEPAGE_BLOCK_TYPES.BENEFITS && element.icon ? (
          <div className="w-6 h-6 flex items-center justify-center">{getIcon(element.icon, "h-5 w-5 text-gray-600")}</div>
        ) : (
          <Image
            src={resolveImageUrl(imageSource)}
            alt={element.name || element.title || "Элемент"}
            width={24}
            height={24}
            className="rounded object-cover"
            unoptimized
            onError={(e) => {
              console.error(`Failed to load image for ${blockType}:`, imageSource)
              e.currentTarget.src = "/placeholder.svg"
            }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{element.name || element.title || "Без названия"}</div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col",
          // Полный экран — только для брендов (там 12 карточек в ряд
          // и нужен полный простор). Остальные типы — обычная модалка.
          blockType === HOMEPAGE_BLOCK_TYPES.BRANDS
            ? "w-screen h-screen max-w-none max-h-none rounded-none border-none top-0 left-0 translate-x-0 translate-y-0 p-6"
            : "max-w-2xl h-[80vh]",
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Выбор элементов
            <Badge variant="outline">{blockTypeLabel}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="space-y-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Поиск элементов..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow">
                Выбрать все
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll} className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow">
                Очистить
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Загрузка элементов...</span>
                </div>
              ) : filteredElements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? "Элементы не найдены" : "Элементы не найдены"}
                </div>
              ) : blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES ? (
                <div className="space-y-1 p-1">
                  {filteredElements.map((category) => (
                    <CategoryTreeItem
                      key={category.id}
                      category={category}
                      level={0}
                      selectedItems={selectedItems}
                      onToggleItem={handleToggleItem}
                      resolveImageUrl={resolveImageUrl}
                    />
                  ))}
                </div>
              ) : blockType === HOMEPAGE_BLOCK_TYPES.BRANDS ? (
                // Бренды — крупные квадратные плитки. Если у бренда
                // нет картинки, вместо неё крупное название по центру.
                <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 p-3 pb-6">
                  {filteredElements.map((el: any) => {
                    const isSel = selectedItems.includes(el.id)
                    const hasImg = !!el.image_url
                    const brandName = el.name || "Без названия"
                    return (
                      <div
                        key={el.id}
                        onClick={() => handleToggleItem(el.id)}
                        className={cn(
                          "group relative bg-white rounded-lg overflow-hidden transition-all duration-200 cursor-pointer border-2 shadow-[0_2px_6px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.22)] hover:scale-[1.03] hover:z-10",
                          isSel ? "border-brand-yellow ring-2 ring-brand-yellow/40" : "border-transparent",
                        )}
                      >
                        <div className="aspect-square relative bg-white p-2">
                          {hasImg ? (
                            <Image
                              src={resolveImageUrl(el.image_url)}
                              alt={brandName}
                              fill
                              unoptimized
                              className="object-contain p-2"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-center px-2">
                              <span className="text-sm font-bold text-gray-900 line-clamp-3">{brandName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : blockType === HOMEPAGE_BLOCK_TYPES.SECTION_CARDS ? (
                // Карточки разделов — крупные плитки сеткой (аналогично
                // товарам), а не узкая строка со скромной иконкой.
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 p-3 pb-6">
                  {filteredElements.map((el: any) => {
                    const isSel = selectedItems.includes(el.id)
                    return (
                      <div
                        key={el.id}
                        onClick={() => handleToggleItem(el.id)}
                        className={cn(
                          "group relative bg-white rounded-lg overflow-hidden transition-all duration-200 cursor-pointer border-2 shadow-[0_2px_6px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.22)] hover:scale-[1.03] hover:z-10",
                          isSel ? "border-brand-yellow ring-2 ring-brand-yellow/40" : "border-transparent",
                        )}
                      >
                        <div className="aspect-[4/3] relative bg-gray-100">
                          {el.image_url ? (
                            <Image
                              src={resolveImageUrl(el.image_url)}
                              alt={el.name || "Карточка"}
                              fill
                              unoptimized
                              className="object-fill"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              Нет изображения
                            </div>
                          )}
                        </div>
                        <div className="p-2 text-sm font-medium text-center text-gray-900 line-clamp-2 leading-tight">
                          {el.name || "Без названия"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-1 p-1">
                  {filteredElements.map(renderElementItem)}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="border-t pt-4 flex-shrink-0 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Выбрано элементов:</h4>
              <span className="text-sm text-muted-foreground">
                {selectedItems.length} из {elements.length}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow">
            Отмена
          </Button>
          <Button onClick={() => onOpenChange(false)} className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow">Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProductElementsSelectionDialog({
  open,
  onOpenChange,
  blockType,
  selectedItems,
  onItemsChange,
}: ElementsSelectionDialogProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [brandDialogOpen, setBrandDialogOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [priceFilter, setPriceFilter] = useState<string>("all")
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  // Отдельный массив полных объектов для «Показать только выбранные»:
  // грузим по ID точечно, чтобы не листать всю базу в поисках.
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filtersLoaded, setFiltersLoaded] = useState(false)
  const blockTypeLabel = HOMEPAGE_BLOCK_TYPE_LABELS[blockType as keyof typeof HOMEPAGE_BLOCK_TYPE_LABELS]

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  useEffect(() => {
    if (!open) {
      setSearchTerm("")
      setDebouncedSearch("")
      setCategoryFilter(null)
      setBrandFilter("all")
      setSupplierFilter("all")
      setPriceFilter("all")
      setShowSelectedOnly(false)
      setProducts([])
      setPage(1)
      setTotalPages(1)
      setTotalCount(0)
      return
    }

    let cancelled = false

    const loadFilters = async () => {
      if (filtersLoaded) return
      try {
        const [categoriesData, brandsData, suppliersData] = await Promise.all([
          getCategories(),
          getBrands(),
          getSuppliers(),
        ])

        if (!cancelled) {
          setCategories(categoriesData || [])
          setBrands(brandsData || [])
          setSuppliers(suppliersData || [])
          setFiltersLoaded(true)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading filters:", error)
          toast({
            title: "Ошибка",
            description: "Не удалось загрузить фильтры",
            variant: "destructive",
          })
        }
      }
    }

    loadFilters()

    return () => {
      cancelled = true
    }
  }, [open, filtersLoaded, toast])

  const findCategoryNameById = useCallback(
    (id: number | null): string | null => {
      if (id === null) return null
      const stack = [...categories]
      while (stack.length > 0) {
        const category = stack.pop()!
        if (category.id === id) {
          return category.name
        }
        if (category.children && category.children.length > 0) {
          stack.push(...category.children)
        }
      }
      return null
    },
    [categories]
  )

  const categoryFilterLabel = useMemo(() => {
    if (categoryFilter === null) {
      return "Все категории"
    }
    return findCategoryNameById(categoryFilter) ?? "Выберите категорию"
  }, [categoryFilter, findCategoryNameById])

  const loadProducts = useCallback(
    async (pageToLoad: number, append = false) => {
      try {
        if (pageToLoad === 1) {
          setIsLoading(true)
        } else {
          setIsLoadingMore(true)
        }

        const data = await getProducts({
          page: pageToLoad,
          perPage: PRODUCTS_PER_PAGE,
          search: debouncedSearch || undefined,
          categoryId: categoryFilter === null ? undefined : categoryFilter,
          brand: brandFilter === "all" ? undefined : brandFilter,
          supplier: supplierFilter === "all" ? undefined : supplierFilter,
          price: priceFilter === "all" ? undefined : priceFilter,
        })

        const fetchedProducts = data.products ?? []

        setProducts((prev) => {
          if (!append) {
            return fetchedProducts
          }
          const existingIds = new Set(prev.map((item) => item.id))
          const appended = fetchedProducts.filter((item) => !existingIds.has(item.id))
          return [...prev, ...appended]
        })

        setPage(data.page ?? pageToLoad)
        setTotalPages(data.total_pages ?? 1)
        setTotalCount(data.total_count ?? fetchedProducts.length)
      } catch (error) {
        console.error("Error loading products:", error)
        toast({
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось загрузить товары",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [debouncedSearch, categoryFilter, brandFilter, supplierFilter, priceFilter, toast]
  )

  useEffect(() => {
    if (!open) return
    loadProducts(1, false)
  }, [open, loadProducts])

  const handleProductToggle = useCallback(
    (productId: number) => {
      const newSelection = selectedItems.includes(productId)
        ? selectedItems.filter((id) => id !== productId)
        : [...selectedItems, productId]
      onItemsChange(newSelection)
    },
    [selectedItems, onItemsChange]
  )

  // При включённой галочке «только выбранные» — грузим ВЫБРАННЫЕ товары
  // отдельным запросом по id, чтобы не полагаться на текущую страницу
  // (иначе часть выбранных за пределами загруженного списка не покажется).
  useEffect(() => {
    if (!showSelectedOnly) return
    if (selectedItems.length === 0) {
      setSelectedProducts([])
      return
    }
    let cancelled = false
    setSelectedLoading(true)
    getProductsByIds(selectedItems)
      .then((res) => {
        if (cancelled) return
        // Сохраним порядок выбора юзера
        const map = new Map(res.map((p) => [p.id, p]))
        setSelectedProducts(selectedItems.map((id) => map.get(id)).filter(Boolean) as Product[])
      })
      .catch(() => { if (!cancelled) setSelectedProducts([]) })
      .finally(() => { if (!cancelled) setSelectedLoading(false) })
    return () => { cancelled = true }
  }, [showSelectedOnly, selectedItems])

  const handleLoadMore = useCallback(() => {
    if (page < totalPages && !isLoadingMore && !isLoading) {
      loadProducts(page + 1, true)
    }
  }, [page, totalPages, isLoadingMore, isLoading, loadProducts])

  // Infinite scroll — вместо кнопки «Показать ещё» ловим sentinel в
  // конце списка через IntersectionObserver. Порог 300px запаса
  // (rootMargin), чтобы подгружалось до достижения самого низа.
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handleLoadMore()
      },
      { root: scrollRootRef.current ?? null, rootMargin: "300px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleLoadMore, products.length])

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "KZT",
        maximumFractionDigits: 0,
      }),
    []
  )

  const renderProductCard = (product: Product) => {
    const isSelected = selectedItems.includes(product.id)
    const imageSrc = buildImageUrl(product.image || (product as any).image_url || null)

    // Стиль в тон клиентской ProductCard, но без hover-действий, статуса
    // и лишних полей — только фото / название / цена. Клик по карточке
    // = переключение выбора; чекбокс всегда виден в правом верхнем углу.
    return (
      <div
        key={product.id}
        onClick={() => handleProductToggle(product.id)}
        className={cn(
          "group relative h-full bg-white rounded-lg transition-all duration-200 cursor-pointer border-2",
          "shadow-[0_2px_6px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.22)] hover:scale-[1.04] hover:z-10",
          isSelected ? "border-brand-yellow ring-2 ring-brand-yellow/40" : "border-transparent",
        )}
      >
        <div className="p-1.5 flex flex-col h-full">
          <div className="aspect-square relative bg-white rounded mb-1 shrink-0">
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              unoptimized
              className="object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
            />
          </div>

          <div className="flex flex-col flex-1 gap-0.5 px-1 pb-1">
            <div className="text-[11px] text-gray-800 line-clamp-2 leading-tight">
              {product.name}
            </div>
            {typeof product.price === "number" && (
              <div className="text-[11px] font-bold text-red-600 leading-tight">
                {priceFormatter.format(product.price)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none border-none top-0 left-0 translate-x-0 translate-y-0 overflow-hidden flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            Выбор товаров
            <Badge variant="outline">{blockTypeLabel}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-6 min-h-0">
          <div className="flex-shrink-0 w-full max-w-xs border-r pr-4 flex flex-col min-h-0">
          <div className="flex-1 space-y-6 overflow-y-auto pr-1">
            <div className="space-y-2">
              <p className="text-sm font-medium">Поиск</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Введите название или артикул..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Категория</p>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                  onClick={() => setCategoryDialogOpen(true)}
                >
                  <span className="truncate text-left">{categoryFilterLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
                {categoryFilter !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start px-2 text-muted-foreground"
                    onClick={() => setCategoryFilter(null)}
                  >
                    Сбросить
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Бренд</p>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                  onClick={() => setBrandDialogOpen(true)}
                >
                  <span className="truncate text-left">
                    {brandFilter === "all"
                      ? "Все бренды"
                      : brands.find((b) => String(b.id) === brandFilter)?.name || "Бренд"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
                {brandFilter !== "all" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start px-2 text-muted-foreground"
                    onClick={() => setBrandFilter("all")}
                  >
                    Сбросить
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Поставщик</p>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300">
                  <SelectValue placeholder="Поставщик" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все поставщики</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={String(supplier.id)}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Цена</p>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300">
                  <SelectValue placeholder="Цена" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Любая</SelectItem>
                  <SelectItem value="gt0">Больше нуля</SelectItem>
                  <SelectItem value="eq0">Нулевая</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none py-1">
              <Checkbox
                checked={showSelectedOnly}
                onCheckedChange={(v) => setShowSelectedOnly(!!v)}
              />
              <span className="text-sm">Показать только выбранные</span>
            </label>
          </div>

          {/* Футер левой панели — фикс. кнопки Отмена/Готово вместо
              общей DialogFooter под всей модалкой. */}
          <div className="border-t pt-3 mt-3 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">
              Выбрано товаров: <span className="font-semibold text-foreground">{selectedItems.length}</span>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
            >
              Сохранить
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
            >
              Отмена
            </Button>
          </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {showSelectedOnly
                  ? `Показано выбранных: ${selectedProducts.length} из ${selectedItems.length}`
                  : isLoading
                    ? "Загружаем товары..."
                    : `Найдено товаров: ${totalCount}`}
              </div>
              <Badge variant="secondary">Выбрано: {selectedItems.length}</Badge>
            </div>

            <div ref={scrollRootRef} className="flex-1 overflow-auto p-2">
              {showSelectedOnly ? (
                selectedItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Ничего не выбрано
                  </div>
                ) : selectedLoading && selectedProducts.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Загружаем выбранные…
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 pb-4 px-1">
                    {selectedProducts.map(renderProductCard)}
                  </div>
                )
              ) : isLoading && products.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Загрузка товаров...
                </div>
              ) : products.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Товары не найдены
                </div>
              ) : (
                <>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 pb-4 px-1">
                    {products.map(renderProductCard)}
                  </div>
                  {/* Sentinel для infinite scroll — при появлении в
                      viewport подгружаем следующую страницу. Не показываем
                      в режиме «только выбранные» — там пагинации нет. */}
                  {page < totalPages && (
                    <div
                      ref={sentinelRef}
                      className="h-8 flex items-center justify-center text-xs text-muted-foreground"
                    >
                      {isLoadingMore && (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Подгружаем ещё…
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <ParentCategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          categories={categories}
          selectedCategoryId={categoryFilter}
          onSelect={(id) => setCategoryFilter(id)}
          title="Выберите категорию"
        />

        <BrandSelectDialog
          open={brandDialogOpen}
          onOpenChange={setBrandDialogOpen}
          brands={brands as any}
          selectedBrandId={brandFilter === "all" ? null : Number(brandFilter)}
          onSelect={(id) => setBrandFilter(id === null ? "all" : String(id))}
          title="Выберите бренд"
        />
      </DialogContent>
    </Dialog>
  )
}

export function ElementsSelectionDialog(props: ElementsSelectionDialogProps) {
  if (props.blockType === HOMEPAGE_BLOCK_TYPES.PRODUCTS) {
    return <ProductElementsSelectionDialog {...props} />
  }

  return <GenericElementsSelectionDialog {...props} />
}
