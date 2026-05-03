"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { BookOpen, Plus, Trash2, GripVertical, Film, Eye, Pencil } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import type { HelpArticle } from "@/app/actions/help-articles"
import { deleteHelpArticle, reorderHelpArticles } from "@/app/actions/help-articles"

function SortableCard({
  article,
  isAdmin,
  onDelete,
}: {
  article: HelpArticle
  isAdmin: boolean
  onDelete: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: article.id })
  const router = useRouter()
  const plain = article.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || ""
  const preview = plain.length > 140 ? plain.slice(0, 140) + "…" : plain

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
    >
      <CardContent className="p-4 flex gap-4">
        {isAdmin && (
          <button
            className="cursor-grab active:cursor-grabbing touch-none p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center"
            {...attributes}
            {...listeners}
            aria-label="Перетащить"
            title="Перетащить для изменения порядка"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => router.push(`/admin/help/${article.id}`)}
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-brand-yellow shrink-0" />
            <h3 className="font-semibold truncate">{article.title}</h3>
            {article.media?.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <Film className="h-3 w-3" />
                {article.media.length}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{preview || "—"}</p>
        </div>

        <div className="flex items-start gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => router.push(`/admin/help/${article.id}`)}
            className="h-8 w-8 rounded-full text-gray-600 hover:bg-gray-100"
            title="Открыть"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => router.push(`/admin/help/${article.id}?edit=1`)}
                className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
                onClick={() => onDelete(article.id)}
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function HelpArticlesList({ initialArticles }: { initialArticles: HelpArticle[] }) {
  const [articles, setArticles] = useState<HelpArticle[]>(initialArticles)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const { user } = useAuth()
  const { toast } = useToast()

  const isAdmin = user?.role === "admin"

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = articles.findIndex((a) => a.id === active.id)
    const newIdx = articles.findIndex((a) => a.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(articles, oldIdx, newIdx)
    setArticles(next)
    startTransition(async () => {
      const ok = await reorderHelpArticles(next.map((a) => a.id))
      if (!ok) {
        toast({ variant: "destructive", title: "Не удалось сохранить порядок" })
      }
    })
  }

  const confirmDelete = () => {
    if (pendingDeleteId == null) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    startTransition(async () => {
      const ok = await deleteHelpArticle(id)
      if (ok) {
        setArticles((list) => list.filter((a) => a.id !== id))
        toast({ title: "Инструкция удалена" })
      } else {
        toast({ variant: "destructive", title: "Не удалось удалить" })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-brand-yellow" />
            Справка
          </h1>
          <p className="text-sm text-gray-500 mt-1">Инструкции по работе с магазином</p>
        </div>
        {isAdmin && (
          <Button
            asChild
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
          >
            <Link href="/admin/help/new">
              <Plus className="h-4 w-4 mr-2" />
              Создать инструкцию
            </Link>
          </Button>
        )}
      </div>

      {articles.length === 0 ? (
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <CardContent className="py-12 text-center text-gray-500">
            Инструкций пока нет{isAdmin && ". Нажмите «Создать инструкцию», чтобы добавить первую."}
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={articles.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {articles.map((a) => (
                <SortableCard key={a.id} article={a} isAdmin={isAdmin} onDelete={setPendingDeleteId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={pendingDeleteId != null} onOpenChange={(o) => !o && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить инструкцию?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все прикреплённые видео также будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-[0_2px_6px_rgba(220,38,38,0.30)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.40)] transition-shadow"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
