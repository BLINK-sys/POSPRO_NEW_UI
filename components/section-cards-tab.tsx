"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Edit, ExternalLink, Layers, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import AdminLoading from "@/components/admin-loading"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { getImageUrl } from "@/lib/image-utils"

import SectionCardEditDialog, { type SectionCard } from "./section-card-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"

export default function SectionCardsTab() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cards, setCards] = useState<SectionCard[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SectionCard | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState<SectionCard | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Один раз обрабатываем deep-link ?edit-section-card=<id> — после
  // открытия модалки чистим query, чтобы повторное открытие не
  // тригерилось на каждом рендере.
  const deepLinkHandled = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<SectionCard[]>("/api/admin/section-cards")
      setCards(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message ?? "Не удалось загрузить карточки", variant: "destructive" })
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  // Deep-link из кнопки-карандаша на витрине: как только карточки
  // подгрузились и в URL есть ?edit-section-card=<id>, находим нужную
  // и открываем модалку. URL сразу чистим.
  useEffect(() => {
    if (deepLinkHandled.current) return
    if (loading || cards.length === 0) return
    const raw = searchParams.get("edit-section-card")
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id)) return
    const found = cards.find((c) => c.id === id)
    if (!found) return
    deepLinkHandled.current = true
    setEditing(found)
    setEditOpen(true)
    router.replace("/admin/pages", { scroll: false })
  }, [loading, cards, searchParams, router])

  const openCreate = () => { setEditing(null); setEditOpen(true) }
  const openEdit = (c: SectionCard) => { setEditing(c); setEditOpen(true) }
  const askDelete = (c: SectionCard) => { setDeleting(c); setDeleteOpen(true) }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await apiClient.delete(`/api/admin/section-cards/${deleting.id}`)
      toast({ title: "Удалено" })
      load()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message ?? String(e), variant: "destructive" })
    } finally {
      setDeleteOpen(false)
      setDeleting(null)
    }
  }

  if (loading) return <AdminLoading text="Загрузка карточек разделов…" />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-base font-semibold">Карточки разделов</h4>
          <p className="text-sm text-muted-foreground">
            Пул карточек для блоков «Карточки разделов» на главной. Один клик — ссылка или страница-агрегатор с товарами из выбранных категорий.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить карточку
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card className="rounded-xl border border-gray-200">
          <CardContent className="text-center py-10">
            <p className="text-muted-foreground mb-4">Карточки разделов ещё не созданы</p>
            <Button
              onClick={openCreate}
              className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать первую
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Card
              key={c.id}
              className="relative group overflow-hidden rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all"
            >
              <div className="relative aspect-[4/3] w-full bg-gray-100">
                {c.image_url ? (
                  <Image
                    src={getImageUrl(c.image_url) || "/placeholder.svg"}
                    alt={c.name}
                    fill
                    unoptimized
                    className="object-fill"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Нет изображения
                  </div>
                )}
                {!c.active && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-gray-800 text-white">Скрыта</Badge>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white text-blue-600 hover:bg-blue-50 shadow"
                    onClick={() => openEdit(c)}
                    title="Редактировать"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white text-red-500 hover:bg-red-50 shadow"
                    onClick={() => askDelete(c)}
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <div>
                  <h5 className="font-semibold text-base leading-tight line-clamp-2">{c.name}</h5>
                  <p className="text-xs text-muted-foreground mt-1">
                    /section/{c.slug}
                  </p>
                </div>
                {c.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {c.target === "categories" ? (
                    <Badge variant="outline" className="gap-1">
                      <Layers className="h-3 w-3" />
                      {c.category_ids?.length ?? 0} категорий
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 max-w-full truncate">
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{c.link_url || "нет URL"}</span>
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SectionCardEditDialog
        card={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={load}
      />

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Удалить карточку раздела"
        description={`Удалить «${deleting?.name}»? Также будут удалены загруженные изображения.`}
      />
    </div>
  )
}
