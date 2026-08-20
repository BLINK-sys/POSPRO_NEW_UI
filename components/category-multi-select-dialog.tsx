"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronRight, Search } from "lucide-react"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type Category } from "@/app/actions/categories"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: Category[]
  selectedIds: number[]
  onConfirm: (ids: number[]) => void
  title?: string
}

/**
 * Multi-select дерева категорий. UI по образцу ParentCategoryDialog:
 * поиск, ScrollArea, две кнопки в футере. Отличие — чекбоксы у каждого
 * узла, выбор нескольких за раз, локальный temp-state (изменения
 * применяются только по «Выбрать»).
 */
export function CategoryMultiSelectDialog({
  open,
  onOpenChange,
  categories,
  selectedIds,
  onConfirm,
  title = "Выберите категории",
}: Props) {
  const [searchTerm, setSearchTerm] = useState("")
  const [tempSelected, setTempSelected] = useState<Set<number>>(new Set(selectedIds))

  useEffect(() => {
    if (open) setTempSelected(new Set(selectedIds))
  }, [open, selectedIds])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return categories
    const walk = (nodes: Category[]): Category[] => {
      const out: Category[] = []
      for (const n of nodes) {
        const kids = n.children ? walk(n.children) : []
        if (n.name.toLowerCase().includes(q) || kids.length > 0) {
          out.push({ ...n, children: kids })
        }
      }
      return out
    }
    return walk(categories)
  }, [categories, searchTerm])

  const toggle = (id: number) => {
    setTempSelected((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const handleConfirm = () => {
    onConfirm(Array.from(tempSelected))
    onOpenChange(false)
    setSearchTerm("")
  }

  const handleCancel = () => {
    setTempSelected(new Set(selectedIds))
    setSearchTerm("")
    onOpenChange(false)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setTempSelected(new Set(selectedIds))
      setSearchTerm("")
    }
    onOpenChange(v)
  }

  const searchActive = searchTerm.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Поиск категорий..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
            />
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground px-2 py-4">Ничего не найдено</p>
              ) : (
                <MultiTree
                  nodes={filtered}
                  selected={tempSelected}
                  onToggle={toggle}
                  autoExpand={searchActive}
                />
              )}
            </ScrollArea>
          </div>

          <div className="text-xs text-muted-foreground flex-shrink-0">
            Выбрано: <span className="font-medium">{tempSelected.size}</span>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
          >
            Отмена
          </Button>
          <Button
            onClick={handleConfirm}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
          >
            Выбрать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MultiTree({
  nodes, selected, onToggle, autoExpand, level = 0,
}: {
  nodes: Category[]
  selected: Set<number>
  onToggle: (id: number) => void
  autoExpand?: boolean
  level?: number
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((n) => (
        <MultiTreeNode
          key={n.id}
          node={n}
          selected={selected}
          onToggle={onToggle}
          autoExpand={autoExpand}
          level={level}
        />
      ))}
    </div>
  )
}

function MultiTreeNode({
  node, selected, onToggle, autoExpand, level = 0,
}: {
  node: Category
  selected: Set<number>
  onToggle: (id: number) => void
  autoExpand?: boolean
  level: number
}) {
  const [open, setOpen] = useState<boolean>(!!autoExpand)
  useEffect(() => { if (autoExpand) setOpen(true) }, [autoExpand])

  const hasChildren = !!node.children && node.children.length > 0
  const isSel = selected.has(node.id)

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50"
        style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}
      >
        <button
          type="button"
          className={cn("p-0.5 rounded hover:bg-gray-200", !hasChildren && "invisible")}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            isSel ? "bg-brand-yellow border-brand-yellow" : "border-gray-300"
          )}
        >
          {isSel && <Check className="h-3 w-3 text-black" />}
        </button>
        <span
          className={cn("text-sm cursor-pointer flex-1", isSel && "font-medium")}
          onClick={() => onToggle(node.id)}
        >
          {node.name}
        </span>
      </div>
      {open && hasChildren && (
        <MultiTree
          nodes={node.children!}
          selected={selected}
          onToggle={onToggle}
          autoExpand={autoExpand}
          level={level + 1}
        />
      )}
    </div>
  )
}
