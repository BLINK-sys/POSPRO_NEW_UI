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
import { createPortal } from "react-dom"
import {
  Upload, FileText, Download, Trash2, Loader2, File as FileIcon,
  Image as ImageIcon, Video as VideoIcon, X, Pencil,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import { useRouter } from "next/navigation"

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

      {/* Скрытый input для клика по «загрузить» в шапке.
          Dropzone-карточка в сетке ниже имеет свой собственный. */}
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

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : (
        // Единая сетка мини-карточек: dropzone → картинки → файлы.
        // Всё одного размера (aspect-square), выглядит как одна лента
        // вложений. Клик по картинке — lightbox-просмотрщик; клик по
        // файлу — скачивание.
        <AttachmentsThumbGrid
          items={items}
          onDownload={handleDownload}
          onDelete={(a) => setDeleteTarget(a)}
          onFiles={handleFiles}
          uploading={uploading}
        />
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title || deleteTarget?.file_name}» будет
              удалён без возможности восстановления.
              {isEditableSpreadsheet(deleteTarget?.mime_type ?? null, deleteTarget?.file_name ?? null) && (
                <>
                  {" "}
                  <span className="text-red-600">
                    Вся история версий этого документа (до 30 последних
                    правок) тоже будет удалена.
                  </span>
                </>
              )}
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

// ============================================================================
// Миниатюры картинок + полноэкранный lightbox-просмотрщик
// ============================================================================

/**
 * Единая сетка мини-карточек всех вложений: сначала dropzone, потом
 * картинки, потом файлы. Всё одного размера (aspect-square). Клик:
 *   - по картинке → lightbox-просмотрщик (в нём листаются только картинки);
 *   - по файлу   → скачивание;
 *   - по dropzone → выбор файлов.
 * Это избавляет от двух разных списков под шапкой.
 */
function AttachmentsThumbGrid({
  items, onDownload, onDelete, onFiles, uploading,
}: {
  items: Attachment[]
  onDownload: (a: Attachment) => void
  onDelete: (a: Attachment) => void
  onFiles: (files: FileList | File[]) => void
  uploading: { done: number; total: number } | null
}) {
  const images = items.filter((a) => isImageAttachment(a.mime_type, a.file_name))
  const files = items.filter((a) => !isImageAttachment(a.mime_type, a.file_name))
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      {/* auto-fill + minmax — колонки подбираются по ШИРИНЕ КАРТОЧКИ
          документов, а не по глобальному viewport'у. 120px — компромисс:
          при узкой средней колонке (чат открыт, ~450px → 3 карточки) и
          при широкой (чат свёрнут, ~900px → 6-7 карточек) thumb'ы
          получаются одного комфортного размера, dropzone успевает
          уместить свой текст. */}
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
        <DropzoneThumb onFiles={onFiles} uploading={uploading} />
        {images.map((a, idx) => (
          <ImageThumb
            key={a.id}
            item={a}
            onOpen={() => setLightboxIndex(idx)}
            onDownload={() => onDownload(a)}
            onDelete={() => onDelete(a)}
          />
        ))}
        {files.map((a) => (
          <FileThumb
            key={a.id}
            item={a}
            onDownload={() => onDownload(a)}
            onDelete={() => onDelete(a)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDownload={onDownload}
        />
      )}
    </>
  )
}

function ImageThumb({
  item, onOpen, onDownload, onDelete,
}: {
  item: Attachment
  onOpen: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="group relative aspect-square rounded-md border border-gray-200 bg-gray-50 overflow-hidden cursor-zoom-in hover:border-gray-400 transition-colors"
      onClick={onOpen}
      title={item.title || item.file_name || "Открыть"}
    >
      <img
        src={getImageUrl(item.file_url)}
        alt={item.file_name || ""}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          title="Скачать"
          className="p-1 rounded bg-white/80 hover:bg-white focus:outline-none"
        >
          <Download className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Удалить"
          className="p-1 rounded bg-white/80 hover:bg-white text-red-500 focus:outline-none"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function FileThumb({
  item, onDownload, onDelete,
}: {
  item: Attachment
  onDownload: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const { Icon, label, tint } = typeMeta(item.mime_type, item.file_name)
  const displayName = item.title || item.file_name || "Без названия"
  const editable = isEditableSpreadsheet(item.mime_type, item.file_name)

  const openInEditor = () => {
    // Кладём имя файла для шапки редактора (URL несёт только id).
    try {
      sessionStorage.setItem(
        `excel-editor:${item.id}`,
        JSON.stringify({ fileName: item.file_name || displayName }),
      )
    } catch { /* noop */ }
    router.push(`/admin/excel/${item.id}`)
  }

  return (
    <div
      className={cn(
        "group relative aspect-square rounded-md border overflow-hidden cursor-pointer transition-colors",
        "flex flex-col items-stretch",
        tint,
      )}
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
      // Клик по карточке xlsx/csv — открыть редактор на всю страницу
      // (в этой же вкладке). Остальные файлы — скачать.
      onClick={editable ? openInEditor : onDownload}
      title={
        editable
          ? `${displayName}\n${item.file_name || ""}\n(открыть в редакторе)`
          : `${displayName}\n${item.file_name || ""}`
      }
    >
      {/* Иконка + лейбл типа */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 px-2">
        <Icon className="h-7 w-7 opacity-80" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      {/* Полоска с названием снизу */}
      <div className="bg-white/80 border-t border-black/5 px-1.5 py-1 text-[10px] leading-tight text-gray-800 truncate">
        {displayName}
      </div>
      {/* Overlay-действия в правом верхнем углу (hover) */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {editable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openInEditor() }}
            title="Открыть в редакторе"
            className="p-1 rounded bg-white/80 hover:bg-white text-emerald-700 focus:outline-none"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          title="Скачать"
          className="p-1 rounded bg-white/80 hover:bg-white focus:outline-none"
        >
          <Download className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Удалить"
          className="p-1 rounded bg-white/80 hover:bg-white text-red-500 focus:outline-none"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

/** xlsx / xls / xlsm / ods / csv — можно править во встроенном редакторе. */
function isEditableSpreadsheet(mime: string | null, name: string | null): boolean {
  const m = (mime || "").toLowerCase()
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  if (["xlsx", "xls", "xlsm", "ods", "csv"].includes(ext)) return true
  if (m.includes("spreadsheetml") || m.includes("ms-excel")) return true
  if (m === "text/csv") return true
  return false
}

/**
 * Квадратная dropzone-карточка — первая ячейка в сетке превью. Та же
 * aspect-square что у миниатюр, иконка + «Загрузить/перетащите» внутри.
 * Click → открывает диалог выбора файла; drag&drop → тоже работает.
 * При аплоаде показывает счётчик прогресса.
 */
function DropzoneThumb({
  onFiles, uploading,
}: {
  onFiles: (files: FileList | File[]) => void
  uploading: { done: number; total: number } | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const openPicker = () => {
    if (uploading) return
    inputRef.current?.click()
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (uploading) return
        if (e.dataTransfer.files) onFiles(e.dataTransfer.files)
      }}
      disabled={Boolean(uploading)}
      className={cn(
        "relative aspect-square rounded-md border-2 border-dashed transition-colors",
        "flex flex-col items-center justify-center gap-1 text-center p-2 focus:outline-none",
        dragOver
          ? "border-brand-yellow bg-brand-yellow/10 text-gray-800"
          : "border-gray-300 bg-gray-50/70 text-gray-500 hover:border-gray-400 hover:bg-gray-100",
        uploading && "pointer-events-none opacity-70",
      )}
      title="Загрузить файлы"
    >
      {uploading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          <span className="text-[10px] font-medium leading-tight">
            {uploading.done} / {uploading.total}
          </span>
        </>
      ) : (
        <>
          <Upload className="h-5 w-5" />
          <span className="text-[10px] leading-[1.1]">
            Перетяните файлы или нажмите для выбора файлов
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files)
          if (inputRef.current) inputRef.current.value = ""
        }}
      />
    </button>
  )
}

/**
 * Полноэкранный просмотрщик. Portal на body; закрытие по ESC / клику на
 * backdrop / крестик; навигация стрелками ← → (клавиши и кнопки);
 * счётчик «N из M»; кнопка «скачать»; preload соседей, чтобы листание
 * не моргало белым.
 */
function ImageLightbox({
  images, index, onIndexChange, onClose, onDownload,
}: {
  images: Attachment[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
  onDownload: (a: Attachment) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const total = images.length
  const current = images[index]

  const go = useCallback((delta: number) => {
    onIndexChange((index + delta + total) % total)
  }, [index, total, onIndexChange])

  // Клавиши: Esc / ← / → (document-level слушатель, без focus-зависимости).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, onClose])

  // Preload соседей — чтобы листание было мгновенным.
  useEffect(() => {
    if (total <= 1) return
    const neighbours = [
      images[(index + 1) % total],
      images[(index - 1 + total) % total],
    ]
    for (const n of neighbours) {
      if (!n) continue
      const img = new Image()
      img.src = getImageUrl(n.file_url)
    }
  }, [index, images, total])

  if (!mounted || !current) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Шапка: имя + счётчик + скачать + крестик */}
      <div
        className="absolute top-0 inset-x-0 h-12 px-4 flex items-center gap-3 text-white/90 text-sm bg-gradient-to-b from-black/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="truncate flex-1 min-w-0" title={current.title || current.file_name || ""}>
          {current.title || current.file_name || "Без названия"}
        </div>
        {total > 1 && (
          <span className="text-xs text-white/60 tabular-nums shrink-0">
            {index + 1} из {total}
          </span>
        )}
        <button
          type="button"
          onClick={() => onDownload(current)}
          className="p-1.5 rounded-full hover:bg-white/10 focus:outline-none"
          title="Скачать"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 focus:outline-none"
          title="Закрыть (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Основная картинка */}
      <img
        src={getImageUrl(current.file_url)}
        alt={current.file_name || ""}
        className="max-w-[92vw] max-h-[86vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Стрелки по бокам (только если больше одной картинки) */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1) }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white focus:outline-none"
            title="Предыдущая (←)"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white focus:outline-none"
            title="Следующая (→)"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Тонкая полоска миниатюр снизу — чтобы быстро перейти к нужной. */}
      {total > 1 && total <= 20 && (
        <div
          className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 px-4 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onIndexChange(i)}
              className={cn(
                "h-12 w-12 rounded-md overflow-hidden border-2 transition-all shrink-0",
                i === index
                  ? "border-brand-yellow scale-110"
                  : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <img
                src={getImageUrl(img.file_url)}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
