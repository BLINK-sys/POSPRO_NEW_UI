"use client"

/**
 * Универсальная карточка «Документы» для CRM-сущности (сделка/задача).
 * Хранит вложения через полиморфный `entity_attachment`. Общий компонент
 * заменяет deal-documents-card и task-documents-card — те стали тонкими
 * обёртками.
 *
 * Бэк:
 *   GET    /api/admin/{deals|tasks}/<id>/attachments
 *   POST   /api/admin/{deals|tasks}/<id>/attachments   multipart (title в form)
 *   PUT    /api/admin/attachments/<aid>                {"title": "..."}
 *   DELETE /api/admin/attachments/<aid>
 *   GET    /api/admin/attachments/<aid>/download
 *
 * Особенности:
 *  • изображения показываем как превью-миниатюру в карточке (сверху
 *    картинка object-cover, снизу заголовок), остальные — цветная
 *    типовая шапка + название;
 *  • проп `refreshKey` — внешний триггер refetch (родитель инкрементит
 *    когда, например, файл был загружен из чата, чтобы список
 *    обновился без reload страницы).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Upload, FileText, Download, Trash2, Loader2, File as FileIcon,
  Image as ImageIcon, Video as VideoIcon, Check, X,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"
import { crmGet, crmPut, crmDelete, crmUpload } from "@/lib/crm-fetch"
import { getImageUrl } from "@/lib/image-utils"

interface Attachment {
  id: number
  entity_type: string
  entity_id: number
  file_url: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  title: string | null
  uploaded_by: number | null
  uploaded_at: string | null
}

interface Props {
  entityType: "deal" | "task"
  entityId: number
  usersById: Map<number, string>
  /**
   * Внешний триггер обновления списка. При изменении номера — компонент
   * заново дёргает GET. Используется когда файл появился «сбоку»
   * (например upload из чата) и родитель хочет обновить документы без
   * перезагрузки страницы.
   */
  refreshKey?: number
}

export default function CrmDocumentsCard({
  entityType, entityId, usersById, refreshKey,
}: Props) {
  const { toast } = useToast()

  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const listUrl = `/api/admin/${entityType}s/${entityId}/attachments`

  const load = useCallback(() => {
    setLoading(true)
    crmGet<{ attachments: Attachment[] }>(listUrl)
      .then((res) => setItems(res.attachments || []))
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить документы",
          description: e?.message,
        })
      })
      .finally(() => setLoading(false))
  }, [listUrl, toast])

  useEffect(() => { load() }, [load, refreshKey])

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setUploading({ done: 0, total: list.length })
    let success = 0
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      try {
        const fd = new FormData()
        fd.append("file", f)
        await crmUpload<{ attachment: Attachment }>(listUrl, fd)
        success++
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: `Не загрузилось: ${f.name}`,
          description: e?.message,
        })
      }
      setUploading({ done: i + 1, total: list.length })
    }
    setUploading(null)
    if (success > 0) {
      toast({
        title: `Загружено: ${success}${list.length > success ? ` из ${list.length}` : ""}`,
      })
      load()
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (uploading) return
    handleFiles(e.dataTransfer.files)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await crmDelete(`/api/admin/attachments/${deleteTarget.id}`)
      toast({ title: "Документ удалён" })
      setItems((prev) => prev.filter((a) => a.id !== deleteTarget.id))
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleTitleSave = async (a: Attachment, newTitle: string) => {
    const value = newTitle.trim() || null
    if ((a.title || null) === value) return
    setItems((prev) => prev.map((x) => x.id === a.id ? { ...x, title: value } : x))
    try {
      await crmPut(`/api/admin/attachments/${a.id}`, { title: value })
    } catch (e: any) {
      setItems((prev) => prev.map((x) => x.id === a.id ? a : x))
      toast({
        variant: "destructive",
        title: "Не удалось сохранить заголовок",
        description: e?.message,
      })
    }
  }

  const handleDownload = (a: Attachment) => {
    window.open(`/api/admin/attachments/${a.id}/download`, "_blank", "noopener,noreferrer")
  }

  return (
    <Card className="rounded-xl border-gray-200 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Документы {items.length > 0 && <span className="text-gray-400 font-normal">({items.length})</span>}
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(uploading)}
          className="text-[11px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-0.5 focus:outline-none disabled:opacity-50"
        >
          <Upload className="h-3 w-3" /> загрузить
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border border-dashed transition-colors text-center",
          "px-3 py-2 text-xs",
          dragOver
            ? "border-brand-yellow bg-brand-yellow/10 text-gray-700"
            : "border-gray-300 bg-gray-50/50 text-gray-500",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin inline" />
            Загружаем {uploading.done} / {uploading.total}…
          </>
        ) : (
          <>Перетащите файлы сюда или нажмите «загрузить» выше</>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            if (inputRef.current) inputRef.current.value = ""
          }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? null : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((a) => (
            <DocCard
              key={a.id}
              item={a}
              uploader={
                a.uploaded_by != null
                  ? usersById.get(a.uploaded_by) ?? `#${a.uploaded_by}`
                  : null
              }
              onDownload={() => handleDownload(a)}
              onDelete={() => setDeleteTarget(a)}
              onTitleSave={(t) => handleTitleSave(a, t)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title || deleteTarget?.file_name}» будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ============================================================================

function DocCard({
  item,
  uploader,
  onDownload,
  onDelete,
  onTitleSave,
}: {
  item: Attachment
  uploader: string | null
  onDownload: () => void
  onDelete: () => void
  onTitleSave: (t: string) => void
}) {
  const { Icon, label, tint } = typeMeta(item.mime_type, item.file_name)
  const isImage = isImageAttachment(item.mime_type, item.file_name)

  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(item.title || "")

  const commit = () => { onTitleSave(draftTitle); setEditing(false) }
  const cancel = () => { setDraftTitle(item.title || ""); setEditing(false) }

  const displayTitle = item.title || item.file_name || "Без названия"

  return (
    <div className="group relative rounded-lg border border-gray-200 bg-white overflow-hidden hover:border-gray-300 transition-colors flex flex-col">
      {isImage ? (
        <div className="relative aspect-[4/3] bg-gray-100">
          <img
            src={getImageUrl(item.file_url)}
            alt={item.file_name || ""}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-1 right-1 flex items-center gap-0.5">
            <IconButton onClick={onDownload} title="Скачать" className="bg-white/70 hover:bg-white">
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton onClick={onDelete} title="Удалить" className="bg-white/70 hover:bg-white text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 border-b border-gray-100",
          tint,
        )}>
          <Icon className="h-5 w-5 shrink-0" />
          <span className="text-[10px] uppercase tracking-wider font-semibold">
            {label}
          </span>
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            <IconButton onClick={onDownload} title="Скачать">
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton onClick={onDelete} title="Удалить" className="text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      )}

      <div className="px-3 pt-2 pb-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") cancel()
              }}
              placeholder="Заголовок документа"
              className="h-7 text-sm font-medium focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
            />
            <button onClick={commit} className="text-emerald-600 p-1 focus:outline-none" title="Сохранить">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={cancel} className="text-gray-400 p-1 focus:outline-none" title="Отмена">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setDraftTitle(item.title || ""); setEditing(true) }}
            className={cn(
              "block text-left w-full text-sm truncate hover:underline decoration-dotted focus:outline-none",
              item.title ? "font-medium text-gray-900" : "text-gray-500 italic",
            )}
            title={item.title ? "Изменить заголовок" : "Задать заголовок"}
          >
            {displayTitle}
          </button>
        )}
        <div className="text-[11px] text-gray-500 truncate mt-0.5" title={item.file_name || ""}>
          {item.file_name || "—"}
        </div>
      </div>

      <div className="px-3 pb-2 mt-auto text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
        <span>{formatSize(item.file_size)}</span>
        <span>·</span>
        <span>{formatDate(item.uploaded_at)}</span>
        {uploader && (<><span>·</span><span className="truncate">{uploader}</span></>)}
      </div>
    </div>
  )
}

function IconButton({
  children,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1 rounded hover:bg-white/60 focus:outline-none",
        className,
      )}
    >
      {children}
    </button>
  )
}

function isImageAttachment(mime: string | null, name: string | null): boolean {
  const m = (mime || "").toLowerCase()
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  return m.startsWith("image/")
    || ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)
}

function typeMeta(mime: string | null, name: string | null): {
  Icon: any; label: string; tint: string
} {
  const m = (mime || "").toLowerCase()
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return { Icon: ImageIcon, label: ext || "IMAGE", tint: "bg-violet-50 text-violet-700" }
  if (m.startsWith("video/") || ["mp4", "mov", "webm", "avi", "mkv"].includes(ext))
    return { Icon: VideoIcon, label: ext || "VIDEO", tint: "bg-pink-50 text-pink-700" }
  if (m === "application/pdf" || ext === "pdf")
    return { Icon: FileText, label: "PDF", tint: "bg-red-50 text-red-700" }
  if (["doc", "docx", "odt", "rtf"].includes(ext))
    return { Icon: FileText, label: ext.toUpperCase(), tint: "bg-blue-50 text-blue-700" }
  if (["xls", "xlsx", "ods", "csv"].includes(ext))
    return { Icon: FileText, label: ext.toUpperCase(), tint: "bg-emerald-50 text-emerald-700" }
  if (["ppt", "pptx", "odp"].includes(ext))
    return { Icon: FileText, label: ext.toUpperCase(), tint: "bg-orange-50 text-orange-700" }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return { Icon: FileIcon, label: ext.toUpperCase(), tint: "bg-amber-50 text-amber-700" }
  if (["txt", "md", "log"].includes(ext))
    return { Icon: FileText, label: ext.toUpperCase(), tint: "bg-gray-100 text-gray-700" }
  return {
    Icon: FileIcon,
    label: (ext || "file").toUpperCase().slice(0, 6),
    tint: "bg-gray-50 text-gray-600",
  }
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} КБ`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} МБ`
  return `${(mb / 1024).toFixed(2)} ГБ`
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}
