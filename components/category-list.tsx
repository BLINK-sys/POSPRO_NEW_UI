"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  type Category,
  type CategoryViewsPeriod,
  getCategories,
} from "@/app/actions/categories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Search, ChevronsDownUp, ChevronsUpDown, Shuffle, ArrowDownAZ } from "lucide-react"
import Link from "next/link"
import { CategoryTreeItem } from "./category-tree-item"
import { CategoryEditDialog } from "./category-edit-dialog"
import {
  CategorySortPanel,
  modeLabel,
  type SortModeAll,
} from "./category-sort-panel"
import { cn } from "@/lib/utils"

function flattenTree(tree: Category[]): Category[] {
  return tree.reduce<Category[]>((acc, category) => {
    acc.push(category)
    if (category.children && category.children.length > 0) {
      acc.push(...flattenTree(category.children))
    }
    return acc
  }, [])
}

export function CategoryList({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all")
  const [manualExpandedCategories, setManualExpandedCategories] = useState<Set<number>>(new Set())
  const [expandAllMode, setExpandAllMode] = useState<boolean | null>(null) // null = авто, true = все развернуты, false = все свернуты
  const [forceResetManual, setForceResetManual] = useState(0) // Для принудительного сброса ручного управления
  // Локальная сортировка (preview на клиенте) + флаг «включая подкатегории».
  // 'default' = порядок из БД (поле `order`). Прочие режимы применяются
  // сразу к отображению; кнопка «ОК» в боковой модалке записывает order в БД.
  const [sortMode, setSortMode] = useState<SortModeAll>("default")
  const [sortIncludeChildren, setSortIncludeChildren] = useState(false)
  const [sortPanelOpen, setSortPanelOpen] = useState(false)
  const [viewsPeriod, setViewsPeriod] = useState<CategoryViewsPeriod>("1m")
  // {category_id: views_count} — приходит из /admin/customer-activity/category-views-map.
  // Используется клиентским превью сортировки views_*; apply-sort на бэке
  // считает те же числа независимо.
  const [viewsMap, setViewsMap] = useState<Record<number, number>>({})
  // Deep-link: `?edit=<categoryId>` открывает модалку конкретной категории
  // (используется кнопкой «Открыть в админке» из карточек магазина).
  const searchParams = useSearchParams()
  const router = useRouter()
  const [editingCategoryFromUrl, setEditingCategoryFromUrl] = useState<Category | null>(null)

  const updateCategories = useCallback(async () => {
    const updatedCategories = await getCategories()
    setCategories(updatedCategories)
  }, [])

  const handleCategoryUpdate = useCallback(
    (updatedCategory?: Category) => {
      if (updatedCategory) {
        // Обновляем конкретную категорию с сохранением структуры дерева
        setCategories((prevCategories) => {
          const updateCategoryInTree = (categories: Category[]): Category[] => {
            return categories.map((cat) => {
              if (cat.id === updatedCategory.id) {
                // Сохраняем children из предыдущего состояния
                return { ...updatedCategory, children: cat.children }
              }
              if (cat.children && cat.children.length > 0) {
                return { ...cat, children: updateCategoryInTree(cat.children) }
              }
              return cat
            })
          }
          return updateCategoryInTree(prevCategories)
        })
      } else {
        // Полное обновление - получаем новую структуру с сервера
        updateCategories()
      }
    },
    [updateCategories],
  )

  const handleCategoryDelete = useCallback(() => {
    // При удалении обновляем весь список
    updateCategories()
  }, [updateCategories])

  const handleCategoryReorder = useCallback((optimisticUpdate?: (categories: Category[]) => Category[]) => {
    if (optimisticUpdate) {
      // Оптимистичное обновление для плавной анимации
      setCategories((prevCategories) => optimisticUpdate(prevCategories))
    } else {
      // После успешного ответа сервера или при ошибке обновляем весь список
      updateCategories()
    }
  }, [updateCategories])

  const flatCategories = flattenTree(categories)

  // Читаем `?edit=<id>` при первом рендере — открываем модалку категории.
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (!editId) return
    const cat = flatCategories.find((c) => c.id === Number(editId))
    if (cat) {
      setEditingCategoryFromUrl(cat)
      router.replace("/admin/catalog/categories", { scroll: false })
    }
  }, [searchParams, flatCategories, router])

  // Функция для определения категорий, которые должны быть развернуты
  const getCategoriesToExpand = useCallback(
    (cats: Category[], parentPath: number[] = []): Set<number> => {
      const expanded = new Set<number>()

      const traverse = (categoryList: Category[], path: number[] = []) => {
        for (const category of categoryList) {
          const currentPath = [...path, category.id]

          // Проверяем соответствие фильтрам
          const matchesSearch =
            !searchQuery ||
            category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            category.slug.toLowerCase().includes(searchQuery.toLowerCase())

          const matchesVisibility =
            visibilityFilter === "all" ||
            (visibilityFilter === "visible" && category.show_in_menu !== false) ||
            (visibilityFilter === "hidden" && category.show_in_menu === false)

          // Если категория соответствует фильтрам и она вложенная, разворачиваем всех её родителей
          if (matchesSearch && matchesVisibility && path.length > 0) {
            path.forEach((parentId) => expanded.add(parentId))
          }

          // Рекурсивно обрабатываем дочерние категории
          if (category.children && category.children.length > 0) {
            traverse(category.children, currentPath)
            
            // Если есть дочерние категории, соответствующие фильтрам, разворачиваем текущую
            const hasMatchingChildren = category.children.some((child) => {
              const childMatchesSearch =
                !searchQuery ||
                child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                child.slug.toLowerCase().includes(searchQuery.toLowerCase())
              const childMatchesVisibility =
                visibilityFilter === "all" ||
                (visibilityFilter === "visible" && child.show_in_menu !== false) ||
                (visibilityFilter === "hidden" && child.show_in_menu === false)
              return childMatchesSearch && childMatchesVisibility
            })

            if (hasMatchingChildren && path.length > 0) {
              path.forEach((parentId) => expanded.add(parentId))
            }
          }
        }
      }

      traverse(cats)
      return expanded
    },
    [searchQuery, visibilityFilter],
  )

  // Функция для определения категорий, которые должны быть подсвечены (только при поиске)
  const getCategoriesToHighlight = useCallback(
    (cats: Category[]): Set<number> => {
      const highlighted = new Set<number>()

      if (!searchQuery) return highlighted

      const searchLower = searchQuery.toLowerCase()

      const traverse = (categoryList: Category[]) => {
        for (const category of categoryList) {
          if (
            category.name.toLowerCase().includes(searchLower) ||
            category.slug.toLowerCase().includes(searchLower)
          ) {
            highlighted.add(category.id)
          }

          if (category.children && category.children.length > 0) {
            traverse(category.children)
          }
        }
      }

      traverse(cats)
      return highlighted
    },
    [searchQuery],
  )

  // Функция для фильтрации дерева категорий
  const filterCategories = useCallback(
    (cats: Category[]): Category[] => {
      const filtered: Category[] = []

      for (const category of cats) {
        // Проверяем соответствие фильтрам
        const matchesSearch =
          !searchQuery ||
          category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          category.slug.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesVisibility =
          visibilityFilter === "all" ||
          (visibilityFilter === "visible" && category.show_in_menu !== false) ||
          (visibilityFilter === "hidden" && category.show_in_menu === false)

        // Фильтруем дочерние категории
        const filteredChildren = category.children
          ? filterCategories(category.children)
          : []

        // Если категория или её дети соответствуют фильтрам, добавляем её
        const shouldInclude =
          (matchesSearch && matchesVisibility) || filteredChildren.length > 0

        if (shouldInclude) {
          filtered.push({
            ...category,
            children: filteredChildren.length > 0 ? filteredChildren : category.children,
          })
        }
      }

      return filtered
    },
    [searchQuery, visibilityFilter],
  )

  const filteredCategories = useMemo(
    () => filterCategories(categories),
    [categories, filterCategories],
  )

  // Client-side preview сортировки. Не сохраняет в БД — только меняет
  // отображение. Кнопка «Применить к сайту» вызывает applyCategorySort.
  const sortedFilteredCategories = useMemo(() => {
    if (sortMode === "default") return filteredCategories

    const sortByMode = (list: Category[]): Category[] => {
      const copy = [...list]
      copy.sort((a, b) => {
        switch (sortMode) {
          case "alpha_asc":
            return (a.name || "").localeCompare(b.name || "", "ru")
          case "alpha_desc":
            return (b.name || "").localeCompare(a.name || "", "ru")
          case "products_desc":
            return (b.products_count ?? 0) - (a.products_count ?? 0)
          case "products_asc":
            return (a.products_count ?? 0) - (b.products_count ?? 0)
          case "children_desc":
            return (b.children?.length ?? 0) - (a.children?.length ?? 0)
          case "views_desc":
            return (viewsMap[b.id] ?? 0) - (viewsMap[a.id] ?? 0)
          case "views_asc":
            return (viewsMap[a.id] ?? 0) - (viewsMap[b.id] ?? 0)
          default:
            return 0
        }
      })
      // Если включены подкатегории — сортируем детей рекурсивно
      if (sortIncludeChildren) {
        return copy.map((c) => ({
          ...c,
          children: c.children ? sortByMode(c.children) : c.children,
        }))
      }
      return copy
    }

    return sortByMode(filteredCategories)
  }, [filteredCategories, sortMode, sortIncludeChildren, viewsMap])

  const autoExpandedCategories = useMemo(
    () => getCategoriesToExpand(categories),
    [categories, getCategoriesToExpand],
  )

  // Получаем все ID категорий с детьми для режима "развернуть все"
  const allCategoriesWithChildren = useMemo(() => {
    const allWithChildren = new Set<number>()
    const collectIds = (cats: Category[]) => {
      for (const cat of cats) {
        if (cat.children && cat.children.length > 0) {
          allWithChildren.add(cat.id)
          collectIds(cat.children)
        }
      }
    }
    collectIds(categories)
    return allWithChildren
  }, [categories])

  // Объединяем автоматически развернутые категории (при фильтрах) с ручным управлением
  const expandedCategories = useMemo(() => {
    if (expandAllMode === true) {
      // Если режим "развернуть все", возвращаем все ID категорий с детьми
      return allCategoriesWithChildren
    } else if (expandAllMode === false) {
      // Если режим "свернуть все", возвращаем только автоматически развернутые (при фильтрах)
      // Если нет активных фильтров, возвращаем пустой Set
      if (!searchQuery && visibilityFilter === "all") {
        return new Set<number>()
      }
      return autoExpandedCategories
    } else {
      // Автоматический режим: объединяем автоматические и ручные
      // Но автоматические включаем только если есть активные фильтры
      const autoExpanded = (searchQuery || visibilityFilter !== "all") 
        ? autoExpandedCategories 
        : new Set<number>()
      return new Set([...autoExpanded, ...manualExpandedCategories])
    }
  }, [categories, autoExpandedCategories, manualExpandedCategories, expandAllMode, allCategoriesWithChildren, searchQuery, visibilityFilter])

  const handleExpandAll = () => {
    setExpandAllMode(true)
    setManualExpandedCategories(new Set())
    setForceResetManual((prev) => prev + 1) // Принудительно сбрасываем ручное управление
  }

  const handleCollapseAll = () => {
    setExpandAllMode(false)
    setManualExpandedCategories(new Set())
    setForceResetManual((prev) => prev + 1) // Принудительно сбрасываем ручное управление
  }

  const handleCategoryToggle = (categoryId: number, isExpanded: boolean) => {
    // При ручном переключении категории переходим в автоматический режим
    setExpandAllMode(null)
    setManualExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (isExpanded) {
        newSet.add(categoryId)
      } else {
        newSet.delete(categoryId)
      }
      return newSet
    })
    // НЕ используем forceResetManual здесь, чтобы не пересоздавать компоненты
  }

  const highlightedCategories = useMemo(
    () => getCategoriesToHighlight(categories),
    [categories, getCategoriesToHighlight],
  )

  // Общий класс для селектов — убирает focus-ring чтобы UI не мигал
  // жёлтой обводкой при переключении.
  const selectNoRingCls = "focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"

  return (
    <div className="space-y-4">
      {/* Строка 1: фильтры + кнопки. flex-wrap чтобы контент не вылезал за
          пределы при большом числе элементов. */}
      <div className="flex flex-wrap gap-x-4 gap-y-3 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Поиск */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
            />
          </div>

          {/* Фильтр по видимости */}
          <Select value={visibilityFilter} onValueChange={(value) => setVisibilityFilter(value as "all" | "visible" | "hidden")}>
            <SelectTrigger className={`w-[140px] ${selectNoRingCls}`}>
              <SelectValue placeholder="Видимость" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="visible">Виден</SelectItem>
              <SelectItem value="hidden">Скрыт</SelectItem>
            </SelectContent>
          </Select>

          {/* Сортировка: открывает боковую модалку справа. Там выбор режима,
              период посещаемости (для views_*), свитч «Включая подкатегории»
              и кнопка ОК, сохраняющая порядок в БД. Превью применяется сразу
              при клике по режиму — до того, как закрыть модалку. */}
          <Button
            variant="outline"
            onClick={() => setSortPanelOpen(true)}
            title="Сортировка категорий"
            className={cn(
              "w-[220px] justify-start rounded-lg",
              sortMode !== "default" && "border-brand-yellow bg-brand-yellow/10",
            )}
          >
            <ArrowDownAZ className="h-4 w-4 mr-2 shrink-0 text-gray-500" />
            <span className="truncate text-left flex-1">
              {sortMode === "default" ? "Сортировка" : modeLabel(sortMode)}
            </span>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            title="Развернуть все категории"
            className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
          >
            <ChevronsUpDown className="mr-2 h-4 w-4" />
            Развернуть все
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
            title="Свернуть все категории"
            className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
          >
            <ChevronsDownUp className="mr-2 h-4 w-4" />
            Свернуть все
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            title="Управление алиасами категорий (маппинг имён поставщиков → наши категории)"
            className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
          >
            <Link href="/admin/catalog/categories/aliases">
              <Shuffle className="mr-2 h-4 w-4" />
              Пути перенаправления категорий
            </Link>
          </Button>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Создать категорию
          </Button>
        </div>
      </div>

      {/* Тонкая строка-подсказка под шапкой: напоминает что сейчас показан
          клиентский превью, какой именно и с каким периодом. Управление —
          в модалке по кнопке «Сортировка» в шапке. */}
      {sortMode !== "default" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50/60 px-3 py-2 text-xs">
          <span className="font-medium text-gray-700">Превью на клиенте:</span>
          <span className="text-gray-700">{modeLabel(sortMode)}</span>
          {sortIncludeChildren && (
            <span className="text-gray-500">· включая подкатегории</span>
          )}
          {(sortMode === "views_desc" || sortMode === "views_asc") && (
            <span className="text-gray-500">· период {viewsPeriod}</span>
          )}
        </div>
      )}

      <motion.div
        className="rounded-xl border border-gray-200 bg-white p-4 space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        layout
      >
        {sortedFilteredCategories.map((category) => (
          <CategoryTreeItem
            key={`${category.id}-${forceResetManual}`}
            category={category}
            allCategories={flatCategories}
            rootCategories={categories}
            expandedCategories={expandedCategories}
            highlightedCategories={highlightedCategories}
            onToggle={(categoryId, isExpanded) => handleCategoryToggle(categoryId, isExpanded)}
            onUpdate={handleCategoryUpdate}
            onDelete={handleCategoryDelete}
            onReorder={handleCategoryReorder}
          />
        ))}
        {filteredCategories.length === 0 && categories.length > 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            {searchQuery || visibilityFilter !== "all"
              ? "Категории не найдены по заданным фильтрам."
              : "Категорий пока нет."}
          </p>
        )}
        {categories.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">Категорий пока нет.</p>
        )}
      </motion.div>
      {isCreateModalOpen && (
        <CategoryEditDialog
          allCategories={flatCategories}
          onClose={() => setCreateModalOpen(false)}
          onUpdate={handleCategoryUpdate}
        />
      )}
      {editingCategoryFromUrl && (
        <CategoryEditDialog
          category={editingCategoryFromUrl}
          allCategories={flatCategories}
          onClose={() => setEditingCategoryFromUrl(null)}
          onUpdate={handleCategoryUpdate}
        />
      )}

      <CategorySortPanel
        open={sortPanelOpen}
        onOpenChange={setSortPanelOpen}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        includeChildren={sortIncludeChildren}
        onIncludeChildrenChange={setSortIncludeChildren}
        viewsPeriod={viewsPeriod}
        onViewsPeriodChange={setViewsPeriod}
        onViewsMapLoaded={setViewsMap}
        onApplied={updateCategories}
      />
    </div>
  )
}
