"use client"

import type React from "react"

import { useState, useEffect, useTransition, useCallback } from "react"
import Image from "next/image"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  type Media,
  getMedia,
  addMediaByUrl,
  uploadProductFile,
  deleteMedia,
  reorderMedia,
} from "@/app/actions/products"
import { API_BASE_URL } from "@/lib/api-address"
import { getImageUrl } from "@/lib/image-utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Trash2, Video, GripVertical, Upload, Link, Play, ImageIcon, Youtube } from "lucide-react"

interface ProductMediaDialogProps {
  productId: number
  onClose: () => void
}

// Helper function to get proper media URL
const getMediaUrl = (url: string): string => {
  if (!url) return "/placeholder.svg"
  
  // Use the centralized image URL utility
  return getImageUrl(url)
}

// Helper function to convert YouTube URL to embed URL
const getYouTubeEmbedUrl = (url: string): string | null => {
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
  const match = url.match(youtubeRegex)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

// Helper function to check if URL is YouTube
const isYouTubeUrl = (url: string): boolean => {
  return url.includes("youtube.com") || url.includes("youtu.be")
}

function SortableMediaItem({
  media,
  onDelete,
  onSelect,
  isSelected,
}: {
  media: Media
  onDelete: (id: number) => void
  onSelect: (media: Media) => void
  isSelected: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }

  const isYouTube = isYouTubeUrl(media.url)

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className={`relative aspect-square cursor-pointer border-2 rounded-lg overflow-hidden ${
          isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"
        }`}
        onClick={() => onSelect(media)}
      >
        <div className="absolute top-1 left-1 z-10" {...attributes} {...listeners}>
          <Button variant="ghost" size="icon" className="cursor-grab bg-black/30 hover:bg-black/50 text-white h-8 w-8">
            <GripVertical className="h-5 w-5" />
          </Button>
        </div>

        {media.media_type === "image" ? (
          <div className="w-full h-full relative">
            <Image
              src={getMediaUrl(media.url) || "/placeholder.svg"}
              alt="Product media"
              width={200}
              height={200}
              className="w-full h-full object-cover"
              unoptimized
            />
            <div className="absolute bottom-2 right-2">
              <ImageIcon className="h-5 w-5 text-white bg-black/50 rounded p-1" />
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center relative">
            {isYouTube ? (
              <>
                <Youtube className="h-12 w-12 text-red-500 mb-2" />
                <Play className="h-8 w-8 text-white absolute" />
                <span className="text-sm text-white text-center px-2 mt-2 truncate w-full">YouTube</span>
              </>
            ) : (
              <>
                <Video className="h-12 w-12 text-white mb-2" />
                <Play className="h-8 w-8 text-white absolute" />
                <span className="text-sm text-white text-center px-2 mt-2 truncate w-full">Видео</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete button below the card */}
      <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(media.id)
          }}
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Удалить
        </Button>
      </div>
    </div>
  )
}

function MediaViewer({ media }: { media: Media | null }) {
  if (!media) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Выберите медиафайл для просмотра</p>
        </div>
      </div>
    )
  }

  const isYouTube = isYouTubeUrl(media.url)
  const youtubeEmbedUrl = isYouTube ? getYouTubeEmbedUrl(media.url) : null

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
        {media.media_type === "image" ? (
          <Image
            src={getMediaUrl(media.url) || "/placeholder.svg"}
            alt="Preview"
            width={800}
            height={600}
            className="max-w-full max-h-full object-contain"
            unoptimized
          />
        ) : isYouTube && youtubeEmbedUrl ? (
          <iframe
            src={youtubeEmbedUrl}
            width="100%"
            height="100%"
            style={{ minHeight: "400px" }}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        ) : (
          <video src={getMediaUrl(media.url)} controls className="max-w-full max-h-full" style={{ maxHeight: "70vh" }}>
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        )}
      </div>
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">Тип:</span>
            <span className="ml-2">
              {media.media_type === "image" ? "Изображение" : isYouTube ? "YouTube видео" : "Видео"}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Порядок:</span>
            <span className="ml-2">{media.order}</span>
          </div>
        </div>
        <div className="mt-2">
          <span className="font-medium text-gray-600">URL:</span>
          <p className="text-xs text-gray-500 break-all mt-1">{media.url}</p>
        </div>
      </div>
    </div>
  )
}

export function ProductMediaDialog({ productId, onClose }: ProductMediaDialogProps) {
  console.log("ProductMediaDialog rendered with productId:", productId)
  
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [media, setMedia] = useState<Media[]>([])
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)
  const [url, setUrl] = useState("")
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const fetchMedia = useCallback(async () => {
    setIsLoading(true)
    const mediaFiles = await getMedia(productId)
    setMedia(mediaFiles)
    // Если выбранный медиафайл был удален, сбрасываем выбор
    if (selectedMedia && !mediaFiles.find((m) => m.id === selectedMedia.id)) {
      setSelectedMedia(null)
    }
    setIsLoading(false)
  }, [productId, selectedMedia])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const handleAddByUrl = (mediaType: "image" | "video") => {
    if (!url.trim()) {
      toast({ variant: "destructive", title: "URL не может быть пустым" })
      return
    }

    startTransition(async () => {
      try {
        await addMediaByUrl(productId, url.trim(), mediaType)
        toast({ title: "Медиа добавлено" })
        setUrl("")
        fetchMedia()
      } catch (error) {
        console.error("Error adding media:", error)
        toast({ 
          variant: "destructive", 
          title: "Ошибка", 
          description: error instanceof Error ? error.message : "Не удалось добавить медиа" 
        })
      }
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log("File selected:", file.name, file.size, file.type)
    console.log("ProductId for upload:", productId)

    startTransition(async () => {
      try {
        console.log("Starting file upload...")
        const result = await uploadProductFile(productId, file)
        console.log("Upload result:", result)
        toast({ title: "Файл загружен" })
        fetchMedia()
      } catch (error) {
        console.error("Error uploading file:", error)
        toast({ 
          variant: "destructive", 
          title: "Ошибка загрузки", 
          description: error instanceof Error ? error.message : "Не удалось загрузить файл" 
        })
      }
    })
    e.target.value = "" // Reset file input
  }

  const handleDelete = (id: number) => {
    startTransition(async () => {
      try {
        await deleteMedia(productId, id)
        toast({ title: "Медиа удалено" })
        fetchMedia()
      } catch (error) {
        console.error("Error deleting media:", error)
        toast({ 
          variant: "destructive", 
          title: "Ошибка", 
          description: error instanceof Error ? error.message : "Не удалось удалить медиа" 
        })
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = media.findIndex((m) => m.id === active.id)
      const newIndex = media.findIndex((m) => m.id === over.id)
      const newMedia = Array.from(media)
      const [movedItem] = newMedia.splice(oldIndex, 1)
      newMedia.splice(newIndex, 0, movedItem)
      setMedia(newMedia)

      const orderPayload = newMedia.map((m, index) => ({ id: m.id, order: index + 1 }))
      startTransition(async () => {
        await reorderMedia(productId, orderPayload)
      })
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] w-[98vw] h-[98vh] p-0">
        <div className="flex flex-1 gap-4 p-4 overflow-hidden h-full">
          {/* Левая панель - управление медиафайлами */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {/* Панель добавления медиафайлов */}
            <Card className="flex-shrink-0 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Добавить медиафайлы</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Загрузить файлы
                    </TabsTrigger>
                    <TabsTrigger value="url" className="flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      Добавить по URL
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Выберите файлы (изображения или видео)</Label>
                      <Input
                        type="file"
                        onChange={handleFileChange}
                        disabled={isPending}
                        accept="image/*,video/*"
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-gray-500">Поддерживаемые форматы: JPG, PNG, GIF, MP4, AVI, MOV</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="url" className="space-y-4 mt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>URL медиафайла</Label>
                        <Input
                          placeholder="https://example.com/image.jpg или https://www.youtube.com/watch?v=..."
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          disabled={isPending}
                        />
                        <p className="text-xs text-gray-500">
                          Поддерживаются прямые ссылки на изображения, видео и YouTube
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAddByUrl("image")}
                          disabled={isPending || !url.trim()}
                          className="flex-1"
                          variant="outline"
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <ImageIcon className="h-4 w-4 mr-2" />
                          )}
                          Как изображение
                        </Button>
                        <Button
                          onClick={() => handleAddByUrl("video")}
                          disabled={isPending || !url.trim()}
                          className="flex-1"
                          variant="outline"
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Video className="h-4 w-4 mr-2" />
                          )}
                          Как видео
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Список медиафайлов */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-lg">Медиафайлы ({media.length})</CardTitle>
                <p className="text-sm text-gray-600">Перетаскивайте для изменения порядка, кликайте для просмотра</p>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : media.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={media.map((m) => m.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {media.map((m) => (
                          <SortableMediaItem
                            key={m.id}
                            media={m}
                            onDelete={handleDelete}
                            onSelect={setSelectedMedia}
                            isSelected={selectedMedia?.id === m.id}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Медиафайлов пока нет</p>
                    <p className="text-sm">Добавьте изображения или видео выше</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Правая панель - просмотр (увеличенная) */}
          <div className="w-2/3 min-w-0 h-full">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-lg">Просмотр</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4 min-h-0">
                <MediaViewer media={selectedMedia} />
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
