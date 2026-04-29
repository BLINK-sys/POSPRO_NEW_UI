"use client"

import { useCallback, useState } from "react"
import Cropper, { type Area, type MediaSize } from "react-easy-crop"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ZoomIn, ZoomOut, RotateCcw, Maximize } from "lucide-react"

interface ImageCropperDialogProps {
  src: string
  fileName: string
  fileType: string
  /** Aspect ratio of the crop frame (width / height). Default 1 (square). */
  aspect?: number
  /** Output width in pixels. Output height is derived from aspect. */
  outputWidth?: number
  title?: string
  description?: string
  onApply: (croppedFile: File) => void
  onCancel: () => void
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

async function cropToFile(
  src: string,
  pixelCrop: Area,
  fileName: string,
  fileType: string,
  outW: number,
  outH: number,
): Promise<File> {
  const image = await loadImage(src)
  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas context unavailable")

  const wantsTransparency = fileType === "image/png" || fileType === "image/webp"
  if (!wantsTransparency) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, outW, outH)
  }

  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH,
  )

  const outType = wantsTransparency ? fileType : "image/jpeg"
  const outQuality = outType === "image/jpeg" ? 0.92 : undefined

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      outType,
      outQuality,
    )
  })

  const baseName = fileName.replace(/\.[^.]+$/, "")
  const ext = outType === "image/png" ? ".png" : outType === "image/webp" ? ".webp" : ".jpg"
  return new File([blob], `${baseName}${ext}`, { type: outType })
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5

export function ImageCropperDialog({
  src,
  fileName,
  fileType,
  aspect = 1,
  outputWidth = 600,
  title = "Обрежьте изображение",
  description,
  onApply,
  onCancel,
}: ImageCropperDialogProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [completedPixelCrop, setCompletedPixelCrop] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  // Captured for "Подогнать" — needs both image and crop frame sizes.
  const [mediaSize, setMediaSize] = useState<{ w: number; h: number } | null>(null)
  const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(null)

  const outW = Math.round(outputWidth)
  const outH = Math.round(outputWidth / aspect)

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCompletedPixelCrop(areaPixels)
  }, [])

  const handleMediaLoaded = useCallback((media: MediaSize) => {
    setMediaSize({ w: media.width, h: media.height })
  }, [])

  const handleCropSizeChange = useCallback((size: { width: number; height: number }) => {
    setCropSize(size)
  }, [])

  const reset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const fitToFrame = () => {
    if (!mediaSize || !cropSize) return
    // Pick the zoom that makes the image fully cover the crop frame.
    const newZoom = Math.max(cropSize.width / mediaSize.w, cropSize.height / mediaSize.h)
    setZoom(Number(newZoom.toFixed(3)))
    setCrop({ x: 0, y: 0 })
  }

  const handleApply = async () => {
    if (!completedPixelCrop) return
    setBusy(true)
    try {
      const file = await cropToFile(src, completedPixelCrop, fileName, fileType, outW, outH)
      onApply(file)
    } catch (err) {
      console.error("Crop failed:", err)
      alert("Не удалось обрезать изображение. Попробуйте другой файл.")
    } finally {
      setBusy(false)
    }
  }

  const desc = description ?? (
    aspect === 1
      ? "Перетаскивайте картинку для смещения, scroll или ползунок снизу — для масштаба. Соотношение фиксировано 1:1."
      : `Перетаскивайте картинку для смещения, scroll или ползунок снизу — для масштаба. Соотношение фиксировано ${aspect.toFixed(2).replace(/\.?0+$/, "")} : 1.`
  )

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {desc}
            <span className="ml-1">
              Итоговый размер: <strong>{outW} × {outH} px</strong>.
            </span>
          </p>

          <div
            className="relative rounded-md overflow-hidden border border-gray-200"
            style={{
              height: "55vh",
              backgroundColor: "#f5f5f5",
              backgroundImage:
                "linear-gradient(45deg, #d9d9d9 25%, transparent 25%), " +
                "linear-gradient(-45deg, #d9d9d9 25%, transparent 25%), " +
                "linear-gradient(45deg, transparent 75%, #d9d9d9 75%), " +
                "linear-gradient(-45deg, transparent 75%, #d9d9d9 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, 10px 0px",
            }}
          >
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              onMediaLoaded={handleMediaLoaded}
              onCropSizeChange={handleCropSizeChange}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              restrictPosition={false}
              showGrid={true}
              objectFit="contain"
            />
          </div>

          <div className="flex items-center gap-3 px-1">
            <ZoomOut className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 w-12 text-right tabular-nums">{zoom.toFixed(2)}×</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              В исходное
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fitToFrame}
              disabled={!mediaSize || !cropSize}
              title="Установить масштаб так, чтобы изображение полностью покрыло рамку"
            >
              <Maximize className="h-4 w-4 mr-2" />
              Подогнать
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Отмена
          </Button>
          <Button type="button" onClick={handleApply} disabled={busy || !completedPixelCrop}>
            {busy ? "Обрезаю..." : "Применить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
