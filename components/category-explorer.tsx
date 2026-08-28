"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"

import {
  type Category,
  getCategories,
} from "@/app/actions/categories"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Search, Shuffle } from "lucide-react"
import { CategoryEditDialog } from "./category-edit-dialog"
import { CategoryTreeItem } from "./category-tree-item"

function flattenTree(tree: Category[]): Category[] {
  return tree.reduce<Category[]>((acc, c) => {
    acc.push(c)
    if (c.children?.length) acc.push(...flattenTree(c.children))
    return acc
  }, [])
}

interface Props {
  initialCategories: Category[]
}

export function CategoryExplorer({ initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all")
  const [manualExpanded, setManualExpanded] = useState<Set<number>>(new Set())
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [creatingCategory, setCreatingCategory] = useState<{ parentId?: number } | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  const flatCategories = useMemo(() => flattenTree(categories), [categories])

  // Deep-link ?edit=<id>
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (!editId) return
    const cat = flatCategories.find((c) => c.id === Number(editId))
    if (cat) {
      setEditingCategory(cat)
      router.replace("/admin/catalog/categories", { scroll: false })
    }
  }, [searchParams, flatCategories, router])

  const reloadCategories = useCallback(async () => {
    const fresh = await getCategories()
    setCategories(fresh)
  }, [])

  const handleUpdate = useCallback(() => {
    reloadCategories()
  }, [reloadCategories])

  const handleToggle = useCallback((id: number, expanded: boolean) => {
    setManualExpanded((prev) => {
      const next = new Set(prev)
      if (expanded) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  // Фильтрация по поиску и видимости — рекурсивно, чтобы дети попадали
  // в результат если совпал ребёнок глубже, и родители тоже включались.
  const filterTree = useCallback((cats: Category[]): Category[] => {
    const q = searchQuery.trim().toLowerCase()
    const matchV = (c: Category) =>
      visibilityFilter === "all" ||
      (visibilityFilter === "visible" && c.show_in_menu !== false) ||
      (visibilityFilter === "hidden" && c.show_in_menu === false)
    const walk = (list: Category[]): Category[] => {
      const out: Category[] = []
      for (const c of list) {
        const filteredKids = c.children?.length ? walk(c.children) : []
        const matchQ = !q || c.name.toLowerCase().includes(q)
        if ((matchQ && matchV(c)) || filteredKids.length > 0) {
          out.push({ ...c, children: filteredKids.length ? filteredKids : c.children })
        }
      }
      return out
    }
    return walk(cats)
  }, [searchQuery, visibilityFilter])

  const filteredTree = useMemo(() => filterTree(categories), [categories, filterTree])

  // Авторазворачивание родителей, если фильтр совпал глубоко.
  const autoExpanded = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q && visibilityFilter === "all") return new Set<number>()
    const expanded = new Set<number>()
    const walk = (list: Category[], path: number[]) => {
      for (const c of list) {
        const matchQ = !q || c.name.toLowerCase().includes(q)
        const matchV =
          visibilityFilter === "all" ||
          (visibilityFilter === "visible" && c.show_in_menu !== false) ||
          (visibilityFilter === "hidden" && c.show_in_menu === false)
        if (matchQ && matchV && path.length) {
          path.forEach((id) => expanded.add(id))
        }
        if (c.children?.length) walk(c.children, [...path, c.id!])
      }
    }
    walk(categories, [])
    return expanded
  }, [categories, searchQuery, visibilityFilter])

  const expandedCategories = useMemo(
    () => new Set<number>([...autoExpanded, ...manualExpanded]),
    [autoExpanded, manualExpanded],
  )

  const selectNoRingCls =
    "focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Поиск по названию…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-9", selectNoRingCls, "focus-visible:border-gray-300")}
            />
          </div>
          <Select value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as any)}>
            <SelectTrigger className={cn("w-[140px]", selectNoRingCls)}>
              <SelectValue placeholder="Видимость" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="visible">Виден</SelectItem>
              <SelectItem value="hidden">Скрыт</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" title="Пути перенаправления категорий" className="rounded-lg">
            <Link href="/admin/catalog/categories/aliases">
              <Shuffle className="mr-2 h-4 w-4" />
              Пути перенаправления категорий
            </Link>
          </Button>
          <Button
            onClick={() => setCreatingCategory({})}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)]"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Создать категорию
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {filteredTree.map((c) => (
          <CategoryTreeItem
            key={c.id}
            category={c}
            allCategories={flatCategories}
            rootCategories={filteredTree}
            expandedCategories={expandedCategories}
            onToggle={handleToggle}
            onUpdate={handleUpdate}
            onDelete={handleUpdate}
            onReorder={handleUpdate}
          />
        ))}
        {filteredTree.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            {searchQuery || visibilityFilter !== "all"
              ? "Категории не найдены по заданным фильтрам."
              : "Категорий пока нет."}
          </p>
        )}
      </div>

      {editingCategory && (
        <CategoryEditDialog
          category={editingCategory}
          allCategories={flatCategories}
          onClose={() => setEditingCategory(null)}
          onUpdate={handleUpdate}
        />
      )}
      {creatingCategory && (
        <CategoryEditDialog
          allCategories={flatCategories}
          parentId={creatingCategory.parentId}
          onClose={() => setCreatingCategory(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
