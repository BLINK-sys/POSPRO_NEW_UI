"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { GripVertical, Loader2, Search, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getAllSectionCards, type SectionCardData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"
import { useAuth } from "@/context/auth-context"
import { useAdminTools } from "@/context/admin-tools-context"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export default function SectionsPage() {
  const [cards, setCards] = useState<SectionCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const { user } = useAuth()
  const { visible: adminToolsVisible } = useAdminTools()
  const { toast } = useToast()
  // Drag&drop разрешаем только когда:
  //   1) юзер — admin/system
  //   2) глобальный тумблер «Инструменты» включен (шапка → Wrench)
  //   3) нет активного поискового фильтра (иначе перетаскивание видимой
  //      подмножки нельзя корректно смапить в глобальный порядок).
  const canReorder =
    (user?.role === "admin" || user?.role === "system") &&
    adminToolsVisible &&
    query.trim() === ""

  useEffect(() => {
    let ignore = false
    getAllSectionCards()
      .then((data) => { if (!ignore) setCards(data || []) })
      .catch((err) => console.error("Error loading section cards:", err))
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cards
    return cards.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q)
    )
  }, [cards, query])

  // Небольшой distance 5px — обычный клик по карточке всё ещё срабатывает,
  // drag начинается только при сдвиге курсора.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cards.findIndex((c) => c.id === Number(active.id))
    const newIndex = cards.findIndex((c) => c.id === Number(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(cards, oldIndex, newIndex)
    const prev = cards
    setCards(reordered)
    try {
      await apiClient.post(
        "/api/admin/section-cards/reorder",
        reordered.map((c, i) => ({ id: c.id, order: i })),
      )
      toast({ title: "Порядок сохранён" })
    } catch (e: any) {
      setCards(prev)
      toast({
        title: "Ошибка",
        description: e?.message ?? "Не удалось сохранить порядок",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <h1 className="text-3xl font-bold mb-2 text-center">Готовые решения</h1>
      <p className="text-center text-gray-600 mb-6 text-sm">
        Оборудование, подобранное под конкретный тип бизнеса
      </p>

      <div className="max-w-md mx-auto mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию"
            className="pl-9 pr-9 h-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {canReorder && cards.length > 1 && (
          <p className="text-center text-[11px] text-gray-500 mt-2">
            Перетащите карточки за иконку <GripVertical className="inline h-3 w-3 -mt-0.5" /> для смены порядка
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">Ничего не найдено</div>
      ) : canReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((card) => (
                <SortableTile key={card.id} card={card} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((card) => (
            <SectionCardTile key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Обычная нередактируемая плитка — как раньше. Используется для клиентов
 * или когда админ выключил «Инструменты» в шапке.
 */
function SectionCardTile({ card }: { card: SectionCardData }) {
  const href = card.target === "categories"
    ? `/section/${card.slug}`
    : (card.link_url || `/section/${card.slug}`)
  const openNewTab = card.target === "link" && card.link_new_tab
  const linkProps = openNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {}

  return (
    <Link href={href} {...linkProps} className="block group h-full">
      <TileInner card={card} />
    </Link>
  )
}

/**
 * Sortable-обёртка плитки: тот же вид что и обычная, плюс drag-handle
 * в левом верхнем углу картинки. Клик по остальной площади карточки
 * по-прежнему ведёт на /section/<slug> — обычный <a> внутри, dnd-kit
 * активируется только при сдвиге курсора на 5+ px.
 */
function SortableTile({ card }: { card: SectionCardData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  const href = card.target === "categories"
    ? `/section/${card.slug}`
    : (card.link_url || `/section/${card.slug}`)
  const openNewTab = card.target === "link" && card.link_new_tab
  const linkProps = openNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {}

  return (
    <div ref={setNodeRef} style={style} className="relative h-full">
      {/* Drag-handle всегда виден. Клик по нему не открывает ссылку —
          stopPropagation, потому что <a> оборачивает всю плитку. */}
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.preventDefault()}
        className="absolute top-2 left-2 z-20 p-1.5 rounded-full bg-white/90 text-gray-600 hover:text-gray-900 hover:bg-white shadow cursor-grab active:cursor-grabbing touch-none"
        title="Перетащите для смены порядка"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <Link href={href} {...linkProps} className="block group h-full">
        <TileInner card={card} />
      </Link>
    </div>
  )
}

/**
 * Внутренняя разметка плитки — общая для Sortable и обычной.
 */
function TileInner({ card }: { card: SectionCardData }) {
  return (
    <Card className="overflow-hidden rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition-all duration-300 h-full flex flex-col bg-white">
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {card.image_url ? (
          <Image
            src={getImageUrl(card.image_url)}
            alt={card.name}
            fill
            unoptimized
            className="object-fill group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            Нет изображения
          </div>
        )}
      </div>
      <CardContent className="p-4 flex-1 flex flex-col gap-1.5">
        <h3 className="font-semibold text-base leading-tight text-gray-900 line-clamp-2">
          {card.name}
        </h3>
        {card.description && (
          <p className="text-sm text-gray-600 line-clamp-3">
            {card.description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
