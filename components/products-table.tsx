"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { type Product, type PaginatedProducts, deleteProduct } from "@/app/actions/products"
import type { Category } from "@/app/actions/categories"
import type { Brand, Status } from "@/app/actions/meta"
import type { Supplier } from "@/app/actions/suppliers"
import { API_BASE_URL } from "@/lib/api-address"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { MoreHorizontal, PlusCircle, Search, Filter } from "lucide-react"
import { ProductEditDialog } from "./product-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"

interface ProductsTableProps {
  initialData: PaginatedProducts
  categories: Category[]
  brands: Brand[]
  statuses: Status[]
  suppliers: Supplier[]
  isSidebarCollapsed?: boolean
}

export function ProductsTable({
  initialData,
  categories,
  brands,
  statuses,
  suppliers,
  isSidebarCollapsed = false,
}: ProductsTableProps) {
  const [products, setProducts] = useState<Product[]>(initialData.products)
  const [currentPage, setCurrentPage] = useState(initialData.page ?? 1)
  const [itemsPerPage, setItemsPerPage] = useState(initialData.per_page ?? 25)
  const [totalPages, setTotalPages] = useState(initialData.total_pages ?? 1)
  const [totalCount, setTotalCount] = useState(initialData.total_count ?? initialData.products.length)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  // Фильтры
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [brandFilter, setBrandFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [visibilityFilter, setVisibilityFilter] = useState("all")
  const [quantityFilter, setQuantityFilter] = useState("all")

  // Пагинация
  const [customItemsPerPage, setCustomItemsPerPage] = useState("")
  const [isCustomItemsPerPage, setIsCustomItemsPerPage] = useState(false)
  const requestIdRef = useRef(0)

  const { toast } = useToast()
  const router = useRouter()

  // Проверяем обновленный товар из sessionStorage при загрузке компонента
  useEffect(() => {
    const updatedProductData = sessionStorage.getItem("updatedProduct")
    if (updatedProductData) {
      try {
        const updatedProduct = JSON.parse(updatedProductData)
        // Обновляем товар в allProducts через setState
        sessionStorage.removeItem("updatedProduct")
        toast({ title: "Товар обновлен", description: "Данные товара успешно обновлены" })
      } catch (error) {
        console.error("Error parsing updated product data:", error)
      }
    }
  }, [toast])

  const loadProducts = useCallback(
    async (pageToLoad: number, perPageValue: number) => {
      const requestId = ++requestIdRef.current
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("page", String(pageToLoad))
        params.set("per_page", String(perPageValue))

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim())
        }
        if (categoryFilter !== "all") {
          params.set("category_id", categoryFilter)
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter)
        }
        if (brandFilter !== "all") {
          params.set("brand", brandFilter)
        }
        if (supplierFilter !== "all") {
          params.set("supplier", supplierFilter)
        }
        if (visibilityFilter !== "all") {
          params.set("visibility", visibilityFilter)
        }
        if (quantityFilter !== "all") {
          params.set("quantity", quantityFilter)
        }

        const response = await fetch(`/api/admin/products?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        if (requestIdRef.current === requestId) {
          setProducts(data.products ?? [])
          setCurrentPage(data.page ?? pageToLoad)
          setTotalPages(data.total_pages ?? 1)
          setTotalCount(data.total_count ?? (data.products?.length ?? 0))
          if (typeof data.per_page === "number" && data.per_page !== itemsPerPage) {
            setItemsPerPage(data.per_page)
          }
          setError(null)
        }
      } catch (err) {
        console.error("Error loading products:", err)
        if (requestIdRef.current === requestId) {
          const message =
            err instanceof Error ? err.message : "Не удалось загрузить товары"
          setError(message)
          toast({ variant: "destructive", title: "Ошибка", description: message })
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false)
        }
      }
    },
    [
      searchQuery,
      categoryFilter,
      statusFilter,
      brandFilter,
      supplierFilter,
      visibilityFilter,
      quantityFilter,
      itemsPerPage,
      toast,
    ]
  )

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + products.length, totalCount)

  useEffect(() => {
    setCurrentPage(1)
    loadProducts(1, itemsPerPage)
  }, [loadProducts, itemsPerPage])

  const getImageUrl = (url: string | null) => {
    if (!url) return "/placeholder.svg?width=40&height=40"
    if (url.startsWith("http")) return url
    return `${API_BASE_URL}${url}`
  }

  // Функция для получения статуса по ID
  const getStatusById = (statusId: string | Status): Status | null => {
    if (typeof statusId === "object") return statusId // Уже объект Status
    if (statusId === "no") return null // Нет статуса
    const status = statuses.find((s) => String(s.id) === String(statusId))
    return status || null
  }

  const handleDelete = async () => {
    if (!deletingProduct) return
    try {
      await deleteProduct(deletingProduct.id)
      toast({ title: "Успех!", description: "Товар удалён" })
      await loadProducts(currentPage, itemsPerPage)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось удалить товар"
      toast({ variant: "destructive", title: "Ошибка", description: message })
    } finally {
      setDeletingProduct(null)
    }
  }

  const handleProductUpdate = useCallback(() => {
    loadProducts(currentPage, itemsPerPage)
  }, [loadProducts, currentPage, itemsPerPage])

  const handleEditProduct = (product: Product) => {
    router.push(`/admin/catalog/products/${product.slug}/edit`)
  }

  const handleItemsPerPageChange = (value: string) => {
    if (value === "custom") {
      setIsCustomItemsPerPage(true)
      return
    }
    setIsCustomItemsPerPage(false)
    const numericValue = Number(value)
    setItemsPerPage(numericValue)
    setCustomItemsPerPage("")
    setCurrentPage(1)
  }

  const handleCustomItemsPerPageSubmit = () => {
    const customValue = Number(customItemsPerPage)
    if (customValue > 0 && customValue <= 1000) {
      setItemsPerPage(customValue)
      setIsCustomItemsPerPage(false)
      setCurrentPage(1)
    } else {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите число от 1 до 1000",
      })
    }
  }

  // Компонент фильтров
  const FiltersComponent = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Категория" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все категории</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={String(cat.id)}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          <SelectItem value="no-status">Без статуса</SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status.id} value={String(status.id)}>
              {status.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={brandFilter} onValueChange={setBrandFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Бренд" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все бренды</SelectItem>
          <SelectItem value="no-brand">Без бренда</SelectItem>
          {brands.map((brand) => (
            <SelectItem key={brand.id} value={String(brand.id)}>
              {brand.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={supplierFilter} onValueChange={setSupplierFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Поставщик" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все поставщики</SelectItem>
          <SelectItem value="no-supplier">Без поставщика</SelectItem>
          {suppliers.map((supplier) => (
            <SelectItem key={supplier.id} value={String(supplier.id)}>
              {supplier.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Видимость" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Любая видимость</SelectItem>
          <SelectItem value="true">Виден</SelectItem>
          <SelectItem value="false">Скрыт</SelectItem>
        </SelectContent>
      </Select>

      <Select value={quantityFilter} onValueChange={setQuantityFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Наличие" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Любое наличие</SelectItem>
          <SelectItem value="true">В наличии</SelectItem>
          <SelectItem value="false">Нет в наличии</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Строка поиска - всегда отдельно */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            type="search"
            placeholder="Поиск по названию товара..."
            className="w-full pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        <Button onClick={() => setIsCreating(true)} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Создать товар
        </Button>
      </div>

      {/* Фильтры - адаптивное расположение */}
      {isSidebarCollapsed ? (
        // Боковая панель закрыта - фильтры в карточке слева
        <div className="flex gap-6">
          <Card className="w-80 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Фильтры
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все категории</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="no-status">Без статуса</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={String(status.id)}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Бренд" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все бренды</SelectItem>
                    <SelectItem value="no-brand">Без бренда</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={String(brand.id)}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Поставщик" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все поставщики</SelectItem>
                    <SelectItem value="no-supplier">Без поставщика</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Видимость" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Любая видимость</SelectItem>
                    <SelectItem value="true">Виден</SelectItem>
                    <SelectItem value="false">Скрыт</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={quantityFilter} onValueChange={setQuantityFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Наличие" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Любое наличие</SelectItem>
                    <SelectItem value="true">В наличии</SelectItem>
                    <SelectItem value="false">Нет в наличии</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Контент таблицы */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Контроль количества товаров на странице */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                Показано {totalCount === 0 ? 0 : startIndex + 1}-{endIndex} из {totalCount} товаров
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Показывать по:</span>
                <Select
                  value={isCustomItemsPerPage ? "custom" : String(itemsPerPage)}
                  onValueChange={handleItemsPerPageChange}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="custom">Своё</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomItemsPerPage && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Кол-во"
                      className="w-20"
                      value={customItemsPerPage}
                      onChange={(e) => setCustomItemsPerPage(e.target.value)}
                      min="1"
                      max="1000"
                    />
                    <Button size="sm" onClick={handleCustomItemsPerPageSubmit}>
                      OK
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {isLoading && (
              <div className="text-sm text-gray-500">Загрузка товаров...</div>
            )}

            {/* Таблица товаров */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Изоб.</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Кол-во</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Видимость</TableHead>
                    <TableHead>Бренд</TableHead>
                    <TableHead className="w-[100px]">На сайте</TableHead>
                    <TableHead>
                      <span className="sr-only">Действия</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length > 0 ? (
                    products.map((product) => {
                      const status = getStatusById(product.status)
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <Image
                              src={getImageUrl(product.image) || "/placeholder.svg"}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="rounded-md object-cover"
                              unoptimized
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.price.toLocaleString("ru-RU")} ₸</TableCell>
                          <TableCell>{product.quantity}</TableCell>
                          <TableCell>
                            {status ? (
                              <span
                                className="px-2 py-1 rounded-full text-xs font-semibold"
                                style={{
                                  backgroundColor: status.background_color,
                                  color: status.text_color,
                                }}
                              >
                                {status.name}
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                                Без статуса
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{product.is_visible ? "Да" : "Нет"}</TableCell>
                          <TableCell>
                            {product.brand_info?.name || "Без бренда"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Открыть на сайте"
                              onClick={() => {
                                if (product.slug) {
                                  window.open(`/product/${product.slug}`, '_blank', 'noopener,noreferrer')
                                }
                              }}
                              disabled={!product.slug}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Действия</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                  Редактировать
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeletingProduct(product)} className="text-red-600">
                                  Удалить
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        {error
                          ? error
                          : searchQuery ||
                            categoryFilter !== "all" ||
                            statusFilter !== "all" ||
                            brandFilter !== "all" ||
                            supplierFilter !== "all" ||
                            visibilityFilter !== "all" ||
                            quantityFilter !== "all"
                            ? "Товары не найдены по заданным фильтрам."
                            : "Товары не найдены."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => {
                          if (currentPage > 1 && !isLoading) {
                            loadProducts(currentPage - 1, itemsPerPage)
                          }
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {/* Показываем первую страницу */}
                    {currentPage > 3 && (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            onClick={() => {
                              if (!isLoading) {
                                loadProducts(1, itemsPerPage)
                              }
                            }}
                            className="cursor-pointer"
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        {currentPage > 4 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                      </>
                    )}

                    {/* Показываем страницы вокруг текущей */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                      if (pageNum > totalPages) return null

                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => {
                              if (!isLoading) {
                                loadProducts(pageNum, itemsPerPage)
                              }
                            }}
                            isActive={pageNum === currentPage}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}

                    {/* Показываем последнюю страницу */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            onClick={() => {
                              if (!isLoading) {
                                loadProducts(totalPages, itemsPerPage)
                              }
                            }}
                            className="cursor-pointer"
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => {
                          if (currentPage < totalPages && !isLoading) {
                            loadProducts(currentPage + 1, itemsPerPage)
                          }
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Боковая панель раскрыта - фильтры под поиском
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Фильтры
            </h3>
            <FiltersComponent />
          </div>

          {/* Контроль количества товаров на странице */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              Показано {totalCount === 0 ? 0 : startIndex + 1}-{endIndex} из {totalCount} товаров
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Показывать по:</span>
              <Select
                value={isCustomItemsPerPage ? "custom" : String(itemsPerPage)}
                onValueChange={handleItemsPerPageChange}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="custom">Своё</SelectItem>
                </SelectContent>
              </Select>
              {isCustomItemsPerPage && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Кол-во"
                    className="w-20"
                    value={customItemsPerPage}
                    onChange={(e) => setCustomItemsPerPage(e.target.value)}
                    min="1"
                    max="1000"
                  />
                  <Button size="sm" onClick={handleCustomItemsPerPageSubmit}>
                    OK
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="text-sm text-gray-500">Загрузка товаров...</div>
          )}

          {/* Таблица товаров */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Изоб.</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Кол-во</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Видимость</TableHead>
                  <TableHead>Бренд</TableHead>
                  <TableHead className="w-[100px]">На сайте</TableHead>
                  <TableHead>
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length > 0 ? (
                  products.map((product) => {
                    const status = getStatusById(product.status)
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Image
                            src={getImageUrl(product.image) || "/placeholder.svg"}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded-md object-cover"
                            unoptimized
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.price.toLocaleString("ru-RU")} ₸</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>
                          {status ? (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor: status.background_color,
                                color: status.text_color,
                              }}
                            >
                              {status.name}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                              Без статуса
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{product.is_visible ? "Да" : "Нет"}</TableCell>
                        <TableCell>{product.brand_info?.name || "Без бренда"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Открыть на сайте"
                            onClick={() => {
                              if (product.slug) {
                                window.open(`/product/${product.slug}`, '_blank', 'noopener,noreferrer')
                              }
                            }}
                            disabled={!product.slug}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Действия</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeletingProduct(product)} className="text-red-600">
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      {error
                        ? error
                        : searchQuery ||
                          categoryFilter !== "all" ||
                          statusFilter !== "all" ||
                          brandFilter !== "all" ||
                          supplierFilter !== "all" ||
                          visibilityFilter !== "all" ||
                          quantityFilter !== "all"
                          ? "Товары не найдены по заданным фильтрам."
                          : "Товары не найдены."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => {
                        if (currentPage > 1 && !isLoading) {
                          loadProducts(currentPage - 1, itemsPerPage)
                        }
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {/* Показываем первую страницу */}
                  {currentPage > 3 && (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => {
                            if (!isLoading) {
                              loadProducts(1, itemsPerPage)
                            }
                          }}
                          className="cursor-pointer"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      {currentPage > 4 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                    </>
                  )}

                  {/* Показываем страницы вокруг текущей */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                    if (pageNum > totalPages) return null

                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => {
                            if (!isLoading) {
                              loadProducts(pageNum, itemsPerPage)
                            }
                          }}
                          isActive={pageNum === currentPage}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}

                  {/* Показываем последнюю страницу */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => {
                            if (!isLoading) {
                              loadProducts(totalPages, itemsPerPage)
                            }
                          }}
                          className="cursor-pointer"
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => {
                        if (currentPage < totalPages && !isLoading) {
                          loadProducts(currentPage + 1, itemsPerPage)
                        }
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {isCreating && (
        <ProductEditDialog
          categories={categories}
          brands={brands}
          statuses={statuses}
          suppliers={suppliers}
          onClose={() => setIsCreating(false)}
          onUpdate={handleProductUpdate}
        />
      )}
      <DeleteConfirmationDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        onConfirm={handleDelete}
        title={`Удалить товар "${deletingProduct?.name}"?`}
        description="Это действие нельзя будет отменить."
      />
    </div>
  )
}
