"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, Package, Sparkles, Tag, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import CompactProductPicker from "@/components/compact-product-picker"
import SelectedElementsDisplay from "@/components/selected-elements-display"
import { HOMEPAGE_BLOCK_TYPES } from "@/lib/constants"
import { getCategories, type Category } from "@/app/actions/categories"
import {
  createHeaderMenuItem,
  updateHeaderMenuItem,
  type HeaderMenuItem,
} from "@/app/actions/header-settings"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: HeaderMenuItem | null
  // Если задан — новый пункт создаётся ВНУТРИ этого parent'а
  parentId?: number | null
  onSaved: () => void | Promise<void>
}

const SOFT_INPUT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)]"

// Плоский поиск по имени с сохранением пути «Родитель / Ребёнок»
// (используется только для режима поиска — вне поиска показываем дерево).
function flattenTree(nodes: Category[], parentPath: string = ""): Array<{ id: number; label: string; name: string }> {
  const out: Array<{ id: number; label: string; name: string }> = []
  for (const n of nodes) {
    const label = parentPath ? `${parentPath} / ${n.name}` : n.name
    out.push({ id: n.id, label, name: n.name })
    if (n.children && n.children.length) {
      out.push(...flattenTree(n.children, label))
    }
  }
  return out
}

// Имя категории по id (для live-preview кнопки — не хочется тащить всё
// дерево в flat каждый ресайз preview).
function findCategoryName(nodes: Category[], id: number): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.name
    if (n.children && n.children.length) {
      const r = findCategoryName(n.children, id)
      if (r) return r
    }
  }
  return null
}

// Собирает id всех предков для заданного leaf-id (нужно, чтобы при
// открытии диалога для существующей категории раскрыть путь к ней).
function findAncestors(nodes: Category[], targetId: number, acc: number[] = []): number[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return acc
    if (n.children && n.children.length) {
      const r = findAncestors(n.children, targetId, [...acc, n.id])
      if (r) return r
    }
  }
  return null
}

// Рекурсивный рендер узла дерева с раскрытием.
// mode='single' — radio-выбор одной (для edit); 'multi' — checkbox (для create).
function TreeNode({
  node, level, expanded, onToggle, mode,
  selectedId, onSelectSingle,
  selectedIds, onToggleMulti,
}: {
  node: Category
  level: number
  expanded: Set<number>
  onToggle: (id: number) => void
  mode: "single" | "multi"
  selectedId?: number | null
  onSelectSingle?: (id: number) => void
  selectedIds?: Set<number>
  onToggleMulti?: (id: number) => void
}) {
  const hasChildren = !!(node.children && node.children.length)
  const isOpen = expanded.has(node.id)
  const isSelected = mode === "single"
    ? selectedId === node.id
    : !!selectedIds?.has(node.id)
  const handleClick = () => {
    if (mode === "single") onSelectSingle?.(node.id)
    else onToggleMulti?.(node.id)
  }
  return (
    <li>
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 py-1 pr-2 rounded cursor-pointer text-sm transition-colors",
          isSelected ? "bg-brand-yellow text-black font-medium" : "hover:bg-gray-50 text-gray-800",
        )}
        style={{ paddingLeft: `${level * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id) }}
            className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-black/10"
            title={isOpen ? "Свернуть" : "Развернуть"}
          >
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}
        <input
          type={mode === "single" ? "radio" : "checkbox"}
          checked={isSelected}
          onChange={handleClick}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
        <span className="truncate">{node.name}</span>
      </div>
      {hasChildren && isOpen && (
        <ul>
          {node.children!.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              mode={mode}
              selectedId={selectedId}
              onSelectSingle={onSelectSingle}
              selectedIds={selectedIds}
              onToggleMulti={onToggleMulti}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function HeaderMenuItemDialog({ open, onOpenChange, item, parentId, onSaved }: Props) {
  const { toast } = useToast()
  const isEdit = !!item

  const [kind, setKind] = useState<"category" | "custom">("custom")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  // Множественный выбор категорий — только при СОЗДАНИИ, каждая выбранная
  // становится отдельным пунктом (batch create). При редактировании
  // используется одинарный categoryId.
  const [categoryIds, setCategoryIds] = useState<Set<number>>(new Set())
  const [customName, setCustomName] = useState("")
  const [productIds, setProductIds] = useState<number[]>([])

  // Стилизация кнопки в шапке — все поля опциональны
  const [borderEnabled, setBorderEnabled] = useState(false)
  const [borderColor, setBorderColor] = useState<string>("#facc15")
  const [bgColor, setBgColor] = useState<string>("")   // пусто = без фона
  const [textColor, setTextColor] = useState<string>("")

  // Режим «вложенные категории» (для custom) — вместо товаров пункт
  // разворачивается в dropdown с nested children в шапке
  const [hasChildrenMode, setHasChildrenMode] = useState(false)

  const [saving, setSaving] = useState(false)
  // Храним сырое дерево категорий + отдельно flat-список для быстрого поиска
  const [catTree, setCatTree] = useState<Category[]>([])
  const [catSearch, setCatSearch] = useState("")
  const [loadingCats, setLoadingCats] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const [productsDialogOpen, setProductsDialogOpen] = useState(false)

  // Инициализация при открытии
  useEffect(() => {
    if (!open) return
    setKind(item?.kind ?? "custom")
    setCategoryId(item?.category_id ?? null)
    setCategoryIds(new Set())
    setCustomName(item?.kind === "custom" ? item?.name ?? "" : "")
    setProductIds(item?.product_ids ?? [])
    setCatSearch("")
    setBorderEnabled(item?.border_enabled ?? false)
    setBorderColor(item?.border_color || "#facc15")
    setBgColor(item?.bg_color || "")
    setTextColor(item?.text_color || "")
    setHasChildrenMode(item?.has_children_mode ?? false)
  }, [open, item])

  // Категории тянем только когда они нужны и ещё не загружены
  useEffect(() => {
    if (!open || kind !== "category" || catTree.length > 0) return
    setLoadingCats(true)
    getCategories()
      .then((tree) => setCatTree(tree))
      .finally(() => setLoadingCats(false))
  }, [open, kind, catTree.length])

  // Раскрываем путь до текущей выбранной категории при её изменении/загрузке
  // дерева — чтобы юзер видел где она лежит без ручного клика по стрелкам.
  // Для мульти-выбора — путь до каждой выбранной.
  useEffect(() => {
    if (kind !== "category" || catTree.length === 0) return
    const ids = isEdit
      ? (categoryId != null ? [categoryId] : [])
      : Array.from(categoryIds)
    if (!ids.length) return
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        const anc = findAncestors(catTree, id)
        if (anc) for (const a of anc) next.add(a)
      }
      return next
    })
  }, [kind, categoryId, categoryIds, catTree, isEdit])

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleCategoryMulti = (id: number) => {
    setCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const flatCats = useMemo(() => flattenTree(catTree), [catTree])
  const searchResults = useMemo(() => {
    const q = catSearch.trim().toLowerCase()
    if (!q) return null
    return flatCats.filter((c) => c.label.toLowerCase().includes(q))
  }, [flatCats, catSearch])

  const canSave = kind === "category"
    ? (isEdit ? categoryId !== null : categoryIds.size > 0)
    : customName.trim().length > 0

  const stylePayload = {
    border_enabled: borderEnabled,
    border_color: borderEnabled ? borderColor : null,
    bg_color: bgColor || null,
    text_color: textColor || null,
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit && item) {
        const payload = kind === "category"
          ? { category_id: categoryId ?? undefined, ...stylePayload }
          : {
              custom_name: customName.trim(),
              product_ids: hasChildrenMode ? [] : productIds,
              has_children_mode: hasChildrenMode,
              ...stylePayload,
            }
        const res = await updateHeaderMenuItem(item.id, payload)
        if (!res.success) throw new Error(res.error || "Ошибка сохранения")
        toast({ title: "Сохранено" })
      } else if (kind === "category") {
        // Множественный create — по одному пункту на каждую выбранную категорию
        const ids = Array.from(categoryIds)
        if (ids.length === 0) throw new Error("Выберите хотя бы одну категорию")
        const errors: string[] = []
        for (const cid of ids) {
          const res = await createHeaderMenuItem({
            kind: "category" as const,
            category_id: cid,
            parent_id: parentId ?? null,
            ...stylePayload,
          })
          if (!res.success) errors.push(res.error || "Ошибка")
        }
        if (errors.length > 0) {
          throw new Error(`Ошибок: ${errors.length} из ${ids.length}`)
        }
        toast({ title: `Добавлено пунктов: ${ids.length}` })
      } else {
        // custom — всегда один пункт
        const res = await createHeaderMenuItem({
          kind: "custom" as const,
          custom_name: customName.trim(),
          product_ids: hasChildrenMode ? [] : productIds,
          has_children_mode: hasChildrenMode,
          parent_id: parentId ?? null,
          ...stylePayload,
        })
        if (!res.success) throw new Error(res.error || "Ошибка создания")
        toast({ title: "Добавлено" })
      }
      onOpenChange(false)
      await onSaved()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || String(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Имя предпросмотра — для category берём из tree по id, для custom — сам input
  const previewLabel = useMemo(() => {
    if (kind === "category") {
      if (categoryId == null) return "Категория"
      return findCategoryName(catTree, categoryId) || "Категория"
    }
    return customName.trim() || "Название"
  }, [kind, categoryId, catTree, customName])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Широкая модалка — двухколоночный layout с высотой ~80vh,
            в правой колонке помещается длинный список товаров/категорий */}
        <DialogContent className="max-w-5xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-100 shrink-0">
            <DialogTitle>{isEdit ? "Редактировать пункт шапки" : "Новый пункт шапки"}</DialogTitle>
            <DialogDescription>
              Пункт нижней полосы шапки. Категория ведёт на существующий раздел
              сайта; свой раздел — курируемый набор товаров с уникальным URL.
              Показ в шапке (виден/скрыт) переключается в списке разделов.
            </DialogDescription>
          </DialogHeader>

          {/* Двухколоночная сетка на md+, на маленьких — колонки друг за другом */}
          <div className="grid md:grid-cols-2 flex-1 min-h-0 overflow-hidden">
            {/* ── ЛЕВАЯ КОЛОНКА: тип + основные поля ─────────────────── */}
            <div className="p-6 space-y-5 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/40">
              {!isEdit && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-gray-500 mb-2 block">
                    Тип пункта
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKind("category")}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        kind === "category"
                          ? "border-brand-yellow bg-yellow-50 ring-1 ring-brand-yellow"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-sm">Категория</span>
                      </div>
                      <p className="text-xs text-gray-500">Существующий раздел каталога</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKind("custom")}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        kind === "custom"
                          ? "border-brand-yellow bg-yellow-50 ring-1 ring-brand-yellow"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-brand-yellow" />
                        <span className="font-medium text-sm">Свой раздел</span>
                      </div>
                      <p className="text-xs text-gray-500">Курируемый список товаров</p>
                    </button>
                  </div>
                </div>
              )}

              {isEdit && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-200">
                  {kind === "custom" ? (
                    <Sparkles className="h-4 w-4 text-brand-yellow" />
                  ) : (
                    <Tag className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="font-medium">
                    {kind === "custom" ? "Свой раздел" : "Категория"}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">тип менять нельзя</span>
                </div>
              )}

              {kind === "custom" && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-gray-500 mb-1.5 block">
                    Название раздела
                  </Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Например: Хиты продаж"
                    maxLength={200}
                    className={SOFT_INPUT}
                  />
                  <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Slug для URL сформируется автоматически (транслитерация)
                  </p>
                  {item?.slug && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">/category/{item.slug}</p>
                  )}

                  {/* Toggle «Вложенные категории» — переключает содержимое
                      правой колонки: товары vs список подпунктов */}
                  <label className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasChildrenMode}
                      onChange={(e) => setHasChildrenMode(e.target.checked)}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">Вложенные категории</div>
                      <div className="text-[11px] text-gray-500">
                        Вместо товаров пункт откроет dropdown с подпунктами (можно
                        добавлять и категории, и свои разделы неограниченно вглубь)
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {kind === "category" && (
                <div className="text-sm text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
                  <p className="mb-1 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-medium text-gray-700">Как это работает</span>
                  </p>
                  <p className="text-xs leading-relaxed">
                    Выберите категорию справа — пункт откроет её страницу
                    в каталоге. Название пункта = имя категории, автоматически.
                  </p>
                </div>
              )}

              {/* ── Секция «Внешний вид» — стилизация кнопки в шапке ─── */}
              <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs uppercase tracking-wide text-gray-500 flex-1">Внешний вид</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setBorderEnabled(false)
                      setBgColor("")
                      setTextColor("")
                    }}
                    className="text-[11px] text-gray-500 hover:text-black"
                    title="Сбросить всё"
                  >
                    Сброс
                  </button>
                </div>

                {/* Живое превью — как будет выглядеть на клиенте */}
                <div className="bg-gray-50 rounded p-3 flex items-center justify-center min-h-[52px]">
                  <span
                    className="inline-block whitespace-nowrap px-2 py-0.5 text-[11px] rounded-full transition-colors"
                    style={{
                      backgroundColor: bgColor || undefined,
                      color: textColor || undefined,
                      border: borderEnabled ? `1px solid ${borderColor}` : undefined,
                    }}
                  >
                    {previewLabel}
                  </span>
                </div>

                {/* Border */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={borderEnabled}
                    onChange={(e) => setBorderEnabled(e.target.checked)}
                    className="rounded"
                    id="pb-border-enable"
                  />
                  <label htmlFor="pb-border-enable" className="text-xs text-gray-700 flex-1 cursor-pointer">
                    Рамка
                  </label>
                  {borderEnabled && (
                    <ColorField value={borderColor} onChange={setBorderColor} />
                  )}
                </div>

                {/* Bg color */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-700 flex-1">Фон кнопки</Label>
                  <ColorField value={bgColor} onChange={setBgColor} allowEmpty />
                </div>

                {/* Text color */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-700 flex-1">Цвет текста</Label>
                  <ColorField value={textColor} onChange={setTextColor} allowEmpty />
                </div>
              </div>
            </div>

            {/* ── ПРАВАЯ КОЛОНКА: список товаров ИЛИ инфо о вложенных ── */}
            <div className="p-6 overflow-y-auto flex flex-col min-h-0">
              {kind === "custom" && hasChildrenMode ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-sm space-y-3">
                    <Sparkles className="h-10 w-10 text-brand-yellow mx-auto" />
                    <div className="text-lg font-medium text-gray-900">Режим вложенных категорий</div>
                    <p className="text-sm text-gray-600">
                      Товары в этом пункте не показываются. Вместо этого пункт
                      будет открывать dropdown с подпунктами.
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Управлять подпунктами — в основном списке «Разделы категорий»:
                      разверните этот пункт (▶) и нажмите «+ Добавить внутрь».
                      Внутри можно добавлять и категории, и свои разделы, вложенность
                      неограничена.
                    </p>
                    {isEdit && item?.children && item.children.length > 0 && (
                      <div className="pt-2 text-xs text-gray-600">
                        Сейчас внутри: {item.children.length}
                      </div>
                    )}
                  </div>
                </div>
              ) : kind === "custom" ? (
                <>
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-500 block">
                        Товары раздела
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-gray-900">
                          Выбрано: {productIds.length}
                        </span>
                        {productIds.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            будут показаны в этом порядке
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setProductsDialogOpen(true)}
                    >
                      <Package className="h-3.5 w-3.5 mr-1.5" />
                      Выбрать товары
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {productIds.length > 0 ? (
                      <SelectedElementsDisplay
                        blockType={HOMEPAGE_BLOCK_TYPES.PRODUCTS}
                        selectedItemIds={productIds}
                        onRemoveItem={(id) => setProductIds(productIds.filter((x) => x !== id))}
                        onClearAll={() => setProductIds([])}
                      />
                    ) : (
                      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                        <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Товары ещё не выбраны</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setProductsDialogOpen(true)}
                          className="mt-2 text-brand-yellow hover:text-yellow-600"
                        >
                          Выбрать
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs uppercase tracking-wide text-gray-500">
                        {isEdit ? "Выбор категории" : "Выбор категорий (можно несколько)"}
                      </Label>
                      {isEdit && categoryId !== null && (
                        <Badge variant="outline" className="text-[10px]">выбрана</Badge>
                      )}
                      {!isEdit && categoryIds.size > 0 && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-brand-yellow text-yellow-700">
                            выбрано: {categoryIds.size}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => setCategoryIds(new Set())}
                            className="text-[11px] text-gray-500 hover:text-black"
                          >Сбросить</button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={catSearch}
                        onChange={(e) => setCatSearch(e.target.value)}
                        placeholder="Поиск по названию…"
                        className={`pl-9 ${SOFT_INPUT}`}
                      />
                    </div>
                    {!isEdit && (
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        Отметьте нужные — создастся отдельный пункт для каждой выбранной категории.
                      </p>
                    )}
                  </div>
                  <ScrollArea className="flex-1 border border-gray-200 rounded-lg bg-white">
                    {loadingCats ? (
                      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Загрузка категорий…
                      </div>
                    ) : searchResults ? (
                      // Режим поиска — плоский список путей
                      searchResults.length === 0 ? (
                        <div className="py-12 text-center text-sm text-gray-400">
                          Ничего не найдено
                        </div>
                      ) : (
                        <div className="p-1.5 space-y-0.5">
                          {searchResults.map((c) => {
                            const isSel = isEdit ? categoryId === c.id : categoryIds.has(c.id)
                            const onClick = () => {
                              if (isEdit) setCategoryId(c.id)
                              else toggleCategoryMulti(c.id)
                            }
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={onClick}
                                className={cn(
                                  "w-full flex items-center gap-2 text-left px-3 py-2 rounded text-sm transition-colors",
                                  isSel ? "bg-brand-yellow text-black font-medium" : "hover:bg-gray-50",
                                )}
                              >
                                <input
                                  type={isEdit ? "radio" : "checkbox"}
                                  checked={isSel}
                                  readOnly
                                  className="shrink-0"
                                />
                                <span className="flex-1">{c.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    ) : catTree.length === 0 ? (
                      <div className="py-12 text-center text-sm text-gray-400">
                        Категорий пока нет
                      </div>
                    ) : (
                      // Обычный режим — древо; radio для edit, checkbox для create
                      <ul className="p-1">
                        {catTree.map((node) => (
                          <TreeNode
                            key={node.id}
                            node={node}
                            level={0}
                            expanded={expanded}
                            onToggle={toggleExpanded}
                            mode={isEdit ? "single" : "multi"}
                            selectedId={categoryId}
                            onSelectSingle={setCategoryId}
                            selectedIds={categoryIds}
                            onToggleMulti={toggleCategoryMulti}
                          />
                        ))}
                      </ul>
                    )}
                  </ScrollArea>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0 bg-white">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={!canSave || saving} className={PRIMARY_BTN}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Компактный пикер товаров (свой, не homepage-block, чтобы карточки
          были плотнее и не тянули за собой лишний UX). */}
      <CompactProductPicker
        open={productsDialogOpen}
        onOpenChange={setProductsDialogOpen}
        selectedIds={productIds}
        onChange={setProductIds}
      />
    </>
  )
}

// ── Компактный color-picker: swatch + text input ──────────────────────
// Native <input type="color"> для быстрого выбора + text для точной вставки
// hex. `allowEmpty` — можно очистить (кнопка ×). Пустое значение = нет цвета.
function ColorField({
  value, onChange, allowEmpty,
}: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const active = value.trim().length > 0
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={active ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-gray-300 cursor-pointer bg-white p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-20 h-6 text-[11px] font-mono border border-gray-200 rounded px-1.5 focus:outline-none focus:border-brand-yellow"
      />
      {allowEmpty && active && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Сбросить"
          className="w-5 h-5 rounded hover:bg-gray-100 text-gray-400 hover:text-black text-xs"
        >
          ×
        </button>
      )}
    </div>
  )
}
