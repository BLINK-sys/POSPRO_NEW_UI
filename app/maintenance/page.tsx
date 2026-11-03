/**
 * Страница-заглушка «Магазин временно недоступен».
 *
 * Выводится middleware'ом через rewrite + HTTP 503, когда owner нажал
 * «Выключить магазин» в админке. Owner страницу не видит — для него
 * сайт работает как обычно.
 *
 * Берём актуальную табличку (title + body) из публичной ручки бэка,
 * чтобы при смене заготовки на лету заглушка менялась без redeploy.
 */

import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import { Phone, Mail, MessageCircle, Send } from "lucide-react"

import {
  getFooterSettings,
  type FooterSettings,
} from "@/app/actions/public"
import { getApiUrl } from "@/lib/api-address"

/** Приводит URL к абсолютному виду (как в footer.tsx — он не экспортит её). */
function ensureAbsoluteUrl(url: string): string {
  const t = (url || "").trim()
  if (!t || t === "#") return "#"
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t.replace(/^\/+/, "")}`
}

export const dynamic = "force-dynamic"

interface MaintenanceStatus {
  enabled: boolean
  notice: { title: string; body: string } | null
}

async function fetchStatus(): Promise<MaintenanceStatus> {
  try {
    const res = await fetch(getApiUrl("/api/public/maintenance-status"), {
      cache: "no-store",
    })
    if (!res.ok) return { enabled: false, notice: null }
    return (await res.json()) as MaintenanceStatus
  } catch {
    return { enabled: false, notice: null }
  }
}

export default async function MaintenancePage() {
  // headers() не нужны сам по себе — вызываем, чтобы Next отдал
  // индивидуальный ответ каждому пользователю (хотя rewrite уже это
  // делает). Это защита от неожиданного кеширования промежуточным
  // уровнем.
  await headers()

  const [status, footer] = await Promise.all([
    fetchStatus(),
    (async () => {
      try { return await getFooterSettings() } catch { return null }
    })(),
  ])

  const title =
    status.notice?.title?.trim() ||
    "Магазин временно недоступен"
  const body =
    status.notice?.body?.trim() ||
    "Проводим технические работы. Вернёмся в ближайшее время."

  return (
    <main className="min-h-dvh bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Логотип — тот же файл что в header.tsx. */}
        <Link href="/" className="mb-8" aria-label="PosPro">
          <Image
            src="/ui/big_logo.png"
            alt="PosPro"
            width={200}
            height={56}
            priority
            unoptimized
          />
        </Link>

        {/* Табличка */}
        <section className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 md:px-10 md:py-10 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 leading-tight">
            {title}
          </h1>
          {body && (
            <p className="mt-4 text-gray-600 text-base leading-relaxed whitespace-pre-wrap">
              {body}
            </p>
          )}
        </section>

        {/* Контакты + соцсети */}
        {footer && <ContactsRow footer={footer} />}
      </div>
    </main>
  )
}

function ContactsRow({ footer }: { footer: FooterSettings }) {
  const items: Array<{
    key: string
    href: string
    label: string
    icon: React.ReactNode
  }> = []
  if (footer.phone) {
    items.push({
      key: "phone",
      href: `tel:${footer.phone.replace(/[^+\d]/g, "")}`,
      label: footer.phone,
      icon: <Phone className="h-5 w-5" />,
    })
  }
  if (footer.email) {
    items.push({
      key: "email",
      href: `mailto:${footer.email}`,
      label: footer.email,
      icon: <Mail className="h-5 w-5" />,
    })
  }
  if (footer.whatsapp_url && footer.whatsapp_url !== "#") {
    items.push({
      key: "whatsapp",
      href: ensureAbsoluteUrl(footer.whatsapp_url),
      label: "WhatsApp",
      icon: <MessageCircle className="h-5 w-5" />,
    })
  }
  if (footer.telegram_url && footer.telegram_url !== "#") {
    items.push({
      key: "telegram",
      href: ensureAbsoluteUrl(footer.telegram_url),
      label: "Telegram",
      icon: <Send className="h-5 w-5" />,
    })
  }
  if (footer.instagram_url && footer.instagram_url !== "#") {
    items.push({
      key: "instagram",
      href: ensureAbsoluteUrl(footer.instagram_url),
      label: "Instagram",
      icon: <MessageCircle className="h-5 w-5" />,
    })
  }
  if (items.length === 0) return null

  return (
    <nav className="mt-10 w-full max-w-xl">
      <p className="text-xs uppercase tracking-wider text-gray-400 text-center mb-3">
        Пока сайт недоступен — свяжитесь напрямую
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {items.map((it) => (
          <li key={it.key}>
            <a
              href={it.href}
              target={it.href.startsWith("http") ? "_blank" : undefined}
              rel={it.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 hover:border-brand-yellow hover:bg-brand-yellow/10 transition-colors px-4 py-2 text-sm text-gray-800"
            >
              <span className="text-gray-500">{it.icon}</span>
              <span>{it.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
