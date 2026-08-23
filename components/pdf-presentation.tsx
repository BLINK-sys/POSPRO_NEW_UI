"use client"

import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import { Loader2 } from "lucide-react"

// pdf.js worker — тянем с CDN unpkg по версии установленного pdfjs.
// В next.config.js разрешить внешний src worker'а не надо, он не image.
// Если офлайн — можно перевести на локальный `/pdf.worker.min.mjs` через
// public/ и `import.meta.url`, но пока CDN достаточно и стабильно.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface Props {
  /** Полный URL к PDF-файлу (уже пропущенный через getImageUrl). */
  url: string
  /** Максимальная ширина страницы в пикселях. По умолчанию — 1200. */
  maxWidth?: number
}

/**
 * Вертикальный рендер всех страниц PDF-файла. Каждая страница —
 * отдельный <canvas> от pdf.js, следует одна за другой с минимальным
 * промежутком. Ширина адаптивная — измеряем контейнер через
 * ResizeObserver и передаём в <Page width>. Не рендерим страницы
 * которые ещё далеко за пределами viewport (react-pdf ничего умного
 * не делает из коробки, но у нас максимум ~15–30 страниц на карточку
 * презентации, так что можно все сразу).
 */
export function PdfPresentation({ url, maxWidth = 1200 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageWidth, setPageWidth] = useState<number>(800)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const w = el.clientWidth
      if (w > 0) setPageWidth(Math.min(w, maxWidth))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWidth])

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(err) => setLoadError(err?.message || "Не удалось загрузить PDF")}
        className="flex flex-col items-center gap-6"
        loading={
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загружаем презентацию…
          </div>
        }
        error={
          <div className="py-16 text-center text-sm text-red-600">
            {loadError || "Ошибка загрузки PDF"}
          </div>
        }
      >
        {numPages !== null &&
          Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i + 1}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-md rounded overflow-hidden bg-white"
            />
          ))}
      </Document>
    </div>
  )
}
