"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
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
import { getProducts } from "@/app/actions/products"
import { getBrands } from "@/app/actions/brands"
import { getBenefits } from "@/app/actions/benefits"
import { getSmallBanners } from "@/app/actions/small-banners"
import { getSuppliers } from "@/app/actions/suppliers"
import { ParentCategoryDialog } from "./parent-category-dialog"
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
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
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
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Выбрать все
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
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
              ) : (
                <div className="space-y-1 p-1">
                  {blockType === HOMEPAGE_BLOCK_TYPES.CATEGORIES
                    ? filteredElements.map((category) => (
                        <CategoryTreeItem
                          key={category.id}
                          category={category}
                          level={0}
                          selectedItems={selectedItems}
                          onToggleItem={handleToggleItem}
                          resolveImageUrl={resolveImageUrl}
                        />
                      ))
                    : filteredElements.map(renderElementItem)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
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
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
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
    [debouncedSearch, categoryFilter, brandFilter, supplierFilter, toast]
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

  const handleLoadMore = () => {
    if (page < totalPages && !isLoadingMore) {
      loadProducts(page + 1, true)
    }
  }

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

    return (
      <div
        key={product.id}
        className={cn(
          "relative border rounded-lg p-3 flex flex-col gap-3 bg-card hover:shadow-md transition cursor-pointer",
          isSelected ? "border-primary ring-2 ring-primary/40" : "border-border"
        )}
        onClick={() => handleProductToggle(product.id)}
      >
        <div
          className="absolute top-3 right-3 z-10 rounded bg-background/80 backdrop-blur px-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox checked={isSelected} onCheckedChange={() => handleProductToggle(product.id)} />
        </div>

        <div className="h-32 bg-muted/30 rounded.flex items-center justify-center overflow-hidden">
          <Image
            src={imageSrc}
            alt={product.name}
            width={160}
            height={160}
            className="object-contain max-h-full"
            unoptimized
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg"
            }}
          />
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium leading-tight line-clamp-2">{product.name}</div>
          {product.article && <div className="text-xs text-muted-foreground">Артикул: {product.article}</div>}
          {product.brand_info?.name && (
            <div className="text-xs text-muted-foreground">Бренд: {product.brand_info.name}</div>
          )}
          {typeof product.price === "number" && (
            <div className="text-sm.font-semibold">{priceFormatter.format(product.price)}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] h-[90vh] max-w-none max-h-none overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            Выбор товаров
            <Badge variant="outline">{blockTypeLabel}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-6 min-h-0">
          <div className="flex-shrink-0 w-full max-w-xs space-y-6 border-r pr-4 overflow-y-auto">
            <div className="space-y-2">
              <p className="text-sm font-medium">Поиск</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Введите название или артикул..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Категория</p>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
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
              <p className="text-sm.font-medium">Бренд</p>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Бренд" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все бренды</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={String(brand.id)}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Поставщик</p>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
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
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? "Загружаем товары..." : `Найдено товаров: ${totalCount}`}
              </div>
              <Badge variant="secondary">Выбрано: {selectedItems.length}</Badge>
            </div>

            <div className="flex-1 overflow-auto">
              {isLoading && products.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Загрузка товаров...
                </div>
              ) : products.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Товары не найдены
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 pb-4">
                  {products.map(renderProductCard)}
                </div>
              )}
            </div>

            {page < totalPages && (
              <div className="pt-4 border-t mt-4">
                <Button onClick={handleLoadMore} disabled={isLoadingMore} className="w-full" variant="outline">
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Загружаем ещё...
                    </>
                  ) : (
                    "Показать ещё"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <div className="mr-auto text-sm text-muted-foreground">Выбрано товаров: {selectedItems.length}</div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
        </DialogFooter>

        <ParentCategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          categories={categories}
          selectedCategoryId={categoryFilter}
          onSelect={(id) => setCategoryFilter(id)}
          title="Выберите категорию"
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
