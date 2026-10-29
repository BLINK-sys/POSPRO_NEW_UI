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

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const p = await loadProduct(slug)
  if (!p) return { title: "Товар не найден | PosPro" }

  const brand = p.brand_info?.name || p.brand?.name || ""
  const title = `${p.name} — купить в Казахстане${priceLine(p.price)} | PosPro`
  const brandPart = brand ? ` ${brand}.` : ""
  const availability =
    p.quantity > 0 ? "В наличии." : "Под заказ, уточните сроки."
  const desc =
    `${p.name}.${brandPart} ${availability} Доставка по Казахстану, безнал для ТОО.`
      .replace(/\s+/g, " ")
      .slice(0, 160)
  const canonical = `https://pospro.kz/product/${slug}`
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

  const canonical = `https://pospro.kz/product/${slug}`
  const brandName = p.brand_info?.name || p.brand?.name
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
      item: `https://pospro.kz/category/${p.category.slug}`,
    })
  }
  breadcrumb.itemListElement.push({
    "@type": "ListItem",
    position: breadcrumb.itemListElement.length + 1,
    name: p.name,
    item: canonical,
  })

  const product: any = {
    "@type": "Product",
    name: p.name,
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
