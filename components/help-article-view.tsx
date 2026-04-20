"use client"

import React, { useState, useTransition, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { ArrowLeft, Pencil, Film, Upload, Trash2, Loader2, X as XIcon } from "lucide-react"

import { HelpArticleEditor } from "@/components/help-article-editor"
import { API_BASE_URL } from "@/lib/api-address"
import {
  deleteHelpVideo,
  type HelpArticle,
  type HelpArticleMedia,
} from "@/app/actions/help-articles"
import { uploadFileDirect } from "@/lib/upload-direct"

const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"]
const MAX_MB = 500

function absUrl(url: string) {
  if (!url) return ""
  if (url.startsWith("http")) return url
  return `${API_BASE_URL}${url}`
}

export function HelpArticleView({ article: initialArticle, initialEdit }: { article: HelpArticle; initialEdit: boolean }) {
  const [article, setArticle] = useState<HelpArticle>(initialArticle)
  const [editMode, setEditMode] = useState(initialEdit)
  const [uploading, setUploading] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const isAdmin = user?.role === "admin"

  const handleUpload = async (file: File) => {
    if (!ALLOWED.includes(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name)) {
      toast({ variant: "destructive", title: "Разрешены только MP4 / WebM / MOV" })
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ variant: "destructive", title: `Файл больше ${MAX_MB}MB` })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const result = await uploadFileDirect<HelpArticleMedia>(
        `/api/help-articles/${article.id}/videos`,
        fd,
      )
      setArticle((a) => ({ ...a, media: [...a.media, result] }))
      toast({ title: "Видео загружено" })
    } catch (e: any) {
      toast({ variant: "destructive", title: e?.message || "Не удалось загрузить видео" })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteVideo = () => {
    if (pendingDeleteId == null) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    startTransition(async () => {
      const ok = await deleteHelpVideo(id)
      if (ok) {
        setArticle((a) => ({ ...a, media: a.media.filter((m) => m.id !== id) }))
        toast({ title: "Видео удалено" })
      } else {
        toast({ variant: "destructive", title: "Не удалось удалить видео" })
      }
    })
  }

  if (editMode && isAdmin) {
    return (
      <HelpArticleEditor
        mode="edit"
        article={article}
        onSaved={(updated) => {
          setArticle((prev) => ({ ...prev, ...updated }))
          setEditMode(false)
          router.replace(`/admin/help/${article.id}`)
        }}
        onCancel={() => {
          setEditMode(false)
          router.replace(`/admin/help/${article.id}`)
        }}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/admin/help">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К списку
          </Link>
        </Button>
        {isAdmin && (
          <Button onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Редактировать
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{article.title}</h1>

          {article.content ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          ) : (
            <p className="text-gray-400">Описание не заполнено</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-brand-yellow" />
              <h2 className="text-lg font-semibold">Видео ({article.media.length})</h2>
            </div>
            {isAdmin && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file)
                  }}
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Добавить видео
                </Button>
              </>
            )}
          </div>

          {article.media.length === 0 ? (
            <p className="text-gray-400 text-sm">Видео не добавлены</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {article.media.map((m) => (
                <VideoCard
                  key={m.id}
                  media={m}
                  canDelete={isAdmin}
                  onDelete={() => setPendingDeleteId(m.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingDeleteId != null} onOpenChange={(o) => !o && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить видео?</AlertDialogTitle>
            <AlertDialogDescription>Файл будет удалён с сервера безвозвратно.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVideo} className="bg-red-500 hover:bg-red-600">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function VideoCard({
  media,
  canDelete,
  onDelete,
}: {
  media: HelpArticleMedia
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <div className="relative rounded-lg overflow-hidden bg-black group">
      <video
        controls
        preload="metadata"
        src={absUrl(media.url)}
        className="w-full aspect-video"
      />
      {canDelete && (
        <Button
          size="sm"
          variant="destructive"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      {media.filename && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
          {media.filename}
        </div>
      )}
    </div>
  )
}
