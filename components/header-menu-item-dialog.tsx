"use client"

import { useEffect, useMemo, useState } from "react"
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
import { ElementsSelectionDialog } from "@/components/elements-selection-dialog"
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
  onSaved: () => void | Promise<void>
}

const SOFT_INPUT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)]"

// Flatten дерева категорий: [{id, label='Родитель / Ребёнок', name}]
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

export default function HeaderMenuItemDialog({ open, onOpenChange, item, onSaved }: Props) {
  const { toast } = useToast()
  const isEdit = !!item

  const [kind, setKind] = useState<"category" | "custom">("custom")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [customName, setCustomName] = useState("")
  const [productIds, setProductIds] = useState<number[]>([])

  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Array<{ id: number; label: string; name: string }>>([])
  const [catSearch, setCatSearch] = useState("")
  const [loadingCats, setLoadingCats] = useState(false)

  const [productsDialogOpen, setProductsDialogOpen] = useState(false)

  // Инициализация при открытии
  useEffect(() => {
    if (!open) return
    setKind(item?.kind ?? "custom")
    setCategoryId(item?.category_id ?? null)
    setCustomName(item?.kind === "custom" ? item?.name ?? "" : "")
    setProductIds(item?.product_ids ?? [])
    setCatSearch("")
  }, [open, item])

  // Категории тянем только когда они нужны и ещё не загружены
  useEffect(() => {
    if (!open || kind !== "category" || categories.length > 0) return
    setLoadingCats(true)
    getCategories()
      .then((tree) => setCategories(flattenTree(tree)))
      .finally(() => setLoadingCats(false))
  }, [open, kind, categories.length])

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories
    const q = catSearch.toLowerCase()
    return categories.filter((c) => c.label.toLowerCase().includes(q))
  }, [categories, catSearch])

  const canSave = kind === "category"
    ? categoryId !== null
    : customName.trim().length > 0

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit && item) {
        const payload = kind === "category"
          ? { category_id: categoryId ?? undefined }
          : { custom_name: customName.trim(), product_ids: productIds }
        const res = await updateHeaderMenuItem(item.id, payload)
        if (!res.success) throw new Error(res.error || "Ошибка сохранения")
        toast({ title: "Сохранено" })
      } else {
        const payload = kind === "category"
          ? { kind: "category" as const, category_id: categoryId ?? undefined }
          : { kind: "custom" as const, custom_name: customName.trim(), product_ids: productIds }
        const res = await createHeaderMenuItem(payload)
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
            </div>

            {/* ── ПРАВАЯ КОЛОНКА: список товаров или список категорий ─── */}
            <div className="p-6 overflow-y-auto flex flex-col min-h-0">
              {kind === "custom" ? (
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
                        Выбор категории
                      </Label>
                      {categoryId !== null && (
                        <Badge variant="outline" className="text-[10px]">
                          выбрана
                        </Badge>
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
                  </div>
                  <ScrollArea className="flex-1 border border-gray-200 rounded-lg bg-white">
                    {loadingCats ? (
                      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Загрузка категорий…
                      </div>
                    ) : filteredCategories.length === 0 ? (
                      <div className="py-12 text-center text-sm text-gray-400">
                        Ничего не найдено
                      </div>
                    ) : (
                      <div className="p-1.5">
                        {filteredCategories.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setCategoryId(c.id)}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              categoryId === c.id
                                ? "bg-brand-yellow text-black font-medium"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
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

      {/* Диалог выбора товаров — reuse от homepage-block */}
      <ElementsSelectionDialog
        open={productsDialogOpen}
        onOpenChange={setProductsDialogOpen}
        blockType={HOMEPAGE_BLOCK_TYPES.PRODUCTS}
        selectedItems={productIds}
        onItemsChange={setProductIds}
      />
    </>
  )
}
