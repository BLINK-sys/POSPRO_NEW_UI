"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft, Search, Trash2, ArrowRight, Plus, Loader2,
  ChevronRight, GitMerge, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { type Category } from "@/app/actions/categories"
import {
  type CategoryAliasItem,
  type SimilarPair,
  listCategoryAliases,
  updateCategoryAlias,
  deleteCategoryAlias,
  createCategoryAlias,
  mergeCategories,
  mergeExactDuplicates,
  findSimilarCategories,
} from "@/app/actions/category-aliases"
import { ParentCategoryDialog } from "@/components/parent-category-dialog"

interface Props {
  initialCategories: Category[]
  initialAliases: CategoryAliasItem[]
  initialSimilar: SimilarPair[]
}

const SOURCE_LABEL: Record<string, string> = {
  bio: "BIO",
  equip: "Equip",
  manual: "Вручную",
}

export function AliasesClient({ initialCategories, initialAliases, initialSimilar }: Props) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  const [categories] = useState<Category[]>(initialCategories)
  const [aliases, setAliases] = useState<CategoryAliasItem[]>(initialAliases)
  const [similar, setSimilar] = useState<SimilarPair[]>(initialSimilar)

  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [autoOnly, setAutoOnly] = useState(false)
  const [query, setQuery] = useState("")

  const [reassignFor, setReassignFor] = useState<CategoryAliasItem | null>(null)
  const [mergePair, setMergePair] = useState<SimilarPair | null>(null)
  const [mergeDirection, setMergeDirection] = useState<"a-to-b" | "b-to-a">("a-to-b")
  const [addOpen, setAddOpen] = useState(false)
  // Двухэтапная подтверждающая модалка вместо браузерных confirm()
  const [confirmState, setConfirmState] = useState<{
    title: string
    description: string
    onConfirm: () => void
    danger?: boolean
    confirmLabel?: string
  } | null>(null)

  const filteredAliases = useMemo(() => {
    const q = query.trim().toLowerCase()
    return aliases.filter((a) => {
      if (sourceFilter !== "all") {
        if (sourceFilter === "manual" && a.source !== null) return false
        if (sourceFilter !== "manual" && a.source !== sourceFilter) return false
      }
      if (needsReviewOnly && !a.needs_review) return false
      if (autoOnly && !a.is_auto) return false
      if (q && !a.alias_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [aliases, sourceFilter, needsReviewOnly, autoOnly, query])

  const reload = () => {
    startTransition(async () => {
      const [nextAliases, nextSimilar] = await Promise.all([
        listCategoryAliases({}),
        findSimilarCategories(0.85),
      ])
      setAliases(nextAliases)
      setSimilar(nextSimilar)
    })
  }

  const handleReassign = (categoryId: number) => {
    if (!reassignFor) return
    startTransition(async () => {
      const res = await updateCategoryAlias(reassignFor.id, { category_id: categoryId })
      if (res.success) {
        toast({ title: "Алиас переназначен" })
        setReassignFor(null)
        reload()
      } else {
        toast({ title: "Ошибка", description: res.error, variant: "destructive" })
      }
    })
  }

  const handleConfirmReview = (alias: CategoryAliasItem) => {
    startTransition(async () => {
      const res = await updateCategoryAlias(alias.id, { needs_review: false })
      if (res.success) {
        toast({ title: "Подтверждено" })
        reload()
      } else {
        toast({ title: "Ошибка", description: res.error, variant: "destructive" })
      }
    })
  }

  const handleDelete = (alias: CategoryAliasItem) => {
    setConfirmState({
      title: "Удалить алиас?",
      description: `Алиас «${alias.alias_name}» будет удалён. Товары в связанной категории останутся, но при следующей выгрузке от поставщика могут пойти в другую (или новую автосозданную) категорию.`,
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: () => {
        setConfirmState(null)
        startTransition(async () => {
          const res = await deleteCategoryAlias(alias.id)
          if (res.success) {
            toast({ title: "Удалено" })
            reload()
          } else {
            toast({ title: "Ошибка", description: res.error, variant: "destructive" })
          }
        })
      },
    })
  }

  const handleMergeExactDuplicates = () => {
    setConfirmState({
      title: "Смерджить все точные дубликаты?",
      description: "Все категории, у которых после нормализации совпадает имя (при одинаковом родителе), будут автоматически объединены. Из каждой группы target — та, где больше товаров; при равенстве — с меньшим id. Товары / алиасы / подкатегории / картинки переносятся, дубли удаляются. Всё в транзакции.",
      danger: true,
      confirmLabel: "Смерджить",
      onConfirm: () => {
        setConfirmState(null)
        startTransition(async () => {
          const res = await mergeExactDuplicates()
          if (res.success) {
            toast({
              title: "Готово",
              description: `Смерджено групп: ${res.groups_merged}, удалено категорий: ${res.categories_removed}, товаров: ${res.products_moved}, алиасов: ${res.aliases_relinked}`,
            })
            reload()
          } else {
            toast({ title: "Ошибка", description: res.error, variant: "destructive" })
          }
        })
      },
    })
  }

  const handleMerge = () => {
    if (!mergePair) return
    const [src, tgt] =
      mergeDirection === "a-to-b" ? [mergePair.a, mergePair.b] : [mergePair.b, mergePair.a]
    setConfirmState({
      title: "Объединить категории?",
      description: `Все товары, алиасы, подкатегории и картинка из «${src.name}» будут перенесены в «${tgt.name}». Категория «${src.name}» будет удалена. Действие в транзакции — при ошибке откатится.`,
      danger: true,
      confirmLabel: "Объединить",
      onConfirm: () => {
        setConfirmState(null)
        startTransition(async () => {
          const res = await mergeCategories(src.id, tgt.id)
          if (res.success) {
            toast({
              title: "Смерджено",
              description: `Перенесено товаров: ${res.products_moved}, алиасов: ${res.aliases_relinked}`,
            })
            setMergePair(null)
            reload()
          } else {
            toast({ title: "Ошибка", description: res.error, variant: "destructive" })
          }
        })
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/catalog/categories">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К категориям
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Пути перенаправления категорий</h1>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      <p className="text-sm text-gray-600 max-w-3xl">
        Алиас — «имя категории от поставщика → наша канонич. категория». Bio/Equip
        могут прислать «Пароконвектоматы» или «Параконвектоматные аппараты» —
        оба будут падать в одну и ту же нашу категорию. Автосозданные алиасы,
        которые прошли только fuzzy-совпадение, помечены как «требует ревью» —
        просмотрите их и подтвердите или переназначьте.
      </p>

      <Tabs defaultValue="aliases" className="w-full">
        <TabsList>
          <TabsTrigger value="aliases">
            Алиасы ({aliases.length})
          </TabsTrigger>
          <TabsTrigger value="similar">
            Похожие категории {similar.length > 0 && <Badge variant="secondary" className="ml-2">{similar.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Таб 1: алиасы ─────────────────────────────── */}
        <TabsContent value="aliases" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    placeholder="Поиск по имени алиаса…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все источники</SelectItem>
                    <SelectItem value="bio">BIO</SelectItem>
                    <SelectItem value="equip">Equip</SelectItem>
                    <SelectItem value="manual">Вручную</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Switch checked={needsReviewOnly} onCheckedChange={setNeedsReviewOnly} />
                  Только «требует ревью»
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Switch checked={autoOnly} onCheckedChange={setAutoOnly} />
                  Только авто
                </label>
                <Button size="sm" onClick={() => setAddOpen(true)} className="bg-brand-yellow text-black hover:bg-yellow-500">
                  <Plus className="h-4 w-4 mr-1" /> Добавить алиас
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAliases.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Ничего не найдено
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <tr className="border-b border-gray-200">
                        <th className="py-2 px-2 font-semibold">Имя алиаса</th>
                        <th className="py-2 px-2 font-semibold">Источник</th>
                        <th className="py-2 px-2 font-semibold">→ Категория</th>
                        <th className="py-2 px-2 font-semibold">Флаги</th>
                        <th className="py-2 px-2 font-semibold text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAliases.map((a) => (
                        <tr key={a.id} className={`border-b border-gray-100 ${a.needs_review ? "bg-yellow-50/50" : ""}`}>
                          <td className="py-2 px-2 font-medium">{a.alias_name}</td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className="text-[10px]">
                              {a.source ? SOURCE_LABEL[a.source] ?? a.source : "Вручную"}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-gray-700">
                            {a.category ? (
                              <span className="inline-flex items-center gap-1">
                                <ArrowRight className="h-3 w-3 text-gray-400" />
                                {a.category.name}
                              </span>
                            ) : (
                              <span className="text-red-600 text-xs">удалена</span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              {a.is_auto && (
                                <Badge variant="secondary" className="text-[10px]">Авто</Badge>
                              )}
                              {a.needs_review && (
                                <Badge className="text-[10px] bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Ревью
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="inline-flex gap-1">
                              {a.needs_review && (
                                <Button size="sm" variant="outline" onClick={() => handleConfirmReview(a)}>
                                  Подтвердить
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => setReassignFor(a)}>
                                Переназначить
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(a)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Таб 2: похожие категории ──────────────────── */}
        <TabsContent value="similar" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Похожие категории — кандидаты на объединение</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    Пары категорий с одним и тем же родителем и сходством имён ≥ 85%.
                    Выберите направление merge (в какую категорию сливать) — все товары
                    перенесутся в target, source-категория будет удалена.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMergeExactDuplicates}
                  title="Автомерж всех групп с 100% совпадением после нормализации"
                  className="shrink-0"
                >
                  <GitMerge className="h-4 w-4 mr-1" />
                  Смерджить точные дубликаты
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {similar.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Похожих категорий не найдено — всё чисто.
                </div>
              ) : (
                <div className="space-y-2">
                  {similar.map((pair, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{pair.a.name}</span>
                          <span className="text-xs text-gray-400">({pair.a.products_count} тов.)</span>
                          <ChevronRight className="h-3 w-3 text-gray-400" />
                          <span className="font-medium">{pair.b.name}</span>
                          <span className="text-xs text-gray-400">({pair.b.products_count} тов.)</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Сходство: <b>{Math.round(pair.ratio * 100)}%</b>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMergePair(pair)
                          // По умолчанию сливаем в ту, где больше товаров
                          setMergeDirection(pair.a.products_count >= pair.b.products_count ? "b-to-a" : "a-to-b")
                        }}
                      >
                        <GitMerge className="h-4 w-4 mr-1" />
                        Объединить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог переназначения категории */}
      <ParentCategoryDialog
        open={!!reassignFor}
        onOpenChange={(open) => !open && setReassignFor(null)}
        categories={categories}
        selectedCategoryId={reassignFor?.category_id ?? null}
        onSelect={(id) => id != null && handleReassign(id)}
        title={reassignFor ? `Переназначить «${reassignFor.alias_name}»` : ""}
      />

      {/* Диалог merge */}
      <Dialog open={!!mergePair} onOpenChange={(open) => !open && setMergePair(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Объединить категории</DialogTitle>
            <DialogDescription>
              Выберите куда сливаем. Source-категория будет удалена, товары/алиасы/дети
              перенесутся в target.
            </DialogDescription>
          </DialogHeader>
          {mergePair && (
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="merge-dir"
                  checked={mergeDirection === "a-to-b"}
                  onChange={() => setMergeDirection("a-to-b")}
                  className="mt-1"
                />
                <div className="flex-1 text-sm">
                  <div>
                    <b>{mergePair.a.name}</b> ({mergePair.a.products_count} тов.)
                    <ArrowRight className="inline h-3 w-3 mx-1 text-gray-400" />
                    <b>{mergePair.b.name}</b> ({mergePair.b.products_count} тов.)
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Удалить «{mergePair.a.name}», всё перенести в «{mergePair.b.name}»
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="merge-dir"
                  checked={mergeDirection === "b-to-a"}
                  onChange={() => setMergeDirection("b-to-a")}
                  className="mt-1"
                />
                <div className="flex-1 text-sm">
                  <div>
                    <b>{mergePair.b.name}</b> ({mergePair.b.products_count} тов.)
                    <ArrowRight className="inline h-3 w-3 mx-1 text-gray-400" />
                    <b>{mergePair.a.name}</b> ({mergePair.a.products_count} тов.)
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Удалить «{mergePair.b.name}», всё перенести в «{mergePair.a.name}»
                  </div>
                </div>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergePair(null)}>Отмена</Button>
            <Button onClick={handleMerge} className="bg-brand-yellow text-black hover:bg-yellow-500">
              <GitMerge className="h-4 w-4 mr-2" />
              Объединить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог добавления алиаса вручную */}
      <AddAliasDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        categories={categories}
        onCreated={reload}
      />

      {/* Универсальный диалог подтверждения — заменяет window.confirm() */}
      <Dialog open={!!confirmState} onOpenChange={(open) => !open && setConfirmState(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmState?.title}</DialogTitle>
            <DialogDescription>{confirmState?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmState(null)}>Отмена</Button>
            <Button
              onClick={() => confirmState?.onConfirm()}
              className={
                confirmState?.danger
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-brand-yellow text-black hover:bg-yellow-500"
              }
            >
              {confirmState?.confirmLabel || "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Диалог создания ─────────────────────────────

function AddAliasDialog({
  open,
  onOpenChange,
  categories,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: Category[]
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [source, setSource] = useState<string>("manual")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const selectedCat = categoryId ? categories.find((c) => c.id === categoryId) : null

  const handleSubmit = () => {
    if (!name.trim() || !categoryId) return
    startTransition(async () => {
      const res = await createCategoryAlias({
        alias_name: name.trim(),
        category_id: categoryId,
        source: source === "manual" ? null : source,
        parent_id: selectedCat?.parent_id ?? null,
      })
      if (res.success) {
        toast({ title: "Алиас создан" })
        setName("")
        setCategoryId(null)
        onOpenChange(false)
        onCreated()
      } else {
        toast({ title: "Ошибка", description: res.error, variant: "destructive" })
      }
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить алиас</DialogTitle>
            <DialogDescription>
              Ручной алиас — например синоним, который никогда не пришлёт поставщик,
              но админ хочет заранее «занять» под нужную категорию.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Имя алиаса</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Пароконвектоматные аппараты" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Источник</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Вручную (без источника)</SelectItem>
                  <SelectItem value="bio">BIO</SelectItem>
                  <SelectItem value="equip">Equip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Целевая категория</label>
              <Button variant="outline" onClick={() => setPickerOpen(true)} className="w-full justify-start">
                {selectedCat ? selectedCat.name : "Выбрать категорию…"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || !categoryId || pending}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParentCategoryDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={categories}
        selectedCategoryId={categoryId}
        onSelect={setCategoryId}
        title="Выберите целевую категорию"
      />
    </>
  )
}
