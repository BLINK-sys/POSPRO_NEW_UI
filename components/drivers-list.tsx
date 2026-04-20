"use client"

import React, { useState, useTransition, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { HardDrive, Plus, Trash2, GripVertical, Pencil, Upload, Download, Loader2, FileIcon } from "lucide-react"
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import {
  deleteDriver,
  deleteDriverImage,
  getDriverProducts,
  listDrivers,
  reorderDrivers,
  updateDriver,
  uploadDriverImageByUrl,
  type Driver,
  type DriverProduct,
} from "@/app/actions/drivers"
import { API_BASE_URL } from "@/lib/api-address"
import { uploadFileDirect } from "@/lib/upload-direct"
import { cn } from "@/lib/utils"
import { Image as ImageIcon, X as XIcon } from "lucide-react"

function formatSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SortableDriverCard({
  driver,
  isAdmin,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  driver: Driver
  isAdmin: boolean
  onEdit: (d: Driver) => void
  onDelete: (d: Driver) => void
  onToggleActive: (d: Driver) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: driver.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative overflow-hidden flex flex-col",
        !driver.is_active && "bg-gray-50 opacity-70",
      )}
    >
      {/* Drag handle */}
      {isAdmin && (
        <button
          className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing touch-none rounded-md bg-white/80 backdrop-blur p-1 text-gray-400 hover:text-gray-700 shadow-sm"
          {...attributes}
          {...listeners}
          aria-label="Перетащить"
          title="Перетащить"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Картинка */}
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {driver.image_url ? (
          <img
            src={`${API_BASE_URL}${driver.image_url}`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <FileIcon className="h-12 w-12 text-brand-yellow" />
        )}
      </div>

      {/* Название */}
      <CardContent className="p-3 flex-1 flex flex-col gap-1.5">
        <p className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">{driver.name}</p>

        <div className="flex flex-wrap items-center gap-1">
          {driver.usage_count != null && driver.usage_count > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {driver.usage_count}
            </Badge>
          )}
          <p className="text-[11px] text-gray-400 truncate flex-1 min-w-0">
            {driver.file_size ? formatSize(driver.file_size) : driver.filename || ""}
          </p>
        </div>

        {/* Действия */}
        <div className="flex items-center justify-between gap-1 mt-auto pt-2 border-t">
          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <>
                <Switch
                  checked={driver.is_active}
                  onCheckedChange={() => onToggleActive(driver)}
                />
                <span className="text-[10px] text-gray-500">
                  {driver.is_active ? "Активен" : "Скрыт"}
                </span>
              </>
            ) : !driver.is_active ? (
              <Badge variant="secondary" className="text-[10px]">Неактивен</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => window.open(`${API_BASE_URL}${driver.url}`, "_blank")}
              title="Скачать"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onEdit(driver)}
                  title="Редактировать"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onDelete(driver)}
                  title="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DriversList({ initialDrivers }: { initialDrivers: Driver[] }) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Driver | null>(null)
  const [linkedProducts, setLinkedProducts] = useState<DriverProduct[]>([])

  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === "admin"

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const refresh = async () => {
    const list = await listDrivers()
    setDrivers(list)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = drivers.findIndex((d) => d.id === active.id)
    const newIdx = drivers.findIndex((d) => d.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(drivers, oldIdx, newIdx)
    setDrivers(next)
    startTransition(async () => {
      const ok = await reorderDrivers(next.map((d) => d.id))
      if (!ok) toast({ variant: "destructive", title: "Не удалось сохранить порядок" })
    })
  }

  const handleOpenCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (d: Driver) => {
    setEditing(d)
    setDialogOpen(true)
  }

  const handleDeleteRequest = async (d: Driver) => {
    if (d.usage_count && d.usage_count > 0) {
      const products = await getDriverProducts(d.id)
      setLinkedProducts(products)
    } else {
      setLinkedProducts([])
    }
    setDeleteTarget(d)
  }

  const handleDeleteConfirm = () => {
    const target = deleteTarget
    if (!target) return
    setDeleteTarget(null)
    setLinkedProducts([])
    startTransition(async () => {
      const ok = await deleteDriver(target.id)
      if (ok) {
        setDrivers((list) => list.filter((d) => d.id !== target.id))
        toast({ title: "Драйвер удалён" })
      } else {
        toast({ variant: "destructive", title: "Не удалось удалить" })
      }
    })
  }

  const handleToggleActive = async (d: Driver) => {
    const willDeactivate = d.is_active
    if (willDeactivate && d.usage_count && d.usage_count > 0) {
      const products = await getDriverProducts(d.id)
      setLinkedProducts(products)
      setDeactivateTarget(d)
      return
    }
    await applyToggle(d, !d.is_active)
  }

  const applyToggle = async (d: Driver, newValue: boolean) => {
    const res = await updateDriver(d.id, { is_active: newValue })
    if (res) {
      setDrivers((list) => list.map((x) => (x.id === d.id ? { ...x, is_active: newValue } : x)))
      toast({ title: newValue ? "Драйвер включён" : "Драйвер отключён" })
    } else {
      toast({ variant: "destructive", title: "Не удалось обновить" })
    }
  }

  const handleDeactivateConfirm = () => {
    const target = deactivateTarget
    if (!target) return
    setDeactivateTarget(null)
    setLinkedProducts([])
    startTransition(async () => {
      await applyToggle(target, false)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-brand-yellow" />
            Драйверы
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Мастер-список переиспользуемых драйверов для товаров
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить драйвер
          </Button>
        )}
      </div>

      {drivers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Драйверов пока нет{isAdmin && ". Добавьте первый через кнопку выше."}
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={drivers.map((d) => d.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {drivers.map((d) => (
                <SortableDriverCard
                  key={d.id}
                  driver={d}
                  isAdmin={isAdmin}
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteRequest}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <DriverFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditing(null)
        }}
        driver={editing}
        onSaved={refresh}
      />

      {/* Удаление */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить драйвер?</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedProducts.length > 0 ? (
                <>
                  Этот драйвер привязан к товарам: они автоматически отвяжутся при удалении.
                  <div className="mt-2 max-h-40 overflow-auto border rounded p-2 text-xs text-left">
                    {linkedProducts.map((p) => (
                      <div key={p.id}>
                        • {p.name} ({p.article})
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                "Файл будет удалён с сервера безвозвратно."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600">
              Да, удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Деактивация */}
      <AlertDialog
        open={deactivateTarget != null}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить драйвер?</AlertDialogTitle>
            <AlertDialogDescription>
              Этот драйвер привязан к товарам — для них он перестанет отображаться на сайте,
              но останется привязан, пока вы не включите видимость обратно.
              <div className="mt-2 max-h-40 overflow-auto border rounded p-2 text-xs text-left">
                {linkedProducts.map((p) => (
                  <div key={p.id}>
                    • {p.name} ({p.article})
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateConfirm}>Да, отключить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DriverFormDialog({
  open,
  onOpenChange,
  driver,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  driver: Driver | null
  onSaved: () => void | Promise<void>
}) {
  const [name, setName] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageFileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  React.useEffect(() => {
    if (open) {
      setName(driver?.name || "")
      setIsActive(driver?.is_active ?? true)
      setFile(null)
      setImageFile(null)
      setImageUrl("")
      setCurrentImage(driver?.image_url || null)
    }
  }, [open, driver])

  const isEdit = driver != null

  const save = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Название обязательно" })
      return
    }
    if (!isEdit && !file) {
      toast({ variant: "destructive", title: "Файл обязателен" })
      return
    }

    setSaving(true)
    try {
      let savedId: number | null = driver?.id ?? null

      if (isEdit) {
        await updateDriver(driver.id, { name, is_active: isActive })
        if (file) {
          const fd = new FormData()
          fd.append("file", file)
          await uploadFileDirect(`/api/drivers/${driver.id}/file`, fd)
        }
      } else {
        const fd = new FormData()
        fd.append("name", name)
        fd.append("is_active", String(isActive))
        fd.append("file", file as File)
        try {
          const created = await uploadFileDirect<{ id: number }>("/api/drivers/", fd)
          savedId = created?.id ?? null
        } catch (e: any) {
          toast({ variant: "destructive", title: e?.message || "Не удалось создать" })
          setSaving(false)
          return
        }
      }

      // Картинка
      let imageError: string | null = null
      if (savedId) {
        if (imageFile) {
          const fd = new FormData()
          fd.append("file", imageFile)
          try {
            await uploadFileDirect(`/api/drivers/${savedId}/image`, fd)
          } catch (e: any) {
            imageError = e?.message || "Не удалось загрузить картинку"
          }
        } else if (imageUrl.trim()) {
          const result = await uploadDriverImageByUrl(savedId, imageUrl.trim())
          if ("error" in result) {
            imageError = result.error
          }
        }
      }

      await onSaved()

      if (imageError) {
        toast({
          variant: "destructive",
          title: "Картинка не загружена",
          description: imageError,
        })
        // Не закрываем диалог — пользователь может поправить URL/файл и сохранить ещё раз
      } else {
        toast({ title: isEdit ? "Драйвер обновлён" : "Драйвер добавлен" })
        onOpenChange(false)
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: e?.message || "Не удалось сохранить" })
    } finally {
      setSaving(false)
    }
  }

  const removeImage = async () => {
    if (!driver) {
      setCurrentImage(null)
      setImageFile(null)
      setImageUrl("")
      return
    }
    const ok = await deleteDriverImage(driver.id)
    if (ok) {
      setCurrentImage(null)
      toast({ title: "Картинка удалена" })
      await onSaved()
    } else {
      toast({ variant: "destructive", title: "Не удалось удалить картинку" })
    }
  }

  // Превью картинки: приоритет imageFile → URL → currentImage
  const previewSrc = imageFile
    ? URL.createObjectURL(imageFile)
    : imageUrl.trim()
      ? imageUrl.trim()
      : currentImage
        ? `${API_BASE_URL}${currentImage}`
        : null

  const hasAnyImage = !!previewSrc

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать драйвер" : "Новый драйвер"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Левая колонка — основные поля */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Драйвер для сканера Zebra DS2208"
              />
            </div>
            <div className="space-y-2">
              <Label>Файл</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {file ? "Заменить файл" : "Выбрать файл"}
                </Button>
                <span className="text-sm text-gray-500 truncate">
                  {file?.name || (isEdit ? driver?.filename : "Файл не выбран")}
                </span>
              </div>
              {isEdit && !file && (
                <p className="text-xs text-gray-400">
                  Если нужно заменить файл — выберите новый, иначе текущий останется.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="active">Активен</Label>
            </div>
          </div>

          {/* Правая колонка — картинка + превью */}
          <div className="space-y-3">
            <Label>Картинка для карточки</Label>
            <div
              className={cn(
                "relative aspect-square rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center",
                hasAnyImage && "border-solid border-gray-200",
              )}
            >
              {previewSrc ? (
                <>
                  <img
                    src={previewSrc}
                    alt="Превью"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none"
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 shadow-md"
                    onClick={() => {
                      if (imageFile) setImageFile(null)
                      else if (imageUrl) setImageUrl("")
                      else removeImage()
                    }}
                    title="Убрать картинку"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="text-center text-gray-400 px-4">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-sm">Превью появится здесь</p>
                </div>
              )}
            </div>

            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setImageFile(e.target.files?.[0] || null)
                setImageUrl("")
              }}
            />
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={() => imageFileInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Загрузить с ПК
            </Button>
            <div className="space-y-1">
              <Input
                placeholder="или вставь URL картинки"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  if (e.target.value) setImageFile(null)
                }}
              />
              <p className="text-xs text-gray-400">
                При вставке URL картинка скачается на сервер и сохранится локально.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
