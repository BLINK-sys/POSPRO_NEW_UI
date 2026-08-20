"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ImagePlus, Link as LinkIcon, Loader2, Plus, Trash2, Upload, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { getImageUrl } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import { getCategories, type Category } from "@/app/actions/categories"
import { CategoryMultiSelectDialog } from "./category-multi-select-dialog"

export interface SectionCard {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  banner_image_url: string
  target: "link" | "categories"
  link_url: string
  link_new_tab: boolean
  order: number
  active: boolean
  category_ids: number[]
}

interface Props {
  card: SectionCard | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

const EMPTY_FORM: SectionCard = {
  id: 0,
  name: "",
  slug: "",
  description: "",
  image_url: "",
  banner_image_url: "",
  target: "link",
  link_url: "",
  link_new_tab: false,
  order: 0,
  active: true,
  category_ids: [],
}

export default function SectionCardEditDialog({ card, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<SectionCard>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [categoriesTree, setCategoriesTree] = useState<Category[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    if (card) {
      setForm({
        ...EMPTY_FORM,
        ...card,
        target: card.target ?? "link",
        category_ids: card.category_ids ?? [],
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [card, open])

  useEffect(() => {
    if (!open) return
    setTreeLoading(true)
    getCategories()
      .then((tree) => setCategoriesTree(tree))
      .catch(() => setCategoriesTree([]))
      .finally(() => setTreeLoading(false))
  }, [open])

  const isEditing = card !== null && card.id !== 0

  const removeCategory = (id: number) => {
    setForm((prev) => ({ ...prev, category_ids: prev.category_ids.filter((x) => x !== id) }))
  }

  // Плоская мапа id → name для рендера чипов выбранных категорий.
  const categoryNameMap = useMemo(() => {
    const map = new Map<number, string>()
    const walk = (nodes: Category[]) => {
      for (const n of nodes) {
        map.set(n.id, n.name)
        if (n.children) walk(n.children)
      }
    }
    walk(categoriesTree)
    return map
  }, [categoriesTree])

  const uploadFile = async (kind: "image" | "banner", file: File) => {
    if (!isEditing) {
      toast({
        title: "Сохраните карточку",
        description: "Загрузка изображения доступна после создания карточки",
        variant: "destructive",
      })
      return
    }
    const fd = new FormData()
    fd.append("file", file)
    fd.append("kind", kind)
    try {
      const res = await apiClient.uploadFile<{ url: string; kind: string }>(
        `/api/admin/section-cards/${form.id}/upload`,
        fd,
      )
      setForm((prev) => ({
        ...prev,
        [kind === "image" ? "image_url" : "banner_image_url"]: res.url,
      }))
      toast({ title: "Готово", description: "Изображение загружено" })
    } catch (e: any) {
      toast({ title: "Ошибка загрузки", description: e?.message ?? String(e), variant: "destructive" })
    }
  }

  const uploadFromUrl = async (kind: "image" | "banner", url: string) => {
    if (!isEditing) {
      toast({
        title: "Сохраните карточку",
        description: "Загрузка по URL доступна после создания карточки",
        variant: "destructive",
      })
      return
    }
    const clean = url.trim()
    if (!clean) return
    if (!/^https?:\/\//i.test(clean)) {
      toast({ title: "Неверный URL", description: "Начинайте с http:// или https://", variant: "destructive" })
      return
    }
    try {
      const res = await apiClient.post<{ url: string; kind: string }>(
        `/api/admin/section-cards/${form.id}/upload-url`,
        { url: clean, kind },
      )
      setForm((prev) => ({
        ...prev,
        [kind === "image" ? "image_url" : "banner_image_url"]: res.url,
      }))
      toast({ title: "Скачано", description: "Файл сохранён на сервере" })
    } catch (e: any) {
      toast({ title: "Ошибка скачивания", description: e?.message ?? String(e), variant: "destructive" })
    }
  }

  // Удалить изображение сразу (без ждать «Сохранить»): на бэк отправить
  // PUT с пустой строкой — server удалит файл + обнулит поле.
  const removeImage = async (kind: "image" | "banner") => {
    if (!isEditing) {
      setForm((prev) => ({
        ...prev,
        [kind === "image" ? "image_url" : "banner_image_url"]: "",
      }))
      return
    }
    try {
      await apiClient.put(`/api/admin/section-cards/${form.id}`, {
        [kind === "image" ? "image_url" : "banner_image_url"]: "",
      })
      setForm((prev) => ({
        ...prev,
        [kind === "image" ? "image_url" : "banner_image_url"]: "",
      }))
      toast({ title: "Удалено" })
    } catch (e: any) {
      toast({ title: "Ошибка удаления", description: e?.message ?? String(e), variant: "destructive" })
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Заполните название", variant: "destructive" })
      return
    }
    if (form.target === "link" && !form.link_url.trim()) {
      toast({ title: "Укажите ссылку", description: "Для таргета «Ссылка» нужен URL", variant: "destructive" })
      return
    }
    if (form.target === "categories" && form.category_ids.length === 0) {
      toast({
        title: "Выберите категории",
        description: "Для таргета «Категории» нужно выбрать хотя бы одну категорию",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description,
        target: form.target,
        link_url: form.target === "link" ? form.link_url : "",
        link_new_tab: form.link_new_tab,
        active: form.active,
        category_ids: form.target === "categories" ? form.category_ids : [],
      }
      if (isEditing) {
        await apiClient.put(`/api/admin/section-cards/${form.id}`, payload)
      } else {
        await apiClient.post("/api/admin/section-cards", payload)
      }
      toast({ title: "Сохранено" })
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message ?? String(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактировать карточку раздела" : "Новая карточка раздела"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Строка 1: баннер на всю ширину ─────────────────────── */}
          <ImagePicker
            title="Баннер раздела"
            hint="Hero-баннер на странице /section/<slug>. Оптимально 16:5."
            aspect="banner"
            url={form.banner_image_url}
            inputRef={bannerInputRef}
            onPick={() => bannerInputRef.current?.click()}
            onFile={(f) => uploadFile("banner", f)}
            onUploadFromUrl={(u) => uploadFromUrl("banner", u)}
            onClear={() => removeImage("banner")}
            disabled={!isEditing}
          />

          {/* ── Строка 2: 2 колонки ──────────────────────────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Колонка 1: Изображение + поля */}
            <div className="space-y-4">
              <ImagePicker
                title="Изображение карточки"
                hint="Показывается в блоке на главной. Оптимально 4:3."
                aspect="card"
                url={form.image_url}
                inputRef={imageInputRef}
                onPick={() => imageInputRef.current?.click()}
                onFile={(f) => uploadFile("image", f)}
                onUploadFromUrl={(u) => uploadFromUrl("image", u)}
                onClear={() => removeImage("image")}
                disabled={!isEditing}
              />

              <div className="grid gap-3 rounded-lg border p-4">
                <div className="grid gap-2">
                  <Label htmlFor="sc-name">Название</Label>
                  <Input
                    id="sc-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Например: Оборудование для баров"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sc-desc">Описание</Label>
                  <Textarea
                    id="sc-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Короткий текст под названием / hero-подзаголовок"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sc-slug">Slug (для URL /section/…)</Label>
                  <Input
                    id="sc-slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="оставьте пустым — сгенерируется автоматически"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <Label htmlFor="sc-active" className="cursor-pointer text-sm">Активна</Label>
                  <Switch
                    id="sc-active"
                    checked={form.active}
                    onCheckedChange={(v: boolean) => setForm({ ...form, active: v })}
                  />
                </div>
              </div>
            </div>

            {/* Колонка 2: выбор ссылки/категорий */}
            <div className="space-y-3">
              <Label>Что происходит при клике</Label>
              <RadioGroup
                value={form.target}
                onValueChange={(v: string) => setForm({ ...form, target: v as "link" | "categories" })}
                className="grid gap-3 sm:grid-cols-2"
              >
                <label className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  form.target === "link" ? "border-brand-yellow bg-yellow-50" : "border-gray-200"
                )}>
                  <RadioGroupItem value="link" id="tgt-link" className="mt-1" />
                  <div className="text-sm">
                    <div className="font-medium">Ссылка</div>
                    <div className="text-muted-foreground text-xs">Переход на любой URL — внешний или внутренний</div>
                  </div>
                </label>
                <label className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  form.target === "categories" ? "border-brand-yellow bg-yellow-50" : "border-gray-200"
                )}>
                  <RadioGroupItem value="categories" id="tgt-cats" className="mt-1" />
                  <div className="text-sm">
                    <div className="font-medium">Категории</div>
                    <div className="text-muted-foreground text-xs">
                      Клик открывает /section/&lt;slug&gt; — товары из выбранных категорий и их подкатегорий
                    </div>
                  </div>
                </label>
              </RadioGroup>

              {form.target === "link" && (
                <div className="grid gap-3 rounded-lg bg-gray-50 p-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sc-url">URL</Label>
                    <Input
                      id="sc-url"
                      value={form.link_url}
                      onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                      placeholder="/category/kofemashiny или https://…"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sc-newtab" className="text-sm">Открывать в новой вкладке</Label>
                    <Switch
                      id="sc-newtab"
                      checked={form.link_new_tab}
                      onCheckedChange={(v: boolean) => setForm({ ...form, link_new_tab: v })}
                    />
                  </div>
                </div>
              )}

              {form.target === "categories" && (
                <div className="grid gap-3 rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Привязанные категории</Label>
                    <span className="text-xs text-muted-foreground">
                      Выбрано: {form.category_ids.length}
                    </span>
                  </div>

                  {form.category_ids.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-md border border-dashed border-gray-300 bg-white p-3 text-center">
                      Категории не выбраны
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 space-y-1">
                      {form.category_ids.map((id) => {
                        const name = categoryNameMap.get(id)
                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-50"
                          >
                            <span className="text-sm truncate flex-1">
                              {name ?? (treeLoading ? "Загрузка…" : `Категория #${id}`)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeCategory(id)}
                              title="Убрать"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCategoriesDialogOpen(true)}
                    disabled={treeLoading}
                    className="w-full justify-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Выбрать категории
                  </Button>
                </div>
              )}
            </div>
          </div>

          {!isEditing && (
            <p className="text-xs text-muted-foreground">
              💡 Изображения (баннер и карточка) можно загрузить после первого сохранения карточки.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>

        <CategoryMultiSelectDialog
          open={categoriesDialogOpen}
          onOpenChange={setCategoriesDialogOpen}
          categories={categoriesTree}
          selectedIds={form.category_ids}
          onConfirm={(ids) => setForm((prev) => ({ ...prev, category_ids: ids }))}
          title="Выберите категории раздела"
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Внутренние компоненты ────────────────────────────────────────────

interface ImagePickerProps {
  title: string
  hint: string
  aspect: "banner" | "card"  // 16:5 или 4:3
  url: string
  inputRef: React.RefObject<HTMLInputElement>
  onPick: () => void
  onFile: (f: File) => void
  onUploadFromUrl: (u: string) => Promise<void>
  onClear: () => void
  disabled?: boolean
}

function ImagePicker({
  title, hint, aspect, url, inputRef,
  onPick, onFile, onUploadFromUrl, onClear, disabled,
}: ImagePickerProps) {
  const [urlInput, setUrlInput] = useState("")
  const [urlBusy, setUrlBusy] = useState(false)

  const handleUrlSubmit = async () => {
    if (!urlInput.trim() || urlBusy) return
    setUrlBusy(true)
    try {
      await onUploadFromUrl(urlInput)
      setUrlInput("")
    } finally {
      setUrlBusy(false)
    }
  }

  const aspectClass = aspect === "banner" ? "aspect-[16/5]" : "aspect-[4/3]"

  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium">{title}</Label>
      <div className={cn(
        "relative w-full overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center",
        aspectClass,
        disabled && "opacity-60"
      )}>
        {url ? (
          <>
            <Image src={getImageUrl(url) || "/placeholder.svg"} alt={title} fill unoptimized className="object-fill" />
            <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/50 flex items-center justify-center gap-2 transition-opacity">
              <Button type="button" size="sm" variant="secondary" onClick={onPick} disabled={disabled}>
                <Upload className="h-4 w-4 mr-1" /> Заменить
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={onClear} disabled={disabled}>
                <Trash2 className="h-4 w-4 mr-1" /> Удалить
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onPick}
            disabled={disabled}
            className="text-sm text-muted-foreground flex flex-col items-center gap-2 py-6"
          >
            <ImagePlus className="h-8 w-8" />
            {disabled ? "После сохранения" : "Загрузить с компьютера"}
          </button>
        )}
      </div>

      {/* Alt: загрузка по URL — картинка скачается на сервер и станет
          локальной, чтобы не зависеть от чужого хостинга. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="…или вставьте ссылку на картинку https://…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUrlSubmit() } }}
            disabled={disabled || urlBusy}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleUrlSubmit}
          disabled={disabled || urlBusy || !urlInput.trim()}
          className="shrink-0"
        >
          {urlBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Скачать"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}

