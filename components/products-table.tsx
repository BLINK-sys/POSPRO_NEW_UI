"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { type Product, deleteProduct, type ProductActionState } from "@/app/actions/products"
import type { Category } from "@/app/actions/categories"
import type { Brand, Status } from "@/app/actions/meta"
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
  initialProducts: Product[]
  categories: Category[]
  brands: Brand[]
  statuses: Status[]
  isSidebarCollapsed?: boolean
}

export function ProductsTable({
  initialProducts,
  categories,
  brands,
  statuses,
  isSidebarCollapsed = false,
}: ProductsTableProps) {
  const [allProducts] = useState<Product[]>(initialProducts) // Все товары (не изменяются)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  // Фильтры
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [brandFilter, setBrandFilter] = useState("all")
  const [visibilityFilter, setVisibilityFilter] = useState("all")
  const [quantityFilter, setQuantityFilter] = useState("all")

  // Пагинация
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [customItemsPerPage, setCustomItemsPerPage] = useState("")
  const [isCustomItemsPerPage, setIsCustomItemsPerPage] = useState(false)

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

  // Локальная фильтрация товаров
  const filteredProducts = useMemo(() => {
    let filtered = allProducts

    // Поиск по названию
    if (searchQuery.trim()) {
      filtered = filtered.filter((product) => product.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    // Фильтр по категории
    if (categoryFilter !== "all") {
      filtered = filtered.filter((product) => String(product.category_id) === categoryFilter)
    }

    // Фильтр по статусу
    if (statusFilter !== "all") {
      filtered = filtered.filter((product) => {
        const productStatusId =
          typeof product.status === "object"
            ? String(product.status.id)
            : product.status === "no"
              ? "no-status"
              : String(product.status)
        return productStatusId === statusFilter
      })
    }

    // Фильтр по бренду
    if (brandFilter !== "all") {
      filtered = filtered.filter((product) => product.brand === brandFilter)
    }

    // Фильтр по видимости
    if (visibilityFilter !== "all") {
      filtered = filtered.filter((product) => String(product.is_visible) === visibilityFilter)
    }

    // Фильтр по количеству
    if (quantityFilter !== "all") {
      if (quantityFilter === "true") {
        filtered = filtered.filter((product) => product.quantity > 0)
      } else {
        filtered = filtered.filter((product) => product.quantity === 0)
      }
    }

    return filtered
  }, [allProducts, searchQuery, categoryFilter, statusFilter, brandFilter, visibilityFilter, quantityFilter])

  // Пагинация
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProducts = filteredProducts.slice(startIndex, endIndex)

  // Сброс страницы при изменении фильтров
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, categoryFilter, statusFilter, brandFilter, visibilityFilter, quantityFilter, itemsPerPage])

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
    const result: ProductActionState = await deleteProduct(deletingProduct.id)
    if (result.success) {
      toast({ title: "Успех!", description: result.message })
      // Удаляем товар из локального состояния
      // Здесь нужно обновить allProducts, но так как это const, нужно перезагрузить страницу
      window.location.reload()
    } else {
      toast({ variant: "destructive", title: "Ошибка", description: result.error })
    }
    setDeletingProduct(null)
  }

  const handleProductUpdate = useCallback(() => {
    // Перезагружаем страницу для получения новых данных после создания
    window.location.reload()
  }, [])

  const handleEditProduct = (product: Product) => {
    router.push(`/admin/catalog/products/${product.slug}/edit`)
  }

  const handleItemsPerPageChange = (value: string) => {
    if (value === "custom") {
      setIsCustomItemsPerPage(true)
      return
    }
    setIsCustomItemsPerPage(false)
    setItemsPerPage(Number(value))
    setCustomItemsPerPage("")
  }

  const handleCustomItemsPerPageSubmit = () => {
    const customValue = Number(customItemsPerPage)
    if (customValue > 0 && customValue <= 1000) {
      setItemsPerPage(customValue)
      setIsCustomItemsPerPage(false)
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
          <SelectItem value="no">Без бренда</SelectItem>
          {brands.map((brand) => (
            <SelectItem key={brand.id} value={brand.name}>
              {brand.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Видимость" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
          <SelectItem value="true">Виден</SelectItem>
          <SelectItem value="false">Скрыт</SelectItem>
        </SelectContent>
      </Select>

      <Select value={quantityFilter} onValueChange={setQuantityFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Наличие" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
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
                    <SelectItem value="no">Без бренда</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.name}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Видимость" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="true">Виден</SelectItem>
                    <SelectItem value="false">Скрыт</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={quantityFilter} onValueChange={setQuantityFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Наличие" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
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
                Показано {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} из {filteredProducts.length}{" "}
                товаров
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
                    <TableHead>
                      <span className="sr-only">Действия</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProducts.length > 0 ? (
                    currentProducts.map((product) => {
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
                          <TableCell>{product.brand === "no" ? "Без бренда" : product.brand}</TableCell>
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
                      <TableCell colSpan={8} className="h-24 text-center">
                        {searchQuery ||
                        categoryFilter !== "all" ||
                        statusFilter !== "all" ||
                        brandFilter !== "all" ||
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
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {/* Показываем первую страницу */}
                    {currentPage > 3 && (
                      <>
                        <PaginationItem>
                          <PaginationLink onClick={() => setCurrentPage(1)} className="cursor-pointer">
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
                            onClick={() => setCurrentPage(pageNum)}
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
                          <PaginationLink onClick={() => setCurrentPage(totalPages)} className="cursor-pointer">
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
              Показано {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} из {filteredProducts.length}{" "}
              товаров
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
                  <TableHead>
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentProducts.length > 0 ? (
                  currentProducts.map((product) => {
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
                        <TableCell>{product.brand === "no" ? "Без бренда" : product.brand}</TableCell>
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
                    <TableCell colSpan={8} className="h-24 text-center">
                      {searchQuery ||
                      categoryFilter !== "all" ||
                      statusFilter !== "all" ||
                      brandFilter !== "all" ||
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
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {/* Показываем первую страницу */}
                  {currentPage > 3 && (
                    <>
                      <PaginationItem>
                        <PaginationLink onClick={() => setCurrentPage(1)} className="cursor-pointer">
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
                          onClick={() => setCurrentPage(pageNum)}
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
                        <PaginationLink onClick={() => setCurrentPage(totalPages)} className="cursor-pointer">
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
