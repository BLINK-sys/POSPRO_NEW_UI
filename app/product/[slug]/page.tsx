/**
 * SEO П.2+П.3+П.4+П.5 для /product/[slug] — страница товара.
 *
 * Самая важная для SEO: Product + Offer JSON-LD (цена/валюта/наличие),
 * BreadcrumbList, canonical, og. Клиентский слой — вся богатая
 * интерактивность (галерея, корзина, аналоги, PDF, табы).
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getProductBySlug } from "@/app/actions/products"
import ProductClient from "./product-client"

export const revalidate = 1800

async function loadProduct(slug: string): Promise<any | null> {
  try {
    const p = await getProductBySlug(slug)
    if (!p || !p.id) return null
    return p
  } catch {
    return null
  }
}

function absoluteImageUrl(src?: string | null): string | undefined {
  if (!src || typeof src !== "string") return undefined
  if (src.startsWith("http://") || src.startsWith("https://")) return src
  if (src.startsWith("/uploads/")) return `https://pospro.kz${src}`
  if (src.startsWith("/")) return `https://pospro.kz${src}`
  return undefined
}

function priceLine(price?: number | null): string {
  if (!price || price <= 0) return ""
  // Казахстанский формат: 450 000 ₸
  const formatted = new Intl.NumberFormat("ru-RU").format(price)
  return `, цена ${formatted} ₸`
}

/**
 * Нормализация имени товара для title/og/JSON-LD. Правило аудитора:
 *   «меняйте только слова, целиком набранные капсом и без цифр,
 *    бренды и артикулы не трогайте».
 *
 * Работаем по токенам (split по пробелам). Токен превращаем из
 * «КРИЧАЩЕГО» в «Title case» только если ВСЁ сразу:
 *   1) в токене есть хоть одна буква;
 *   2) в токене НЕТ цифр (иначе это артикул/модель);
 *   3) длина токена — минимум 4 буквы;
 *   4) все буквы — заглавные;
 *   5) в токене есть **кириллические** заглавные (хотя бы одна).
 *
 * П.5 спасает латинские бренды из 4+ капсовых букв: `UNOX`, `SONY`,
 * `ROLLER` — в русскоязычном магазине это почти всегда бренд/артикул,
 * оставляем как есть. «ЛАРЬ», «МОРОЗИЛЬНЫЙ», «СТОЛ» — наоборот,
 * чинится корректно.
 *
 * Смешанный регистр (`Kayman`, `Roller Grill`) — не трогаем, автор
 * сам так написал. Полностью lowercase (`kayman`, `спс-227/1008`) —
 * тоже не трогаем: в БД такие имена ввёл менеджер / импорт, править
 * надо данные, а не display. Разделители (`/`, `-`, `:`) сохраняем.
 */
function smartName(s: string): string {
  const CYR_UPPER = /[А-ЯЁ]/
  return s.replace(/\S+/g, (token) => {
    if (/\d/.test(token)) return token
    const letters = token.match(/\p{L}/gu) ?? []
    if (letters.length < 4) return token
    const allUpper = letters.every(
      (c) => c === c.toUpperCase() && c !== c.toLowerCase(),
    )
    if (!allUpper) return token
    if (!CYR_UPPER.test(token)) return token
    let firstLetterSeen = false
    return Array.from(token)
      .map((ch) => {
        if (/\p{L}/u.test(ch)) {
          if (!firstLetterSeen) {
            firstLetterSeen = true
            return ch.toUpperCase()
          }
          return ch.toLowerCase()
        }
        return ch
      })
      .join("")
  })
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const p = await loadProduct(slug)
  if (!p) return { title: "Товар не найден | PosPro" }

  const brand = p.brand_info?.name || p.brand?.name || ""
  const prettyName = smartName(p.name)
  const title = `${prettyName} — купить в Казахстане${priceLine(p.price)} | PosPro`
  const brandPart = brand ? ` ${brand}.` : ""
  const availability =
    p.quantity > 0 ? "В наличии." : "Под заказ, уточните сроки."
  const desc =
    `${prettyName}.${brandPart} ${availability} Доставка по Казахстану, безнал для ТОО.`
      .replace(/\s+/g, " ")
      .slice(0, 160)
  const canonical = `https://pospro.kz/product/${slug}/`
  const image = absoluteImageUrl(p.image || p.image_url)

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function ProductPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const p = await loadProduct(slug)
  if (!p) notFound()

  const canonical = `https://pospro.kz/product/${slug}/`
  const brandName = p.brand_info?.name || p.brand?.name
  const prettyName = smartName(p.name)
  const image = absoluteImageUrl(p.image || p.image_url)
  const inStock = (p.quantity ?? 0) > 0

  const breadcrumb: any = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: "https://pospro.kz/",
      },
    ],
  }
  if (p.category?.slug) {
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 2,
      name: p.category.name,
      item: `https://pospro.kz/category/${p.category.slug}/`,
    })
  }
  breadcrumb.itemListElement.push({
    "@type": "ListItem",
    position: breadcrumb.itemListElement.length + 1,
    name: prettyName,
    item: canonical,
  })

  const product: any = {
    "@type": "Product",
    name: prettyName,
    description: p.description || undefined,
    sku: p.article || undefined,
    image: image || undefined,
    brand: brandName
      ? { "@type": "Brand", name: brandName }
      : undefined,
  }
  if (p.price && p.price > 0) {
    product.offers = {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "KZT",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      url: canonical,
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [breadcrumb, product],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductClient slug={slug} initialProduct={p} />
    </>
  )
}
