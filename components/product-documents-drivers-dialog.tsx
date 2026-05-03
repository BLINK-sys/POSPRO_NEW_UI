"use client"

import { useState, useEffect, useTransition } from "react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, FileText, HardDrive, Download, Trash2, Plus, List as ListIcon, Link2, Unlink } from "lucide-react"
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
import { mediaApi } from "@/lib/api-client"
import { API_BASE_URL } from "@/lib/api-address"
import { attachDriversToProduct, listDrivers, type Driver as MasterDriver } from "@/app/actions/drivers"
import { uploadFileDirect } from "@/lib/upload-direct"
import { cn } from "@/lib/utils"

const FOCUS_NO_RING =
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  FOCUS_NO_RING
const CARD_CLASS =
  "rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

type Document = {
  id: number
  filename: string
  url: string
  file_type: string
  mime_type: string
}

type Driver = {
  id: number
  filename: string
  url: string
  file_type: string
  mime_type: string
  driver_id?: number | null
}

interface ProductDocumentsDriversDialogProps {
  productId: number
  onClose: () => void
}

export function ProductDocumentsDriversDialog({ productId, onClose }: ProductDocumentsDriversDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const [documents, setDocuments] = useState<Document[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])

  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [driverFile, setDriverFile] = useState<File | null>(null)

  // Выбор драйверов из мастер-списка
  const [selectDriversOpen, setSelectDriversOpen] = useState(false)
  const [masterDrivers, setMasterDrivers] = useState<MasterDriver[]>([])
  const [masterLoading, setMasterLoading] = useState(false)
  const [selectedMasterIds, setSelectedMasterIds] = useState<Set<number>>(new Set())

  // Подтверждение удаления/отвязки драйвера
  const [driverActionTarget, setDriverActionTarget] = useState<Driver | null>(null)

  // Загружаем данные при открытии диалога
  useEffect(() => {
    loadData()
  }, [productId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [documentsData, driversData] = await Promise.all([mediaApi.getDocuments(productId), mediaApi.getDrivers(productId)])
      
      console.log("Documents from backend:", documentsData)
      documentsData.forEach((doc, index) => {
        console.log(`Document ${index}:`, {
          id: doc.id,
          filename: doc.filename,
          filenameBytes: doc.filename ? new TextEncoder().encode(doc.filename) : null,
          url: doc.url
        })
      })
      
      console.log("Drivers from backend:", driversData)
      driversData.forEach((driver, index) => {
        console.log(`Driver ${index}:`, {
          id: driver.id,
          filename: driver.filename,
          filenameBytes: driver.filename ? new TextEncoder().encode(driver.filename) : null,
          url: driver.url
        })
      })
      
      setDocuments(documentsData)
      setDrivers(driversData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить файлы",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDocumentUpload = () => {
    if (!documentFile) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите файл для загрузки",
      })
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("file", documentFile)
        formData.append("product_id", String(productId))
        
               const result = await mediaApi.uploadDocument(formData)

        // Обновляем только список документов
        const updatedDocuments = await mediaApi.getDocuments(productId)
        setDocuments(updatedDocuments)
        
        toast({
          title: "Успех",
          description: "Документ загружен",
        })
        setDocumentFile(null)
        // Сбрасываем input
        const fileInput = document.getElementById("document-file") as HTMLInputElement
        if (fileInput) fileInput.value = ""
      } catch (error) {
        console.error("Error uploading document:", error)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось загрузить документ",
        })
      }
    })
  }

  const handleDriverUpload = () => {
    if (!driverFile) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите файл для загрузки",
      })
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("file", driverFile)
        formData.append("product_id", String(productId))

        // Прямая загрузка в Flask, минуя Next.js (иначе OOM на больших файлах)
        await uploadFileDirect("/upload/drivers/upload", formData)

        // Обновляем только список драйверов
        const updatedDrivers = await mediaApi.getDrivers(productId)
        setDrivers(updatedDrivers)

        toast({
          title: "Успех",
          description: "Драйвер загружен",
        })
        setDriverFile(null)
        // Сбрасываем input
        const fileInput = document.getElementById("driver-file") as HTMLInputElement
        if (fileInput) fileInput.value = ""
      } catch (error) {
        console.error("Error uploading driver:", error)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось загрузить драйвер",
        })
      }
    })
  }

  const handleDeleteDocument = (documentId: number) => {
    startTransition(async () => {
      try {
        await mediaApi.deleteDocument(documentId)
        
        toast({
          title: "Успех",
          description: "Документ удален",
        })

        // Обновляем только список документов
        const updatedDocuments = await mediaApi.getDocuments(productId)
        setDocuments(updatedDocuments)
      } catch (error) {
        console.error("Error deleting document:", error)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось удалить документ",
        })
      }
    })
  }

  const handleDeleteDriver = (driverId: number, isLinked: boolean) => {
    startTransition(async () => {
      try {
        await mediaApi.deleteDriver(driverId)

        toast({
          title: "Успех",
          description: isLinked ? "Драйвер отвязан от товара" : "Драйвер удалён",
        })

        const updatedDrivers = await mediaApi.getDrivers(productId)
        setDrivers(updatedDrivers)
      } catch (error) {
        console.error("Error deleting driver:", error)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось выполнить действие",
        })
      }
    })
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case "doc":
      case "docx":
      case "pdf":
        return <FileText className="h-4 w-4" />
      case "driver":
      case "zip":
      case "rar":
        return <HardDrive className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getFileTypeColor = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case "doc":
      case "docx":
        return "bg-blue-100 text-blue-800"
      case "pdf":
        return "bg-red-100 text-red-800"
      case "driver":
      case "zip":
      case "rar":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Функция для получения URL файла
  const getFileUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    // Сервер обслуживает файлы через /uploads/, а не /disk/
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  // Функция для скачивания файлов
  const downloadFile = async (url: string, filename: string) => {
    try {
      // Создаем скрытую ссылку для скачивания
      const link = document.createElement('a')
      const fileUrl = getFileUrl(url)
      link.href = fileUrl
      link.download = filename
      link.style.display = 'none'
      link.style.position = 'absolute'
      link.style.left = '-9999px'
      link.style.top = '-9999px'
      
      console.log('Downloading file:', {
        originalUrl: url,
        finalUrl: fileUrl,
        filename: filename
      })
      
      document.body.appendChild(link)
      link.click()
      
      // Удаляем ссылку после небольшой задержки
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link)
        }
      }, 1000)
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error)
      // Fallback: открываем в новой вкладке
      window.open(getFileUrl(url), '_blank', 'noopener,noreferrer')
    }
  }

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="mt-4 text-gray-600">Загрузка файлов...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Документы и драйверы</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-lg bg-gray-100 p-1">
            <TabsTrigger
              value="documents"
              className="flex items-center gap-2 rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
            >
              <FileText className="h-4 w-4" />
              Документы ({documents.length})
            </TabsTrigger>
            <TabsTrigger
              value="drivers"
              className="flex items-center gap-2 rounded-md data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:shadow-[0_2px_6px_rgba(250,204,21,0.30)] transition-all"
            >
              <HardDrive className="h-4 w-4" />
              Драйверы ({drivers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            {/* Загрузка документов */}
            <Card className={CARD_CLASS}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить документ
                </CardTitle>
                <CardDescription>Поддерживаются файлы: DOC, DOCX, PDF, TXT и другие документы</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="document-file">Выберите файл</Label>
                  <div className="flex gap-2">
                    <Input
                      id="document-file"
                      type="file"
                      accept=".doc,.docx,.pdf,.txt,.rtf"
                      onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                      disabled={isPending}
                      className={cn("flex-1", SOFT_CONTROL)}
                    />
                    <Button
                      onClick={handleDocumentUpload}
                      disabled={isPending || !documentFile}
                      className={PRIMARY_BTN}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Загрузить
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Список документов */}
            <Card className={CARD_CLASS}>
              <CardHeader>
                <CardTitle>Загруженные документы</CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Документы не загружены</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.file_type)}
                          <div>
                            <p className="font-medium">{doc.filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className={getFileTypeColor(doc.file_type)}>
                                {doc.file_type.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-gray-500">{doc.mime_type}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadFile(doc.url, doc.filename)}
                            className="rounded-full text-blue-600 hover:bg-blue-50"
                            title="Скачать"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDocument(doc.id)}
                            disabled={isPending}
                            className="rounded-full text-red-500 hover:bg-red-50"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers" className="space-y-4">
            {/* Загрузка драйверов */}
            <Card className={CARD_CLASS}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить драйвер
                </CardTitle>
                <CardDescription>
                  Поддерживаются файлы: ZIP, RAR, EXE, MSI и другие архивы и исполняемые файлы
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="driver-file">Выберите файл</Label>
                  <div className="flex gap-2">
                    <Input
                      id="driver-file"
                      type="file"
                      accept=".zip,.rar,.exe,.msi,.7z"
                      onChange={(e) => setDriverFile(e.target.files?.[0] || null)}
                      disabled={isPending}
                      className={cn("flex-1", SOFT_CONTROL)}
                    />
                    <Button
                      onClick={handleDriverUpload}
                      disabled={isPending || !driverFile}
                      className={PRIMARY_BTN}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Загрузить
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 border-t" />
                    <span className="text-xs text-gray-400">или</span>
                    <div className="flex-1 border-t" />
                  </div>
                  <Button
                    variant="outline"
                    className={SECONDARY_BTN}
                    onClick={async () => {
                      setMasterLoading(true)
                      setSelectDriversOpen(true)
                      try {
                        const all = await listDrivers()
                        const attached = new Set(
                          drivers.map((d) => d.driver_id).filter((x): x is number => x != null),
                        )
                        const available = all.filter((d) => d.is_active && !attached.has(d.id))
                        setMasterDrivers(available)
                        setSelectedMasterIds(new Set())
                      } finally {
                        setMasterLoading(false)
                      }
                    }}
                  >
                    <ListIcon className="mr-2 h-4 w-4" />
                    Выбрать из списка
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Список драйверов */}
            <Card className={CARD_CLASS}>
              <CardHeader>
                <CardTitle>Загруженные драйверы</CardTitle>
              </CardHeader>
              <CardContent>
                {drivers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Драйверы не загружены</p>
                ) : (
                  <div className="space-y-2">
                    {drivers.map((driver) => (
                      <div
                        key={driver.id}
                        className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(driver.file_type)}
                          <div>
                            <p className="font-medium">{driver.filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className={getFileTypeColor(driver.file_type)}>
                                {driver.file_type.toUpperCase()}
                              </Badge>
                              {driver.driver_id != null && (
                                <Badge variant="outline" className="gap-1">
                                  <Link2 className="h-3 w-3" />
                                  Из списка
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">{driver.mime_type}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadFile(driver.url, driver.filename)}
                            className="rounded-full text-blue-600 hover:bg-blue-50"
                            title="Скачать"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {driver.driver_id != null ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDriverActionTarget(driver)}
                              disabled={isPending}
                              title="Отвязать от товара"
                              className="rounded-full text-blue-600 hover:bg-blue-50"
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDriverActionTarget(driver)}
                              disabled={isPending}
                              title="Удалить драйвер"
                              className="rounded-full text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <Dialog open={selectDriversOpen} onOpenChange={setSelectDriversOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Выбрать драйверы из списка</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-1 py-2">
            {masterLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : masterDrivers.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">
                Нет доступных драйверов. Либо все уже добавлены, либо мастер-список пуст.
              </p>
            ) : (
              masterDrivers.map((d) => {
                const checked = selectedMasterIds.has(d.id)
                return (
                  <label
                    key={d.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all bg-white",
                      checked
                        ? "border-brand-yellow shadow-[0_2px_6px_rgba(250,204,21,0.20)]"
                        : "border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)]"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedMasterIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(d.id)
                          else next.delete(d.id)
                          return next
                        })
                      }}
                      className="accent-brand-yellow"
                    />
                    <HardDrive className="h-4 w-4 text-brand-yellow shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{d.name}</p>
                      <p className="text-xs text-gray-500 truncate">{d.filename}</p>
                    </div>
                  </label>
                )
              })
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setSelectDriversOpen(false)}
              className={SECONDARY_BTN}
            >
              Отмена
            </Button>
            <Button
              disabled={selectedMasterIds.size === 0 || isPending}
              className={PRIMARY_BTN}
              onClick={() => {
                const ids = Array.from(selectedMasterIds)
                startTransition(async () => {
                  const ok = await attachDriversToProduct(productId, ids)
                  if (ok) {
                    const updated = await mediaApi.getDrivers(productId)
                    setDrivers(updated)
                    toast({ title: `Привязано: ${ids.length}` })
                    setSelectDriversOpen(false)
                  } else {
                    toast({ variant: "destructive", title: "Не удалось привязать" })
                  }
                })
              }}
            >
              Выбрать ({selectedMasterIds.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={driverActionTarget != null} onOpenChange={(o) => !o && setDriverActionTarget(null)}>
        <AlertDialogContent>
          {driverActionTarget?.driver_id != null ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Отвязать драйвер от товара?</AlertDialogTitle>
                <AlertDialogDescription>
                  Драйвер <b>{driverActionTarget.filename}</b> будет отвязан только от этого товара.
                  Файл останется в общем мастер-списке и доступен для других товаров.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className={SECONDARY_BTN}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-[0_2px_6px_rgba(37,99,235,0.30)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.40)] transition-shadow"
                  onClick={() => {
                    const t = driverActionTarget
                    setDriverActionTarget(null)
                    if (t) handleDeleteDriver(t.id, true)
                  }}
                >
                  Отвязать
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить драйвер?</AlertDialogTitle>
                <AlertDialogDescription>
                  Драйвер <b>{driverActionTarget?.filename}</b> будет удалён полностью — файл
                  будет стёрт с сервера. Это действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className={SECONDARY_BTN}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-[0_2px_6px_rgba(220,38,38,0.30)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.40)] transition-shadow"
                  onClick={() => {
                    const t = driverActionTarget
                    setDriverActionTarget(null)
                    if (t) handleDeleteDriver(t.id, false)
                  }}
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
