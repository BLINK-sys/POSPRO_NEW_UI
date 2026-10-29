import { Suspense } from "react"
import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { getHomepageData, getFooterSettings } from "./actions/public"
import HomepageBlockComponent from "@/components/homepage-block"
import HomepageBannerWrapper from "@/components/homepage-banner-wrapper"
import MobileHomeWrapper from "@/components/mobile/mobile-home-wrapper"
import { getApiUrl } from "@/lib/api-address"

export const dynamic = 'force-dynamic'

const HOMEPAGE_TITLE =
  "Оборудование для ресторанов, кафе и магазинов в Казахстане | PosPro"
const HOMEPAGE_DESCRIPTION =
  "Профессиональное оборудование для бизнеса: пекарни, рестораны, " +
  "кафе, магазины. Большой каталог, доставка по Казахстану, безнал " +
  "для ТОО."

export const metadata: Metadata = {
  title: HOMEPAGE_TITLE,
  description: HOMEPAGE_DESCRIPTION,
  alternates: { canonical: "https://pospro.kz/" },
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    url: "https://pospro.kz/",
    type: "website",
  },
}

async function OrganizationLd() {
  // Данные для разметки — те же что рендерятся в подвале (адрес,
  // телефон, email). Берём через кешированный server action, чтобы
  // не делать лишнего HTTP вызова при каждом рендере главной.
  let footer: {
    address?: string
    phone?: string
    email?: string
  } = {}
  try {
    footer = await getFooterSettings()
  } catch {
    // тихо — главная всё равно отрендерится, просто без Organization
  }
  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PosPro",
    url: "https://pospro.kz/",
    logo: "https://pospro.kz/logo.png",
  }
  if (footer.address) {
    org.address = {
      "@type": "PostalAddress",
      streetAddress: footer.address,
      addressCountry: "KZ",
    }
  }
  if (footer.phone) {
    org.contactPoint = {
      "@type": "ContactPoint",
      telephone: footer.phone,
      contactType: "sales",
      areaServed: "KZ",
      availableLanguage: ["ru", "kk"],
    }
  }
  if (footer.email) {
    org.email = footer.email
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
    />
  )
}

// Компонент загрузки
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">Загрузка...</span>
    </div>
  )
}

// Компонент ошибки
function ErrorFallback() {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 mb-4">Не удалось загрузить данные</p>
      <Link href="/">
        <Button>
          Попробовать снова
        </Button>
      </Link>
    </div>
  )
}

// Десктопный контент (выделен для передачи в wrapper)
function DesktopHomepageContent({ data, hasSlideCatalog }: { data: any; hasSlideCatalog: boolean }) {
  const hasBanner = Array.isArray(data.banners) && data.banners.length > 0
  // Доп top-padding нужен ровно ОДНОМУ элементу — самому первому, который
  // виден пользователю: баннер если он есть, иначе первый блок.
  const bannerNeedsExtraTop = hasSlideCatalog && hasBanner
  const firstBlockNeedsExtraTop = hasSlideCatalog && !hasBanner
  return (
    <div className="bg-white dark:bg-gray-950">
      {/* Баннеры или панель каталога */}
      <HomepageBannerWrapper banners={data.banners} extraTop={bannerNeedsExtraTop} />

      {/* Блоки контента */}
      {data.blocks && data.blocks.length > 0 ? (
        data.blocks.map((block: any, index: number) => (
          <HomepageBlockComponent
            key={block.id}
            block={block}
            isFirstBlock={index === 0}
            isLastBlock={index === data.blocks.length - 1}
            hasSlideCatalog={firstBlockNeedsExtraTop}
          />
        ))
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Блоки не найдены</p>
          <p className="text-sm text-gray-400">Проверьте настройки в админ панели</p>
        </div>
      )}

      {/* Дефолтный блок если нет данных */}
      {(!data.blocks || data.blocks.length === 0) && (
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6 text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
              Откройте для себя лучшие товары
            </h1>
            <p className="max-w-[600px] text-gray-500 md:text-xl mx-auto mt-4">
              Качественная электроника по доступным ценам. Быстрая доставка по всему Казахстану.
            </p>
            <div className="mt-6">
              <Link href="/auth">
                <Button size="lg" className="bg-brand-yellow text-black hover:bg-yellow-500">
                  Начать покупки
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

// Дёргаем на сервере: включена ли slide-панель каталога. Кнопка «Каталог»
// торчит из-под шапки на 28px и наезжает на первый блок — если панель
// включена, первому блоку нужен доп top-padding.
async function getSlideCatalogEnabled(): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/api/catalog-visibility'), { cache: 'no-store' })
    if (!res.ok) return true
    const json = await res.json()
    return json?.visibility?.slide !== false
  } catch {
    return true
  }
}

// Компонент с данными
async function HomepageContent() {
  try {
    const [data, hasSlideCatalog] = await Promise.all([
      getHomepageData(),
      getSlideCatalogEnabled(),
    ])

    return (
      <MobileHomeWrapper
        banners={data.banners || []}
        blocks={data.blocks || []}
        desktopContent={<DesktopHomepageContent data={data} hasSlideCatalog={hasSlideCatalog} />}
      />
    )
  } catch (error) {
    console.error("Error loading homepage data:", error)
    return <ErrorFallback />
  }
}

export default function HomePage() {
  return (
    <>
      <OrganizationLd />
      <Suspense fallback={<LoadingSpinner />}>
        <HomepageContent />
      </Suspense>
    </>
  )
}
