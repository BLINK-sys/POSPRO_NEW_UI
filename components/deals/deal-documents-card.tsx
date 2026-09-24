"use client"

/**
 * Прикреплённые документы к сделке. Каждый документ = заголовок + файл;
 * заголовок редактируется inline (blur → PUT), файл можно скачать или
 * удалить. Между документами — тонкий разделитель.
 *
 * Бэк:
 *   GET  /api/admin/deals/<id>/attachments
 *   POST /api/admin/deals/<id>/attachments   multipart (title можно в form)
 *   PUT  /api/admin/attachments/<aid>        {"title": "..."}
 *   DELETE /api/admin/attachments/<aid>
 *   GET  /api/admin/attachments/<aid>/download
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
  dealId: number
  usersById: Map<number, string>
}

export default function DealDocumentsCard({ dealId, usersById }: Props) {
  const { toast } = useToast()

  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    crmGet<{ attachments: Attachment[] }>(
      `/api/admin/deals/${dealId}/attachments`,
    )
      .then((res) => setItems(res.attachments || []))
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить документы",
          description: e?.message,
        })
      })
      .finally(() => setLoading(false))
  }, [dealId, toast])

  useEffect(() => { load() }, [load])

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
        // title изначально пусто, юзер задаст inline после загрузки.
        await crmUpload<{ attachment: Attachment }>(
          `/api/admin/deals/${dealId}/attachments`,
          fd,
        )
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
    // Оптимистично
    setItems((prev) => prev.map((x) => x.id === a.id ? { ...x, title: value } : x))
    try {
      await crmPut(`/api/admin/attachments/${a.id}`, { title: value })
    } catch (e: any) {
      // Откат
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

      {/* Drop-zone — компактно, только когда пусто или во время drag */}
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

      {/* Список */}
      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? null : (
        <ul className="divide-y divide-gray-100">
          {items.map((a) => (
            <li key={a.id} className="py-2 first:pt-0 last:pb-0">
              <DocRow
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
            </li>
          ))}
        </ul>
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

function DocRow({
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
  const Icon = iconFor(item.mime_type, item.file_name)

  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(item.title || "")

  const startEdit = () => {
    setDraftTitle(item.title || "")
    setEditing(true)
  }
  const commit = () => {
    onTitleSave(draftTitle)
    setEditing(false)
  }
  const cancel = () => {
    setDraftTitle(item.title || "")
    setEditing(false)
  }

  const displayTitle = item.title || item.file_name || "Без названия"

  return (
    <div className="flex items-start gap-2">
      <Icon className="h-6 w-6 text-gray-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Заголовок (inline edit) */}
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
            onClick={startEdit}
            className={cn(
              "text-sm truncate max-w-full text-left hover:underline decoration-dotted focus:outline-none",
              item.title ? "font-medium text-gray-800" : "text-gray-500 italic",
            )}
            title={item.title ? "Изменить заголовок" : "Задать заголовок"}
          >
            {displayTitle}
          </button>
        )}
        <div className="text-[11px] text-gray-500 truncate" title={item.file_name || ""}>
          {item.file_name || "—"}
        </div>
        <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
          <span>{formatSize(item.file_size)}</span>
          <span>·</span>
          <span>{formatDate(item.uploaded_at)}</span>
          {uploader && (<><span>·</span><span className="truncate">{uploader}</span></>)}
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <button
          onClick={onDownload}
          className="text-gray-500 hover:text-gray-900 p-1 focus:outline-none"
          title="Скачать"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 p-1 focus:outline-none"
          title="Удалить"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function iconFor(mime: string | null, name: string | null) {
  const m = (mime || "").toLowerCase()
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
    return ImageIcon
  if (m.startsWith("video/") || ["mp4", "mov", "webm", "avi", "mkv"].includes(ext))
    return VideoIcon
  if (m === "application/pdf" || ext === "pdf") return FileText
  return FileIcon
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
