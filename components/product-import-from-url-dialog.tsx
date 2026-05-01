"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2,
  Wand2,
  Link as LinkIcon,
  X,
  Image as ImageLucide,
  AlertTriangle,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface ImportedProductData {
  name: string
  description: string
  image_urls: string[]
  characteristics: Array<{ key: string; value: string; unit: string }>
}

interface CharRow {
  key: string
  value: string
  unit: string
  enabled: boolean
}

interface ImageRow {
  url: string
  enabled: boolean
  failed: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (data: ImportedProductData) => void | Promise<void>
}

type Stage = "input" | "loading" | "preview"

// Animation phases — drive the sequential reveal of each field after the
// data lands. `done` means everything is visible and editable.
type AnimPhase = "name" | "description" | "characteristics" | "images" | "done"

const EXPAND_MS = 500
const NAME_TYPE_MS = 22  // ms per character for the name typewriter
const DESC_TYPE_MS = 5   // ms per character for the description (long text)
// Slower than the typewriter — gives time to follow the auto-scroll and
// actually read each item as it lands.
const CHAR_REVEAL_MS = 230  // ms between each characteristic row appearing
const IMG_REVEAL_MS = 190   // ms between each image card appearing

export function ProductImportFromUrlDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast()

  const [stage, setStage] = useState<Stage>("input")
  const [url, setUrl] = useState("")

  // Editable copies (what user sees / can change)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [chars, setChars] = useState<CharRow[]>([])
  const [images, setImages] = useState<ImageRow[]>([])

  // Snapshot of full data from API; phase animations read from these.
  const pendingRef = useRef<ImportedProductData | null>(null)

  const [animPhase, setAnimPhase] = useState<AnimPhase>("done")

  const [applying, setApplying] = useState(false)

  const descTextareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // No activationConstraint — same config as the existing reorder dialog
  // for homepage blocks, which feels snappy. Click-without-movement is
  // still treated as a click (not a drag) by PointerSensor by default,
  // so toggle-on-click on the card body still works.
  const dndSensors = useSensors(useSensor(PointerSensor))

  const resetAll = () => {
    setStage("input")
    setUrl("")
    setName("")
    setDescription("")
    setChars([])
    setImages([])
    setAnimPhase("done")
    pendingRef.current = null
  }

  // Reset after close animation finishes
  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(resetAll, 250)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const handleClose = (next: boolean) => {
    if (stage === "loading" || applying) return
    onOpenChange(next)
  }

  const handleFetch = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed)) {
      toast({
        title: "Некорректная ссылка",
        description: "URL должен начинаться с http:// или https://",
        variant: "destructive",
      })
      return
    }

    setStage("loading")
    try {
      const resp = await fetch("/api/product-import/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const payload = await resp.json()
      if (!resp.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${resp.status}`)
      }
      const data = payload.data as ImportedProductData
      pendingRef.current = data

      // Reset visible state to empty — animations will fill it in.
      setName("")
      setDescription("")
      setChars([])
      setImages([])

      setStage("preview")

      // Wait for the modal-expand transition to complete before kicking
      // off the typewriter cascade — otherwise everything starts mid-grow.
      window.setTimeout(() => {
        setAnimPhase("name")
      }, EXPAND_MS)
    } catch (e: any) {
      console.error("Auto-fill failed:", e)
      toast({
        title: "Не удалось импортировать",
        description: e?.message || "Попробуйте ещё раз",
        variant: "destructive",
      })
      setStage("input")
    }
  }

  // ─── Phase: name typewriter ────────────────────────────────────────
  useEffect(() => {
    if (animPhase !== "name") return
    const target = pendingRef.current?.name || ""
    if (!target) {
      setAnimPhase("description")
      return
    }
    let i = 0
    const interval = window.setInterval(() => {
      i++
      setName(target.slice(0, i))
      if (i >= target.length) {
        window.clearInterval(interval)
        window.setTimeout(() => setAnimPhase("description"), 150)
      }
    }, NAME_TYPE_MS)
    return () => window.clearInterval(interval)
  }, [animPhase])

  // ─── Phase: description typewriter ─────────────────────────────────
  useEffect(() => {
    if (animPhase !== "description") return
    const target = pendingRef.current?.description || ""
    if (!target) {
      setAnimPhase("characteristics")
      return
    }
    let i = 0
    const interval = window.setInterval(() => {
      // Type 2 chars per tick to keep long descriptions snappy.
      i = Math.min(i + 2, target.length)
      setDescription(target.slice(0, i))
      if (i >= target.length) {
        window.clearInterval(interval)
        window.setTimeout(() => setAnimPhase("characteristics"), 150)
      }
    }, DESC_TYPE_MS)
    return () => window.clearInterval(interval)
  }, [animPhase])

  // Compute and set the textarea height to fit its content. box-sizing
  // is border-box (Tailwind default) so `height` includes border, but
  // `scrollHeight` only includes padding + content. We add the border
  // delta (offsetHeight - clientHeight while height is auto) to avoid
  // clipping the last line by 1-2px.
  const adjustDescriptionHeight = useCallback(() => {
    const el = descTextareaRef.current
    if (!el) return
    el.style.height = "auto"
    const borderDelta = el.offsetHeight - el.clientHeight
    el.style.height = `${el.scrollHeight + borderDelta}px`
  }, [])

  // Re-measure on every description change (typewriter + user editing).
  useEffect(() => {
    adjustDescriptionHeight()
  }, [description, adjustDescriptionHeight])

  // Permanent ResizeObserver: catches reflows that happen AFTER the last
  // description change — most commonly when a vertical scrollbar appears
  // in the parent scroll container (because chars/images push content
  // taller than the modal). The scrollbar steals ~15px of textarea
  // width, text re-wraps, and the previously-computed height no longer
  // fits the now-taller content. Without this observer those late
  // reflows were clipping one or two lines off the bottom.
  useEffect(() => {
    const el = descTextareaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => adjustDescriptionHeight())
    ro.observe(el)
    return () => ro.disconnect()
  }, [adjustDescriptionHeight])

  // Final pass when all animations have settled: layout is at its true
  // resting state, scrollbars (if any) are present, fonts are loaded.
  useEffect(() => {
    if (animPhase !== "done") return
    // Two frames to be sure the parent layout (scroll container) has
    // also reached its final state before we measure.
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(adjustDescriptionHeight)
      ;(adjustDescriptionHeight as any)._r2 = r2
    })
    return () => cancelAnimationFrame(r1)
  }, [animPhase, adjustDescriptionHeight])

  // ─── Phase: characteristics one-by-one ─────────────────────────────
  useEffect(() => {
    if (animPhase !== "characteristics") return
    const target = pendingRef.current?.characteristics || []
    if (target.length === 0) {
      setAnimPhase("images")
      return
    }
    let i = 0
    const interval = window.setInterval(() => {
      i++
      setChars(
        target.slice(0, i).map((c) => ({
          key: c.key,
          value: c.value,
          unit: c.unit || "",
          enabled: true,
        })),
      )
      if (i >= target.length) {
        window.clearInterval(interval)
        window.setTimeout(() => setAnimPhase("images"), 150)
      }
    }, CHAR_REVEAL_MS)
    return () => window.clearInterval(interval)
  }, [animPhase])

  // ─── Phase: images one-by-one ──────────────────────────────────────
  useEffect(() => {
    if (animPhase !== "images") return
    const target = pendingRef.current?.image_urls || []
    if (target.length === 0) {
      setAnimPhase("done")
      return
    }
    let i = 0
    const interval = window.setInterval(() => {
      i++
      setImages(target.slice(0, i).map((u) => ({ url: u, enabled: true, failed: false })))
      if (i >= target.length) {
        window.clearInterval(interval)
        // Hold on the last image for a beat before snapping to the top —
        // gives the operator a moment to see what landed last instead of
        // the view jumping away the instant the cascade finishes.
        window.setTimeout(() => setAnimPhase("done"), 1000)
      }
    }, IMG_REVEAL_MS)
    return () => window.clearInterval(interval)
  }, [animPhase])

  // Reaches `done` once all phases have finished. Inputs become editable
  // only at that point so the user doesn't accidentally type over the
  // typewriter mid-stream.
  const isAnimating = animPhase !== "done"

  // Auto-scroll: keep the most recently appearing item in view during the
  // characteristics / images reveal phases; once everything is in, snap
  // back to the top so the user lands on the name field.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (animPhase === "characteristics" || animPhase === "images") {
      el.scrollTop = el.scrollHeight
    }
  }, [animPhase, chars.length, images.length])

  useEffect(() => {
    if (animPhase !== "done") return
    const el = scrollRef.current
    if (!el) return
    // Smooth snap back to the top after the cascade finishes.
    el.scrollTo({ top: 0, behavior: "smooth" })
  }, [animPhase])

  const enabledCharsCount = chars.filter((c) => c.enabled).length
  const enabledImagesCount = images.filter((i) => i.enabled).length

  // Stable id list for SortableContext — recomputed only when image
  // identities change (not on every parent render). Without memoization
  // the new array reference each render makes drag feel jumpy.
  const imageIds = useMemo(() => images.map((im) => im.url), [images])

  // Width of the unit column = max length among visible units + 1, with a
  // floor of 3 so empty units still have room. `ch` is the width of a `0`
  // glyph; combined with input padding it gives a snug fit per row.
  const maxUnitLen = useMemo(
    () => Math.max(3, ...chars.map((c) => c.unit.length)) + 1,
    [chars],
  )

  const updateChar = (i: number, patch: Partial<CharRow>) => {
    setChars((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  const toggleImage = (i: number) => {
    setImages((prev) => prev.map((im, idx) => (idx === i ? { ...im, enabled: !im.enabled } : im)))
  }
  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }
  const markImageFailed = (url: string) => {
    setImages((prev) => prev.map((im) => (im.url === url ? { ...im, failed: true } : im)))
  }

  const handleImageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setImages((prev) => {
      const oldIndex = prev.findIndex((im) => im.url === active.id)
      const newIndex = prev.findIndex((im) => im.url === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      // Order matters for images — backend uses the request order to set
      // ProductMedia.order, which controls display order on the storefront.
      const filtered: ImportedProductData = {
        name: name.trim(),
        description: description.trim(),
        characteristics: chars
          .filter((c) => c.enabled && c.key.trim() && c.value.trim())
          .map((c) => ({
            key: c.key.trim(),
            value: c.value.trim(),
            unit: c.unit.trim(),
          })),
        image_urls: images.filter((i) => i.enabled).map((i) => i.url),
      }
      await onImported(filtered)
      onOpenChange(false)
    } catch (e: any) {
      toast({
        title: "Ошибка применения",
        description: e?.message || "Что-то пошло не так",
        variant: "destructive",
      })
    } finally {
      setApplying(false)
    }
  }

  const isPreview = stage === "preview"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        // Override shadcn defaults: it ships with `grid gap-4 p-6` which
        // prevents children from filling the parent's height (grid cells
        // are auto-sized) and breaks our inner flex scroll chain. Force
        // block display so `h-full` on our inner flex container cascades
        // correctly. `gap-4` is a no-op on block parents so nothing else
        // needs to change.
        className="!block p-0 overflow-hidden transition-all ease-out"
        style={{
          transitionDuration: `${EXPAND_MS}ms`,
          transitionProperty: "width, max-width, height, max-height",
          width: isPreview ? "80vw" : "28rem",
          maxWidth: isPreview ? "80vw" : "28rem",
          height: isPreview ? "80vh" : "auto",
          maxHeight: isPreview ? "80vh" : "90vh",
        }}
      >
        <div className="flex h-full">
          {/* ─── Left: URL panel (compacts on preview) ────────────────── */}
          <div
            className={cn(
              "flex-shrink-0 transition-[width,padding] ease-out flex flex-col",
              isPreview ? "w-[320px] border-r p-5" : "w-full p-6",
            )}
            style={{ transitionDuration: `${EXPAND_MS}ms` }}
          >
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-brand-yellow" />
                Импорт из URL
              </DialogTitle>
              {!isPreview && (
                <DialogDescription>
                  Вставьте ссылку на страницу товара с любого сайта. PosPro AI
                  прочитает страницу и предложит данные для заполнения.
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-3 pt-4">
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="url"
                  placeholder="https://entero.ru/item/149701"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && stage === "input") handleFetch()
                  }}
                  disabled={stage === "loading" || isPreview}
                  className="pl-9 h-10"
                  autoFocus={stage === "input"}
                />
              </div>

              {stage === "loading" && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Парсим страницу через PosPro AI…
                </div>
              )}

              {!isPreview && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => handleClose(false)}
                    disabled={stage === "loading"}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleFetch}
                    disabled={stage === "loading" || !url.trim()}
                    className="bg-brand-yellow hover:bg-yellow-500 text-black gap-2"
                  >
                    {stage === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    Импортировать
                  </Button>
                </div>
              )}

              {isPreview && (
                <div className="space-y-2 pt-2 text-xs text-gray-500">
                  <div>Источник:</div>
                  <div className="break-all bg-gray-50 rounded px-2 py-1 font-mono">{url}</div>
                  <div className="pt-2 text-gray-600">
                    {isAnimating
                      ? "PosPro AI заполняет данные…"
                      : "Снимите галочки с того, что не нужно, перетащите фото для смены порядка, и нажмите «Применить»."}
                  </div>
                </div>
              )}
            </div>

            {/* Warning notice — pinned to the bottom of the left panel via
                mt-auto. Reminds the operator that AI extraction can be
                wrong and to verify before saving. Only shown in preview
                stage where there's actually data to review. */}
            {isPreview && (
              <div className="mt-auto pt-4">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs space-y-1.5 text-center shadow-md shadow-amber-200/50">
                  <div className="flex items-center justify-center gap-1.5 font-semibold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    ВНИМАНИЕ
                  </div>
                  <div className="text-amber-900/90">
                    Импортированные данные могут быть с ошибками.
                  </div>
                  <div className="text-amber-900/90">
                    Перед подтверждением проверьте информацию которую собрал вам{" "}
                    <span className="whitespace-nowrap">PosPro AI</span>.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Right: review panel ───────────────────────────────── */}
          {isPreview && (
            <div
              className="flex-1 min-w-0 flex flex-col h-full min-h-0 animate-in fade-in slide-in-from-left-8"
              style={{ animationDuration: `${EXPAND_MS}ms` }}
            >
              {/* Scroll area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
                {/* Name */}
                <div>
                  <Label className="text-sm font-medium">Название</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isAnimating && animPhase === "name"}
                    className="mt-1.5"
                  />
                </div>

                {/* Description (auto-grow) */}
                <div>
                  <Label className="text-sm font-medium">Описание</Label>
                  <Textarea
                    ref={descTextareaRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isAnimating && (animPhase === "name" || animPhase === "description")}
                    className="mt-1.5 resize-none overflow-hidden min-h-[80px]"
                  />
                </div>

                {/* Characteristics */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Характеристики
                    <span className="text-gray-400 font-normal ml-2">
                      ({enabledCharsCount} / {chars.length})
                    </span>
                  </Label>
                  <div className="space-y-1">
                    {chars.length === 0 && animPhase === "done" && (
                      <div className="text-xs text-gray-400 py-2">
                        AI не нашёл характеристик
                      </div>
                    )}
                    {chars.map((c, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md animate-in fade-in slide-in-from-left-2 duration-200",
                          c.enabled ? "bg-white" : "bg-gray-50 opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={c.enabled}
                          onCheckedChange={(v) => updateChar(i, { enabled: Boolean(v) })}
                          className="data-[state=checked]:bg-brand-yellow data-[state=checked]:border-brand-yellow flex-shrink-0"
                        />
                        {/* Key + unit are read-only on purpose: editing
                            them creates new entries in CharacteristicsList
                            (the shared справочник), polluting it with
                            typos / variants. If the AI got the key wrong,
                            untick the row and add via the regular char
                            dialog later. Only value stays editable. */}
                        <Input
                          value={c.key}
                          disabled
                          placeholder="Ключ"
                          className="h-8 text-xs flex-1 min-w-0 bg-gray-50 disabled:opacity-100 disabled:cursor-default"
                        />
                        <Input
                          value={c.value}
                          onChange={(e) => updateChar(i, { value: e.target.value })}
                          placeholder="Значение"
                          className="h-8 text-xs flex-1 min-w-0"
                        />
                        <Input
                          value={c.unit}
                          disabled
                          placeholder="Ед."
                          style={{ width: `calc(${maxUnitLen}ch + 1.5rem)` }}
                          className="h-8 text-xs flex-shrink-0 bg-gray-50 disabled:opacity-100 disabled:cursor-default"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Images (drag-and-drop reorder) */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Фото
                    <span className="text-gray-400 font-normal ml-2">
                      ({enabledImagesCount} / {images.length})
                    </span>
                    {images.length > 1 && (
                      <span className="text-[11px] text-gray-400 font-normal ml-2">
                        (перетаскивайте для смены порядка)
                      </span>
                    )}
                  </Label>
                  {images.length === 0 && animPhase === "done" ? (
                    <div className="text-xs text-gray-400 py-2">
                      AI не нашёл изображений товара
                    </div>
                  ) : (
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleImageDragEnd}
                    >
                      <SortableContext
                        items={imageIds}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                          {images.map((im, i) => (
                            <SortableImageCard
                              key={im.url}
                              image={im}
                              order={i}
                              onToggle={() => toggleImage(i)}
                              onRemove={() => removeImage(i)}
                              onFailed={() => markImageFailed(im.url)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>

              {/* Bottom action bar */}
              <div className="flex-shrink-0 border-t bg-gray-50 px-5 py-3 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  Будет добавлено: {enabledCharsCount} характ., {enabledImagesCount} фото
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleClose(false)}
                    disabled={applying}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={applying || isAnimating || !name.trim()}
                    className="bg-brand-yellow hover:bg-yellow-500 text-black gap-2"
                  >
                    {applying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    Применить
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sortable image card. The whole card is draggable — same pattern as the
// homepage-blocks reorder dialog, which feels snappy. We deliberately
// avoid:
//   - separate drag handle (forces user to aim a tiny target)
//   - any CSS animation that touches `transform` (would fight @dnd-kit's
//     translate3d during drag and cause stutter)
//   - inline style.opacity (use className so `transition-opacity` still
//     fires once and doesn't repaint every frame)
// PointerSensor with no activationConstraint still distinguishes click
// from drag based on movement, so onClick handlers for toggle / remove
// continue to work even with listeners spread on the parent.
function SortableImageCard({
  image,
  order,
  onToggle,
  onRemove,
  onFailed,
}: {
  image: ImageRow
  order: number
  onToggle: () => void
  onRemove: () => void
  onFailed: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.url,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onToggle}
      className={cn(
        "relative aspect-square rounded-lg border-2 overflow-hidden bg-white group cursor-grab active:cursor-grabbing select-none touch-none",
        image.enabled
          ? "border-brand-yellow ring-1 ring-brand-yellow/40"
          : "border-gray-200 opacity-50",
        isDragging && "opacity-50 shadow-lg z-50",
      )}
    >
      {image.failed ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1 pointer-events-none">
          <ImageLucide className="h-6 w-6" />
          <span className="text-[10px]">Не загрузилось</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt=""
          onError={onFailed}
          draggable={false}
          className="w-full h-full object-contain p-1 pointer-events-none"
        />
      )}

      {/* Enabled checkmark (bottom-left) — clickable, same stopPropagation
          pattern as the remove button. Acts as a redundant click target
          alongside the card body so the operator can aim precisely at the
          indicator without worrying about hitting the image area. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "absolute bottom-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center text-xs font-bold shadow-sm transition-colors",
          image.enabled
            ? "bg-brand-yellow text-black hover:bg-yellow-500"
            : "bg-white border border-gray-300 text-transparent hover:bg-gray-100",
        )}
        title={image.enabled ? "Выключить" : "Включить"}
      >
        ✓
      </button>

      {/* Order badge (bottom-right) */}
      <div className="absolute bottom-1.5 right-1.5 min-w-5 h-5 px-1 rounded bg-black/60 text-white text-[10px] flex items-center justify-center pointer-events-none">
        {order + 1}
      </div>

      {/* Remove (top-right, on hover). stopPropagation so card-level
          click (toggle) doesn't fire alongside. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-white/90 hover:bg-red-500 hover:text-white text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        title="Убрать из списка"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
