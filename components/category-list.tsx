"use client"

import { useState, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { type Category, getCategories } from "@/app/actions/categories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Search, ChevronsDownUp, ChevronsUpDown } from "lucide-react"
import { CategoryTreeItem } from "./category-tree-item"
import { CategoryEditDialog } from "./category-edit-dialog"

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-4 items-center w-full sm:w-auto">
          {/* Поиск */}
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Фильтр по видимости */}
          <Select value={visibilityFilter} onValueChange={(value) => setVisibilityFilter(value as "all" | "visible" | "hidden")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Видимость" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="visible">Виден</SelectItem>
              <SelectItem value="hidden">Скрыт</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            title="Развернуть все категории"
          >
            <ChevronsUpDown className="mr-2 h-4 w-4" />
            Развернуть все
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
            title="Свернуть все категории"
          >
            <ChevronsDownUp className="mr-2 h-4 w-4" />
            Свернуть все
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Создать категорию
          </Button>
        </div>
      </div>
      <motion.div 
        className="rounded-lg border p-4 space-y-2 bg-gray-50/50 dark:bg-gray-800/20"
        layout
      >
        {filteredCategories.map((category) => (
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
    </div>
  )
}
