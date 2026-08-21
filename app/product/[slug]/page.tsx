"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import MobileProductPage from "@/components/mobile/mobile-product-page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Package,
  FileText,
  Download,
  Star,
  Info,
  ShoppingCart,
  ExternalLink,
  Play,
  Image as ImageIcon,
  Pencil,
  ChevronRight,
  ChevronLeft,
  Scale,
  Maximize2,
  ZoomIn,
  X as XIcon,
} from "lucide-react"
import { getProductBySlug } from "@/app/actions/products"
import { createBitrixPriceInquiry } from "@/app/actions/bitrix"
import { toast } from "@/hooks/use-toast"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { AddToKPButton } from "@/components/add-to-kp-button"
import { CompareButton } from "@/components/compare-button"
import { CardAdminEditButton } from "@/components/card-admin-edit-button"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"
import { getProductAvailabilityStatus, ProductAvailabilityStatus } from "@/app/actions/public"
import { getSuppliersText, getWinningWarehouseSuffix } from "@/lib/product-helpers"
import Image from "next/image"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/api-address"
import { formatProductPrice, formatPhone, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { getImageUrl as sharedGetImageUrl } from "@/lib/image-utils"
import { useAuth } from "@/context/auth-context"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"


interface ProductDetail {
  id: number
  name: string
  slug: string
  article: string
  price: number
  wholesale_price?: number
  quantity: number
  status?: string
  is_visible: boolean
  country?: string
  brand_id?: number | null
  brand_info?: {
    id: number
    name: string
    country?: string
    description?: string
    image_url?: string
  }
  description?: string
  category_id?: number
  image?: string
  supplier_id?: number | null
  supplier?: { id: number; name: string } | null
  supplier_name?: string | null
  suppliers?: { id: number; name: string }[]
  availability_status?: ProductAvailabilityStatus
  characteristics: Array<{
    id: number
    key: string
    value: string
    sort_order: number
    unit_of_measurement?: string
  }>
  media: Array<{
    id: number
    media_type: 'image' | 'video'
    url: string
    order: number
  }>
  documents: Array<{
    id: number
    filename: string
    url: string
    file_type: string
    mime_type: string
  }>
  drivers: Array<{
    id: number
    filename: string
    url: string
    file_type: string
    mime_type: string
  }>
}

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const slug = params.slug as string
  const isMobile = useIsMobile()

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [activeTab, setActiveTab] = useState("description")
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set())
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [showBrandTooltip, setShowBrandTooltip] = useState(false)
  const [showPriceInquiry, setShowPriceInquiry] = useState(false)
  const [inquiryName, setInquiryName] = useState("")
  const [inquiryPhone, setInquiryPhone] = useState("")
  const [submittingInquiry, setSubmittingInquiry] = useState(false)

  // Функция для получения правильного URL изображения
  const getImageUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") {
      return "/placeholder.svg"
    }
    
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    if (url.startsWith("/uploads/")) {
      // Сервер обслуживает файлы через /uploads/, а не /disk/
      return `${API_BASE_URL}${url}`
    }
    
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  // Функция для получения URL файла
  const getFileUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    // Сервер обслуживает файлы через /uploads/, а не /disk/
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  // Функция для получения YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
    return videoId || null
  }

  // Функция для преобразования YouTube URL в embed URL
  const getYouTubeEmbedUrl = (url: string): string => {
    const videoId = getYouTubeVideoId(url)
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url
  }

  // Превью YouTube — mqdefault (16:9, 320×180, без чёрных полос по
  // сравнению с hqdefault 4:3). Нужно чтобы object-cover в квадратной
  // миниатюре показывал именно кадр из видео, а не полосы.
  const getYouTubeThumbnail = (url: string): string => {
    const videoId = getYouTubeVideoId(url)
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : ''
  }

  // Функция для скачивания файлов без мерцания страницы
  const downloadFile = async (url: string, filename: string) => {
    const fileKey = `${url}-${filename}`
    
    // Проверяем, не скачивается ли уже этот файл
    if (downloadingFiles.has(fileKey)) return
    
    try {
      setDownloadingFiles(prev => new Set(prev).add(fileKey))
      
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
        // Убираем состояние загрузки
        setDownloadingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(fileKey)
          return newSet
        })
      }, 1000) // Увеличиваем время для лучшего UX
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error)
      // Fallback: открываем в новой вкладке
      window.open(getFileUrl(url), '_blank', 'noopener,noreferrer')
      // Убираем состояние загрузки
      setDownloadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileKey)
        return newSet
      })
    }
  }

  // Экспорт карточки товара в PDF: рендерим offscreen A4-разметку,
  // делаем скриншот через html2canvas и разбиваем на страницы.
  // Такой путь обходит проблему кириллицы в jsPDF без подкладывания
  // custom-шрифтов — работает тот же паттерн, что в /kp.
  const handleExportProductPdf = async () => {
    if (!product || pdfExporting) return
    setPdfExporting(true)

    const A4_W_PX = 794       // 210mm @ 96dpi
    const A4_H_PX = 1123      // 297mm @ 96dpi
    const A4_W_MM = 210
    const A4_H_MM = 297

    // Колонтитулы:
    //  • Первая страница получает бо́льший отступ сверху под шапку с лого.
    //  • Остальные страницы — маленький технический отступ (лого не рисуем).
    //  • Подвал (иконка + «© PosPro») — на каждой странице.
    const HEADER_H_FIRST_MM = 22
    const HEADER_H_OTHER_MM = 6
    const FOOTER_H_MM = 10
    const CONTENT_BOTTOM_MM = A4_H_MM - FOOTER_H_MM
    const FIRST_CONTENT_H_MM = CONTENT_BOTTOM_MM - HEADER_H_FIRST_MM
    const OTHER_CONTENT_H_MM = CONTENT_BOTTOM_MM - HEADER_H_OTHER_MM

    let container: HTMLDivElement | null = null
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      // Общий загрузчик локального ассета в dataURL (для jsPDF.addImage).
      const loadLocalAsDataUrl = async (path: string): Promise<string | null> => {
        try {
          const resp = await fetch(path)
          if (!resp.ok) return null
          const blob = await resp.blob()
          return await new Promise<string>((resolve) => {
            const r = new FileReader()
            r.onloadend = () => resolve(r.result as string)
            r.readAsDataURL(blob)
          })
        } catch { return null }
      }

      const headerLogo = await loadLocalAsDataUrl('/ui/big_logo.png')
      const footerIcon = await loadLocalAsDataUrl('/ui/Logo.png')

      const mainImage = product.media?.find((m) => m.media_type === 'image')?.url
      let mainImageDataUrl: string | null = null
      if (mainImage) {
        try {
          const url = mainImage.startsWith('http') ? mainImage : `${API_BASE_URL}${mainImage.startsWith('/') ? mainImage : `/${mainImage}`}`
          const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)
          if (resp.ok) {
            const blob = await resp.blob()
            mainImageDataUrl = await new Promise<string>((resolve) => {
              const r = new FileReader()
              r.onloadend = () => resolve(r.result as string)
              r.readAsDataURL(blob)
            })
          }
        } catch (e) {
          console.warn('Не удалось загрузить основное изображение:', e)
        }
      }

      const chars = (product.characteristics || [])
        .filter((c) => c.key.toLowerCase() !== 'code')
        .sort((a, b) => a.sort_order - b.sort_order)

      const esc = (s: string | undefined | null) =>
        (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

      // Секция 1 — карточка товара (без артикула). Название центрировано.
      const mainHtml = `
        <div style="font-size:24px;font-weight:700;line-height:1.2;margin-bottom:16px;color:#111827;text-align:center;">${esc(product.name)}</div>

        ${mainImageDataUrl ? `
          <div style="display:flex;justify-content:center;align-items:center;background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:20px;">
            <img src="${mainImageDataUrl}" style="max-width:100%;max-height:340px;object-fit:contain;" />
          </div>` : ''}

        <table style="width:100%;font-size:13px;line-height:1.4;border-collapse:collapse;margin-bottom:16px;">
          ${product.country ? `<tr><td style="padding:4px 0;color:#6b7280;font-weight:500;width:170px;">Страна производителя</td><td style="padding:4px 0;color:#111827;">${esc(product.country)}</td></tr>` : ''}
          ${product.brand_info?.name ? `<tr><td style="padding:4px 0;color:#6b7280;font-weight:500;">Бренд</td><td style="padding:4px 0;color:#111827;">${esc(product.brand_info.name)}</td></tr>` : ''}
        </table>

        ${product.description ? `
          <div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Описание</div>
            <div style="font-size:13px;line-height:1.55;color:#374151;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;">${esc(product.description)}</div>
          </div>` : ''}
      `

      // Секция 2 — характеристики (всегда на новом листе).
      const charsHtml = chars.length > 0 ? `
        <div style="font-size:16px;color:#111827;font-weight:700;margin-bottom:12px;">Характеристики</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          ${chars.map((c) => `
            <tr>
              <td style="padding:6px 12px 6px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-weight:500;width:50%;vertical-align:top;text-transform:uppercase;letter-spacing:0.03em;font-size:11px;word-wrap:break-word;overflow-wrap:anywhere;">${esc(c.key)}</td>
              <td style="padding:6px 0 6px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;text-align:right;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;">
                ${esc(c.value)}${c.unit_of_measurement ? ` <span style="color:#9ca3af;">(${esc(c.unit_of_measurement)})</span>` : ''}
              </td>
            </tr>`).join('')}
        </table>
      ` : ''

      // Общая обёртка для offscreen-рендера двух секций по очереди.
      container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.top = '-99999px'
      container.style.left = '0'
      container.style.width = `${A4_W_PX}px`
      container.style.background = '#ffffff'
      container.style.color = '#111827'
      container.style.fontFamily = "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif"
      // Верхний padding маленький — первую страницу «уплотняет» так,
      // чтобы название прижалось ближе к лого шапки в PDF.
      container.style.padding = '0 40px 40px'
      container.style.boxSizing = 'border-box'
      document.body.appendChild(container)

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const imgW = A4_W_MM

      // Подвал — иконка + «© PosPro» слева снизу, на каждой странице.
      // Приподнято от края страницы.
      const drawFooter = () => {
        if (footerIcon) {
          try { pdf.addImage(footerIcon, 'PNG', 8, A4_H_MM - 10, 6, 6, undefined, 'FAST') } catch {}
        }
        pdf.setFontSize(7)
        pdf.setTextColor(150)
        pdf.text('© PosPro', 17, A4_H_MM - 5.5)
        pdf.setTextColor(0)
      }

      // Шапка с логотипом PosPro — крупная, только на самой первой
      // странице PDF (не повторяется на переносах и на характеристиках).
      const drawFirstHeader = () => {
        if (!headerLogo) return
        const logoH = 14.4      // -10% от прежних 16
        const logoW = 55.8      // сохраняем пропорцию 62×16
        const x = (A4_W_MM - logoW) / 2
        try { pdf.addImage(headerLogo, 'PNG', x, 4, logoW, logoH, undefined, 'FAST') } catch {}
      }

      // Перекрытие: чтобы строка на границе не разрезалась пополам.
      const OVERLAP_MM = 6
      let isFirstPdfPage = true

      const renderSection = async (html: string, isFirstInPdf: boolean) => {
        container!.innerHTML = html
        await new Promise((r) => setTimeout(r, 60))
        const canvas = await html2canvas(container!, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: A4_W_PX,
          windowWidth: A4_W_PX,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        const imgH = (canvas.height * imgW) / canvas.width

        // shownMm — сколько мм картинки уже показано полностью (без
        // overlap-запаса). Новая страница нужна только пока shownMm <
        // imgH − OVERLAP_MM — иначе хвост уже виден в overlap-области.
        let shownMm = 0

        const drawPage = (isVeryFirst: boolean) => {
          const headerH = isVeryFirst ? HEADER_H_FIRST_MM : HEADER_H_OTHER_MM
          const contentH = isVeryFirst ? FIRST_CONTENT_H_MM : OTHER_CONTENT_H_MM
          const yImg = headerH - shownMm
          pdf.addImage(imgData, 'JPEG', 0, yImg, imgW, imgH)
          // Белые полосы поверх областей колонтитулов — обрезают то,
          // что вылезло за границы контента.
          pdf.setFillColor(255, 255, 255)
          pdf.rect(0, 0, A4_W_MM, headerH, 'F')
          pdf.rect(0, CONTENT_BOTTOM_MM, A4_W_MM, FOOTER_H_MM, 'F')
          if (isVeryFirst) drawFirstHeader()
          drawFooter()
          shownMm += contentH
        }

        if (!isFirstInPdf) {
          pdf.addPage()
          isFirstPdfPage = false
        }

        drawPage(isFirstPdfPage)
        isFirstPdfPage = false

        // Порог = OVERLAP_MM: если осталось меньше overlap-запаса, весь
        // хвост уже виден в overlap-зоне текущей страницы — новую
        // страницу не добавляем (иначе получалась пустая страница).
        while (shownMm < imgH - OVERLAP_MM) {
          // Overlap: следующая страница возвращается на OVERLAP_MM назад,
          // чтобы строка на стыке не разрезалась.
          shownMm -= OVERLAP_MM
          pdf.addPage()
          drawPage(false)
        }
      }

      await renderSection(mainHtml, true)
      if (charsHtml) {
        // Характеристики — всегда с нового листа.
        await renderSection(charsHtml, false)
      }

      const safeName = (product.name || 'product').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
      pdf.save(`${safeName}.pdf`)
    } catch (e) {
      console.error('PDF export error:', e)
      toast({ title: 'Ошибка', description: 'Не удалось сформировать PDF', variant: 'destructive' })
    } finally {
      if (container && container.parentNode) container.parentNode.removeChild(container)
      setPdfExporting(false)
    }
  }

  // ✅ Прокрутка страницы в начало при переходе на страницу товара
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" })
    }
  }, [slug])

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const productData = await getProductBySlug(slug)

        // Если у товара нет страны, подгружаем из brand_info
        if (!productData.country && productData.brand_info?.country) {
          productData.country = productData.brand_info.country
        }
        
        // Получаем статус наличия для товара
        const availabilityStatus = await getProductAvailabilityStatus(productData.quantity, productData.supplier_id)
        
        // Добавляем статус наличия к данным товара
        const productWithStatus = {
          ...productData,
          availability_status: availabilityStatus
        }
        
        setProduct(productWithStatus)

        // Трекинг просмотра товара (кроме системных пользователей)
        if (user?.role !== 'admin' && user?.role !== 'system') {
          fetch(`${API_BASE_URL}/api/track-product-view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: productData.id,
              product_name: productData.name,
              product_slug: slug,
              user_agent: navigator.userAgent,
            }),
          }).catch(() => {})
        }

        // Устанавливаем первый медиафайл как активный
        if (productData.media.length > 0) {
          setActiveMediaIndex(0)
        }

        // Проверяем, доступен ли текущий активный таб
        const availableTabs = []
        if (productData.description && productData.description.trim() !== '') availableTabs.push('description')
        if (productData.characteristics.length > 0) availableTabs.push('characteristics')
        if (productData.documents.length > 0) availableTabs.push('documents')
        if (productData.drivers.length > 0) availableTabs.push('drivers')

        if (availableTabs.length > 0) {
          setActiveTab(availableTabs[0]) // Первый доступный таб
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка")
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchProduct()
    }
  }, [slug])

  // Получаем медиафайлы товара
  const productMedia = product?.media || []
  const activeMedia = productMedia[activeMediaIndex]
  const productImages = productMedia.filter(m => m.media_type === 'image')
  const productVideos = productMedia.filter(m => m.media_type === 'video')

  // Подсчитываем количество активных табов (описание сюда же — как ещё один таб)
  const hasDescription = !!(product?.description && product.description.trim() !== '')
  const hasCharacteristics = product?.characteristics && product.characteristics.length > 0
  const hasDocuments = product?.documents && product.documents.length > 0
  const hasDrivers = product?.drivers && product.drivers.length > 0
  const tabCount =
    (hasDescription ? 1 : 0) +
    (hasCharacteristics ? 1 : 0) +
    (hasDocuments ? 1 : 0) +
    (hasDrivers ? 1 : 0)
  const activeTabsCount = tabCount
  const gridColsClass =
    tabCount === 1 ? "grid-cols-1"
    : tabCount === 2 ? "grid-cols-2"
    : tabCount === 3 ? "grid-cols-3"
    : "grid-cols-4"

  const wholesaleUser = isWholesaleUser(user)
  const showWholesalePrice = wholesaleUser
  const retailPriceColor = getRetailPriceClass(wholesaleUser)
  const wholesalePriceColor = getWholesalePriceClass()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка товара...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ошибка</h1>
          <p className="text-gray-600">{error || "Товар не найден"}</p>
          <Button 
            onClick={() => router.back()} 
            className="mt-4"
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
        </div>
      </div>
    )
  }

  if (isMobile) return <MobileProductPage slug={slug} />

  return (
    <div className="container mx-auto px-4 md:px-6 py-4">
      {/* Хлебные крошки — компактно, вместо крупной кнопки «Назад».
          Категорию берём через as-any, потому что бэк отдаёт разные
          формы (строка или объект) в зависимости от эндпоинта; не хочу
          расширять локальный ProductDetail ради двух ссылок. */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
        <Link href="/" className="hover:text-brand-yellow transition-colors">Главная</Link>
        <ChevronRight className="h-3 w-3 text-gray-300" />
        {(() => {
          const cat: any = (product as any).category
          const categoryName = typeof cat === "string" ? cat : cat?.name
          const categorySlug = typeof cat === "string" ? undefined : cat?.slug
          if (!categoryName) return null
          return (
            <>
              {categorySlug ? (
                <Link href={`/category/${categorySlug}`} className="hover:text-brand-yellow transition-colors">
                  {categoryName}
                </Link>
              ) : (
                <span>{categoryName}</span>
              )}
              <ChevronRight className="h-3 w-3 text-gray-300" />
            </>
          )
        })()}
        <span className="text-gray-800 font-medium truncate max-w-[400px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-6 items-start">
        {/* Левая колонка — Медиа: миниатюры столбиком слева + основное фото.
            Фиксированная ширина 420px, чтобы длина описания в правой
            колонке не сдвигала размеры медиа. */}
        <div className="flex gap-2">
          {/* Миниатюры — вертикальный столбик слева. Padding, чтобы
              ring/shadow активной миниатюры не обрезался краем контейнера. */}
          {productMedia.length > 1 && (
            <div className="flex flex-col gap-2 w-20 shrink-0 max-h-[420px] overflow-y-auto p-1">
              {productMedia.map((media, index) => (
                <button
                  key={media.id}
                  onClick={() => setActiveMediaIndex(index)}
                  className={`aspect-square w-full relative bg-white rounded-md overflow-hidden shrink-0 transition-all duration-150 ${
                    index === activeMediaIndex
                      ? "ring-2 ring-brand-yellow shadow-[0_4px_10px_rgba(250,204,21,0.30)]"
                      : "ring-1 ring-gray-200 hover:ring-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  }`}
                  title={`${index + 1} / ${productMedia.length}`}
                >
                  {media.media_type === "image" ? (
                    <Image
                      src={getImageUrl(media.url)}
                      alt={`${product.name} — ${index + 1}`}
                      fill
                      className="object-contain p-1"
                    />
                  ) : media.media_type === "video" ? (
                    // Как в основном плеере: aspect-video блок внутри
                    // квадратной миниатюры, чтобы превью не растягивалось,
                    // а вписывалось с чёрными полосами сверху/снизу.
                    <div className="w-full h-full relative bg-black flex items-center justify-center">
                      <div className="w-full aspect-video relative">
                        {media.url.includes("youtube.com") || media.url.includes("youtu.be") ? (
                          !thumbnailErrors.has(media.url) ? (
                            <Image
                              src={getYouTubeThumbnail(media.url)}
                              alt="YouTube превью"
                              fill
                              unoptimized
                              className="object-cover"
                              onError={() => setThumbnailErrors((prev) => new Set(prev).add(media.url))}
                            />
                          ) : (
                            <div className="w-full h-full bg-black flex items-center justify-center">
                              <Play className="h-4 w-4 text-white" />
                            </div>
                          )
                        ) : (
                          <video src={getFileUrl(media.url)} className="w-full h-full object-cover" muted />
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <Play className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {/* Основное медиа — квадратное 420×420. Фикс-размеры, чтобы
              контейнер не «прыгал» при переключении image ↔ video и не
              менялся от ширины родителя. */}
          <div className="group relative w-[420px] h-[420px] shrink-0 bg-white rounded-lg overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            {activeMedia ? (
              activeMedia.media_type === 'image' ? (
                <Image
                  src={getImageUrl(activeMedia.url)}
                  alt={product.name}
                  fill
                  className="object-contain"
                />
              ) : activeMedia.media_type === 'video' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  {/* Внутренний блок 16:9 — чтобы YouTube-превью и само
                      видео сохраняли пропорции. w-full + aspect-video даст
                      высоту по ширине, max-h-full не позволит вылезти. */}
                  <div className="w-full aspect-video max-h-full">
                    {activeMedia.url.includes('youtube.com') || activeMedia.url.includes('youtu.be') ? (
                      <iframe
                        src={getYouTubeEmbedUrl(activeMedia.url)}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={getFileUrl(activeMedia.url)}
                        controls
                        className="w-full h-full object-contain"
                      >
                        Ваш браузер не поддерживает видео.
                      </video>
                    )}
                  </div>
                </div>
              ) : null
            ) : (
              <div className="flex items-center justify-center h-full">
                <ImageIcon className="h-12 w-12 text-gray-400" />
              </div>
            )}

            {/* Навигация по медиа */}
            {productMedia.length > 1 && (
              <>
                <button
                  onClick={() => setActiveMediaIndex(activeMediaIndex === 0 ? productMedia.length - 1 : activeMediaIndex - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all"
                  title="Предыдущее"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setActiveMediaIndex(activeMediaIndex === productMedia.length - 1 ? 0 : activeMediaIndex + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all"
                  title="Следующее"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Кнопка «Полный экран» — по центру карточки, в виде лупы */}
            {activeMedia && (
              <button
                onClick={() => setFullscreenOpen(true)}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 text-white p-3 rounded-full hover:bg-black/70 hover:scale-110 shadow-lg transition-all opacity-0 group-hover:opacity-100"
                title="Открыть на весь экран"
                aria-label="Увеличить"
              >
                <ZoomIn className="h-6 w-6" />
              </button>
            )}

            {/* Счётчик текущего медиа */}
            {productMedia.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full font-medium tabular-nums">
                {activeMediaIndex + 1} / {productMedia.length}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка - Информация о товаре */}
        <div className="space-y-3">
          {/* Название товара + быстрые действия для админов/КП */}
          <div>
            {/* Название + inline-действия. Не flex — иначе кнопки уезжают
                на отдельную строку, если название переносится. Через
                inline-block + align-middle кнопки идут прямо за последним
                словом текста. */}
            <h1 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
              {product.name}
              {" "}
              <span className="inline-flex items-center gap-2 align-middle">
                <CardAdminEditButton
                  entityType="product"
                  entityId={product.id}
                  entitySlug={product.slug}
                  entityName={product.name}
                />
                <CompareButton
                  productId={product.id}
                  productName={product.name}
                  productSlug={product.slug}
                  categoryId={product.category_id}
                  categoryName={
                    typeof (product as any).category === "string"
                      ? (product as any).category
                      : (product as any).category?.name
                  }
                  className="h-8 w-8 border border-brand-yellow bg-transparent hover:bg-brand-yellow/10 text-black shadow-sm hover:shadow-md"
                />
              </span>
            </h1>
          </div>

          {/* Мета+Наличие слева (каждый пункт в своей строке),
              кнопки-действия сразу после — прижаты слева к правому краю
              левой колонки, а не к правому краю всей карточки. */}
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-fit space-y-1 text-[11px] text-gray-600">
              {product.brand_info && (
                <div className="relative">
                  <span className="font-medium text-gray-700">Бренд:</span>{" "}
                  <Link
                    href={`/brand/${encodeURIComponent(product.brand_info.name)}`}
                    className="inline-block px-1.5 py-0.5 bg-gray-100 hover:bg-brand-yellow/60 text-gray-800 rounded font-medium transition-colors"
                    onMouseEnter={() => setShowBrandTooltip(true)}
                    onMouseLeave={() => setShowBrandTooltip(false)}
                  >
                    {product.brand_info.name}
                  </Link>
                  {showBrandTooltip && (
                    <div className="absolute z-50 px-2 py-1 bg-gray-900 text-white text-[10px] rounded shadow-lg -top-8 left-0 whitespace-nowrap">
                      Все товары бренда
                    </div>
                  )}
                </div>
              )}
              {(user?.role === "admin" || user?.role === "system") && (() => {
                const txt = getSuppliersText(product as any)
                return txt ? (
                  <div>
                    <span className="font-medium text-gray-700">Поставщик:</span> {txt}
                  </div>
                ) : null
              })()}
              {(product.country || product.brand_info?.country) && (
                <div>
                  <span className="font-medium text-gray-700">Страна:</span>{" "}
                  {product.country || product.brand_info?.country}
                </div>
              )}
              <div className="text-xs pt-0.5">
                <span className="font-medium text-gray-700">Наличие:</span>{" "}
                {product.availability_status ? (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
                    style={{
                      backgroundColor: product.availability_status.background_color,
                      color: product.availability_status.text_color,
                    }}
                  >
                    {formatAvailabilityStatusLabel(product.availability_status)}
                  </span>
                ) : (
                  <span className="text-gray-600">{product.quantity} шт.</span>
                )}
              </div>
            </div>

            {/* Кнопки: Для КП / Редактировать / PDF — прижаты слева */}
            <div className="flex flex-col items-start gap-1.5 shrink-0">
              <AddToKPButton
                productId={product.id}
                productName={product.name}
                productSlug={product.slug}
                productPrice={product.price}
                productWholesalePrice={product.wholesale_price}
                productImageUrl={product.media?.[0]?.url}
                productDescription={product.description}
                productArticle={product.article}
                productBrandName={product.brand_info?.name}
                productSupplierName={product.supplier?.name || product.supplier_name}
                productCharacteristics={product.characteristics?.map(c => ({ key: c.key, value: c.value }))}
                className="h-8 text-xs font-medium px-3 rounded-full shadow-sm hover:shadow-md transition-all duration-200"
                size="sm"
              />
              <Button
                onClick={handleExportProductPdf}
                disabled={pdfExporting}
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold px-3 rounded-full shadow-sm hover:shadow-md transition-all duration-200 bg-transparent border border-brand-yellow text-black hover:bg-brand-yellow/10"
                title="Скачать карточку товара в PDF"
              >
                {pdfExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-900 mr-1.5" />
                    Формируется…
                  </>
                ) : (
                  'PDF'
                )}
              </Button>
            </div>
          </div>

          {/* Цены — крупным акцентом */}
          <div className="pt-3 border-t border-gray-200 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-gray-700">Цена:</span>
              <span className={`text-lg font-bold ${retailPriceColor}`}>
                {formatProductPrice(product.price)}{getWinningWarehouseSuffix(product as any, user?.role === "admin" || user?.role === "system")}
              </span>
            </div>

            {showWholesalePrice && (
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-gray-700">Оптовая:</span>
                <span className={`text-base font-bold ${wholesalePriceColor}`}>
                  {formatProductPrice(product.wholesale_price)}
                </span>
              </div>
            )}

            {(!product.price || Number(product.price) <= 0) && (
              <div className="space-y-3">
                <Button
                  className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium"
                  onClick={() => setShowPriceInquiry(!showPriceInquiry)}
                >
                  Уточнить цену
                </Button>

                {showPriceInquiry && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <input
                      type="text"
                      placeholder="Имя"
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent"
                    />
                    <input
                      type="tel"
                      placeholder="+7 (___) ___-__-__"
                      value={inquiryPhone}
                      onChange={(e) => setInquiryPhone(formatPhone(e.target.value))}
                      onFocus={() => { if (!inquiryPhone) setInquiryPhone('+7 (') }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent"
                    />
                    <Button
                      className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium"
                      disabled={submittingInquiry || (inquiryPhone.replace(/\D/g, "").length < 11)}
                      onClick={async () => {
                        const digits = inquiryPhone.replace(/\D/g, "")
                        if (digits.length < 11) {
                          toast({ title: "Укажите номер телефона", description: "Без номера мы не сможем связаться", variant: "destructive" })
                          return
                        }
                        setSubmittingInquiry(true)
                        try {
                          const result = await createBitrixPriceInquiry({
                            customer_name: inquiryName,
                            customer_phone: inquiryPhone,
                            product_name: product.name,
                            product_slug: product.slug,
                          })
                          if (result.success) {
                            toast({ title: "Запрос отправлен", description: "Мы свяжемся с вами для уточнения цены" })
                            setInquiryName("")
                            setInquiryPhone("")
                            setShowPriceInquiry(false)
                          } else {
                            toast({ title: "Ошибка", description: result.message || "Не удалось отправить запрос", variant: "destructive" })
                          }
                        } catch {
                          toast({ title: "Ошибка", description: "Не удалось отправить запрос", variant: "destructive" })
                        } finally {
                          setSubmittingInquiry(false)
                        }
                      }}
                    >
                      {submittingInquiry ? "Отправка..." : "Узнать цену"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2 pt-3">
            <AddToCartButton
              productId={product.id}
              productName={product.name}
              productSlug={product.slug}
              productPrice={product.price}
              productImageUrl={product.media?.[0]?.url || null}
              productArticle={product.article || ''}
              className="flex-1 bg-brand-yellow hover:bg-yellow-500 text-black font-medium h-10 rounded-full shadow-sm hover:shadow-md text-sm transition-all duration-200"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              В корзину
            </AddToCartButton>

            <FavoriteButton
              productId={product.id}
              productName={product.name}
              className="flex-shrink-0 h-10 w-10 border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200"
              variant="ghost"
            />
          </div>

        </div>
        </div>

        {/* Табы с дополнительной информацией - внизу страницы */}
        {activeTabsCount > 0 ? (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full ${gridColsClass} rounded-full shadow-sm h-10 p-1`}>
                {hasDescription && (
                  <TabsTrigger value="description" className="rounded-full text-xs data-[state=active]:shadow-sm mx-0.5">Описание</TabsTrigger>
                )}
                {product.characteristics.length > 0 && (
                  <TabsTrigger value="characteristics" className="rounded-full text-xs data-[state=active]:shadow-sm mx-0.5">Характеристики</TabsTrigger>
                )}
                {product.documents.length > 0 && (
                  <TabsTrigger value="documents" className="rounded-full text-xs data-[state=active]:shadow-sm mx-0.5">Документы</TabsTrigger>
                )}
                {product.drivers.length > 0 && (
                  <TabsTrigger value="drivers" className="rounded-full text-xs data-[state=active]:shadow-sm mx-0.5">Драйверы</TabsTrigger>
                )}
              </TabsList>

            {hasDescription && (
              <TabsContent value="description" className="mt-4">
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">
                  {product.description}
                </div>
              </TabsContent>
            )}

            <TabsContent value="characteristics" className="mt-4">
              {product.characteristics.length > 0 ? (
                <div className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    {product.characteristics
                      .filter((char) => char.key.toLowerCase() !== "code")
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((char, index) => (
                        <div key={char.id} className="grid grid-cols-2 gap-3 py-1.5 border-b border-gray-100 last:border-b-0 items-start">
                          <span className="font-medium text-xs text-gray-700 uppercase tracking-wide break-words text-left">
                            {char.key}
                          </span>
                          <CharValue value={char.value} unit={char.unit_of_measurement} />
                        </div>
                      ))}
                  </div>
                  <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 transform -translate-x-1/2"></div>
                </div>
              ) : (
                <p className="text-gray-500 italic">Характеристики товара отсутствуют</p>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              {product.documents.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 justify-items-center">
                  {product.documents.map((doc) => (
                    <FileTile
                      key={doc.id}
                      filename={doc.filename}
                      url={doc.url}
                      downloading={downloadingFiles.has(`${doc.url}-${doc.filename}`)}
                      onDownload={() => downloadFile(doc.url, doc.filename)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Документы отсутствуют</p>
              )}
            </TabsContent>

            <TabsContent value="drivers" className="mt-4">
              {product.drivers.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 justify-items-center">
                  {product.drivers.map((driver) => (
                    <FileTile
                      key={driver.id}
                      filename={driver.filename}
                      url={driver.url}
                      downloading={downloadingFiles.has(`${driver.url}-${driver.filename}`)}
                      onDownload={() => downloadFile(driver.url, driver.filename)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Драйверы отсутствуют</p>
              )}
            </TabsContent>
          </Tabs>
          </div>
        ) : null}

        {/* Полноэкранный просмотр всех медиа товара (фото + видео).
            Стрелки next/prev, счётчик, Esc/крестик — закрывают. */}
        {fullscreenOpen && activeMedia && (
          <FullscreenMediaViewer
            media={productMedia}
            currentIndex={activeMediaIndex}
            onIndexChange={(i) => setActiveMediaIndex(i)}
            onClose={() => setFullscreenOpen(false)}
            productName={product.name}
          />
        )}
    </div>
  )
}

/**
 * Значение характеристики: одна строка — прижать справа, несколько —
 * прижать слева (иначе перенос вправо визуально ломает колонку).
 * Меряем реальную высоту через ResizeObserver — реагирует и на ресайз окна.
 */
function CharValue({ value, unit }: { value: string; unit?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [multiline, setMultiline] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const style = window.getComputedStyle(el)
      const lh = parseFloat(style.lineHeight)
      if (!isFinite(lh) || lh <= 0) return
      const h = el.getBoundingClientRect().height
      setMultiline(h > lh * 1.5)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value, unit])

  return (
    <span
      ref={ref}
      className={`text-xs text-gray-600 break-words ${multiline ? "text-left" : "text-right"}`}
      title={`${value}${unit ? ` (${unit})` : ""}`}
    >
      {value}
      {unit && <span className="text-gray-400 ml-1">({unit})</span>}
    </span>
  )
}

/**
 * Плитка файла (документ / драйвер) — квадратная карточка с иконкой,
 * названием под ней и кнопкой «Скачать» внизу. Заменяет широкие
 * горизонтальные строки — сеткой смотрится опрятнее.
 */
function FileTile({
  filename,
  url,
  downloading,
  onDownload,
}: {
  filename: string
  url: string
  downloading: boolean
  onDownload: () => void
}) {
  return (
    <div className="w-full aspect-square bg-black rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.20)] hover:ring-2 hover:ring-brand-yellow transition-all flex flex-col">
      {/* Верхние 80% высоты — лого по центру этой зоны. */}
      <div className="relative flex-[4] min-h-0">
        <Image
          src="/ui/for_docs_driver.png"
          alt=""
          fill
          className="object-contain p-6"
        />
      </div>

      {/* Нижние 20% — тот же чёрный фон, текст + кнопка. */}
      <div className="flex-1 min-h-0 px-2 pb-2 flex flex-col justify-end gap-1.5">
        <p
          className="text-white text-[11px] font-medium leading-tight line-clamp-1 text-center break-all"
          title={filename}
        >
          {filename}
        </p>
        <Button
          onClick={onDownload}
          disabled={downloading}
          size="sm"
          className="h-7 w-full px-2 text-[11px] bg-brand-yellow hover:bg-yellow-500 text-black font-medium rounded-md shadow-[0_2px_6px_rgba(250,204,21,0.35)]"
        >
          {downloading ? (
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-900" />
          ) : (
            <><Download className="h-3.5 w-3.5 mr-1" />Скачать</>
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * Полноэкранный просмотр медиа товара — изображения + видео (в т.ч. YouTube).
 * Крестик / Esc — закрыть, стрелки клавиатуры и на самом экране —
 * переключение между всеми медиа-элементами товара.
 */
function ytEmbedUrl(url: string): string {
  const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : url
}

function FullscreenMediaViewer({
  media,
  currentIndex,
  onIndexChange,
  onClose,
  productName,
}: {
  media: Array<{ id: number; url: string; media_type: "image" | "video" }>
  currentIndex: number
  onIndexChange: (i: number) => void
  onClose: () => void
  productName: string
}) {
  const total = media.length
  const current = media[currentIndex]

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft" && total > 1) onIndexChange((currentIndex - 1 + total) % total)
      else if (e.key === "ArrowRight" && total > 1) onIndexChange((currentIndex + 1) % total)
    }
    window.addEventListener("keydown", handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [currentIndex, total, onIndexChange, onClose])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Медиа-контент на всю высоту/ширину с padding; лежит НИЖЕ кнопок
          (у них z-10). Поддерживает image / video / YouTube. */}
      <div
        className="absolute inset-0 flex items-center justify-center p-8 md:p-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full">
          {current.media_type === "image" ? (
            <Image
              src={sharedGetImageUrl(current.url)}
              alt={productName}
              fill
              unoptimized
              className="object-contain"
              priority
            />
          ) : current.url.includes("youtube.com") || current.url.includes("youtu.be") ? (
            <iframe
              src={ytEmbedUrl(current.url)}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={productName}
            />
          ) : (
            <video
              src={sharedGetImageUrl(current.url)}
              controls
              autoPlay
              className="w-full h-full object-contain bg-black"
            />
          )}
        </div>
      </div>

      {/* Крестик */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors shadow-lg"
        title="Закрыть (Esc)"
        aria-label="Закрыть"
      >
        <XIcon className="h-6 w-6" />
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIndexChange((currentIndex - 1 + total) % total) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-3 transition-colors shadow-lg"
            title="Предыдущее (←)"
            aria-label="Предыдущее изображение"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIndexChange((currentIndex + 1) % total) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-3 transition-colors shadow-lg"
            title="Следующее (→)"
            aria-label="Следующее изображение"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white text-sm px-3 py-1 rounded-full font-medium tabular-nums">
            {currentIndex + 1} / {total}
          </div>
        </>
      )}
    </div>
  )
}
