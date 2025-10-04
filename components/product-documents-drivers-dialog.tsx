"use client"

import { useState, useEffect, useTransition } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, FileText, HardDrive, Download, Trash2, Plus } from "lucide-react"
import {
  getDocuments,
  getDrivers,
  uploadDocumentFile,
  uploadDriverFile,
  deleteDocument,
  deleteDriver,
  type Document,
  type Driver,
} from "@/app/actions/products"

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

  // Загружаем данные при открытии диалога
  useEffect(() => {
    loadData()
  }, [productId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [documentsData, driversData] = await Promise.all([getDocuments(productId), getDrivers(productId)])
      
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
        
        const result = await uploadDocumentFile(formData)

        // Обновляем только список документов
        const updatedDocuments = await getDocuments(productId)
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
        
        const result = await uploadDriverFile(formData)

        // Обновляем только список драйверов
        const updatedDrivers = await getDrivers(productId)
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
        await deleteDocument(productId, documentId)
        
        toast({
          title: "Успех",
          description: "Документ удален",
        })

        // Обновляем только список документов
        const updatedDocuments = await getDocuments(productId)
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

  const handleDeleteDriver = (driverId: number) => {
    startTransition(async () => {
      try {
        await deleteDriver(productId, driverId)
        
        toast({
          title: "Успех",
          description: "Драйвер удален",
        })

        // Обновляем только список драйверов
        const updatedDrivers = await getDrivers(productId)
        setDrivers(updatedDrivers)
      } catch (error) {
        console.error("Error deleting driver:", error)
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось удалить драйвер",
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Документы ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="drivers" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Драйверы ({drivers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            {/* Загрузка документов */}
            <Card>
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
                      className="flex-1"
                    />
                    <Button onClick={handleDocumentUpload} disabled={isPending || !documentFile}>
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
            <Card>
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
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
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
                          <Button variant="outline" size="sm" onClick={() => window.open(doc.url, "_blank")}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.id)}
                            disabled={isPending}
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
            <Card>
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
                      className="flex-1"
                    />
                    <Button onClick={handleDriverUpload} disabled={isPending || !driverFile}>
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

            {/* Список драйверов */}
            <Card>
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
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(driver.file_type)}
                          <div>
                            <p className="font-medium">{driver.filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className={getFileTypeColor(driver.file_type)}>
                                {driver.file_type.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-gray-500">{driver.mime_type}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => window.open(driver.url, "_blank")}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDriver(driver.id)}
                            disabled={isPending}
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
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
