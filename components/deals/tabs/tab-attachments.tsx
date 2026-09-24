"use client"

/**
 * Вкладка «Файлы» карточки сделки. Список прикреплённых файлов + upload
 * (drag&drop и через кнопку), download и delete.
 *
 * Бэк:
 *   GET  /api/admin/deals/<id>/attachments          → { attachments: [] }
 *   POST /api/admin/deals/<id>/attachments          multipart file field
 *   DELETE /api/admin/attachments/<aid>             удалить
 *   GET  /api/admin/attachments/<aid>/download      скачать (proxy бинаря)
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Upload, FileText, Download, Trash2, Loader2, File as FileIcon,
  Image as ImageIcon, Video as VideoIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { crmGet, crmDelete, crmUpload } from "@/lib/crm-fetch"

interface Attachment {
  id: number
  entity_type: string
  entity_id: number
  file_url: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  uploaded_by: number | null
  uploaded_at: string | null
}

interface Props {
  dealId: number
  usersById: Map<number, string>
}

export default function TabAttachments({ dealId, usersById }: Props) {
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
          title: "Не удалось загрузить файлы",
          description: e?.message,
        })
      })
      .finally(() => setLoading(false))
  }, [dealId, toast])

  useEffect(() => {
    load()
  }, [load])

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
        title: `Загружено файлов: ${success}${list.length > success ? ` из ${list.length}` : ""}`,
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
      toast({ title: "Файл удалён" })
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

  const handleDownload = (a: Attachment) => {
    // Открываем download-роут в новой вкладке — Next-прокси отдаёт файл
    // c Content-Disposition: attachment, браузер начнёт скачивание.
    const url = `/api/admin/attachments/${a.id}/download`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <Card className="rounded-xl border-gray-200 p-4 space-y-4">
      {/* Drop-zone / кнопка */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-colors",
          "p-6 flex flex-col items-center justify-center gap-2",
          dragOver
            ? "border-brand-yellow bg-brand-yellow/10"
            : "border-gray-300 bg-gray-50/50",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <Upload className={cn(
          "h-8 w-8",
          dragOver ? "text-brand-yellow" : "text-gray-400",
        )} />
        <div className="text-sm text-center">
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin inline" />
              Загружаем {uploading.done} / {uploading.total}…
            </>
          ) : (
            <>
              <span className="text-gray-600">Перетащите файлы или </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-brand-yellow hover:underline font-medium focus:outline-none"
              >
                выберите с диска
              </button>
            </>
          )}
        </div>
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
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-6">
          Файлов пока нет
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id}>
              <FileRow
                item={a}
                uploader={
                  a.uploaded_by != null
                    ? usersById.get(a.uploaded_by) ?? `#${a.uploaded_by}`
                    : null
                }
                onDownload={() => handleDownload(a)}
                onDelete={() => setDeleteTarget(a)}
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
            <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.file_name}» будет удалён без возможности восстановления.
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

function FileRow({
  item,
  uploader,
  onDownload,
  onDelete,
}: {
  item: Attachment
  uploader: string | null
  onDownload: () => void
  onDelete: () => void
}) {
  const Icon = iconFor(item.mime_type, item.file_name)
  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-2.5 hover:bg-gray-50 transition-colors">
      <Icon className="h-8 w-8 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" title={item.file_name || ""}>
          {item.file_name || "—"}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
          <span>{formatSize(item.file_size)}</span>
          <span>·</span>
          <span>{formatDate(item.uploaded_at)}</span>
          {uploader && (
            <>
              <span>·</span>
              <span className="truncate">{uploader}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onDownload}
          className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900"
          title="Скачать"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
          title="Удалить"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
