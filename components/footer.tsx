"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { MonitorSmartphone } from "lucide-react"
import { FooterSettings, getFooterSettings } from "@/app/actions/public"

// Если юзер в админке ввёл "t.me/..." без схемы — Next.js Link трактует
// это как относительный путь и клеит с текущего домена (→ pospro.kz/t.me/...).
// Нормализуем: если нет http:// или https:// — добавляем https://.
function ensureAbsoluteUrl(url: string): string {
  const trimmed = (url || "").trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("//")) return "https:" + trimmed
  return "https://" + trimmed.replace(/^\/+/, "")
}

// ─── Колонка «Информация» ────────────────────────────────────────────────
export const INFO_LINKS: Record<string, { href: string; label: string }> = {
  "pay-delivery": { href: "/pay-delivery", label: "Оплата и доставка" },
  "about": { href: "/about", label: "О компании" },
  "help": { href: "/help", label: "Помощь" },
  "return": { href: "/return", label: "Возврат и обмен" },
  "offer": { href: "/offer", label: "Публичная оферта" },
  "privacy": { href: "/privacy", label: "Политика конфиденциальности" },
  "requisites": { href: "/requisites", label: "Реквизиты" },
}
export const INFO_DEFAULT_ORDER: string[] = [
  "pay-delivery", "about", "help", "return", "offer", "privacy", "requisites",
]

// ─── Колонка «Контакты» ─────────────────────────────────────────────────
export const CONTACT_FIELDS: Record<string, { label: string; field: keyof FooterSettings }> = {
  address: { label: "Адрес:", field: "address" },
  working_hours: { label: "Время работы:", field: "working_hours" },
  phone: { label: "Телефон:", field: "phone" },
  email: { label: "Почта:", field: "email" },
}
export const CONTACTS_DEFAULT_ORDER: string[] = [
  "address", "working_hours", "phone", "email",
]

/**
 * Чистый presentational-компонент подвала. Используется и в самом
 * `<Footer />` (где settings подгружаются с бэка), и в модалке
 * предпросмотра из админки (где в settings передаются несохранённые
 * изменения). Всё, что отличается от «боевого» подвала — только
 * отсутствие внешнего fetch'а.
 */
export function FooterLayout({ settings }: { settings: FooterSettings }) {
  const infoOrder = settings.info_order?.length
    ? settings.info_order
    : INFO_DEFAULT_ORDER
  const contactsOrder = settings.contacts_order?.length
    ? settings.contacts_order
    : CONTACTS_DEFAULT_ORDER

  const legalLineParts: string[] = []
  if (settings.legal_name) legalLineParts.push(settings.legal_name)
  if (settings.bin_number) legalLineParts.push(`БИН ${settings.bin_number}`)
  if (settings.legal_address) legalLineParts.push(settings.legal_address)
  const legalLine = legalLineParts.join(" · ")

  const copyrightName = settings.legal_name || "PosPro"
  const copyrightYear = new Date().getFullYear()

  return (
    <footer className="mt-6 bg-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 items-start">
          <div className="space-y-3">
            <div className="flex items-center">
              <Image
                src="/ui/big_logo.png"
                alt="PosPro Logo"
                width={120}
                height={40}
                className="h-6 w-auto"
              />
            </div>
            <p className="text-gray-600 text-[11px] leading-relaxed">
              {settings.description}
            </p>
            {legalLine && (
              <p className="text-gray-500 text-[11px] leading-relaxed">
                {legalLine}
              </p>
            )}
            <div className="flex gap-3">
              {settings.whatsapp_url && settings.whatsapp_url !== "#" && (
                <Link
                  href={ensureAbsoluteUrl(settings.whatsapp_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300 ease-in-out rounded-full overflow-hidden"
                >
                  <Image
                    src="/ui/Whatsapp.png"
                    alt="WhatsApp"
                    width={36}
                    height={36}
                    className="w-9 h-9 shadow-md hover:shadow-xl transition-shadow duration-300"
                  />
                </Link>
              )}
              {settings.instagram_url && settings.instagram_url !== "#" && (
                <Link
                  href={ensureAbsoluteUrl(settings.instagram_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300 ease-in-out rounded-full overflow-hidden"
                >
                  <Image
                    src="/ui/Instagram.png"
                    alt="Instagram"
                    width={36}
                    height={36}
                    className="w-9 h-9 shadow-md hover:shadow-xl transition-shadow duration-300"
                  />
                </Link>
              )}
              {settings.telegram_url && settings.telegram_url !== "#" && (
                <Link
                  href={ensureAbsoluteUrl(settings.telegram_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300 ease-in-out rounded-full overflow-hidden"
                >
                  <Image
                    src="/ui/Telegram.png"
                    alt="Telegram"
                    width={36}
                    height={36}
                    className="w-9 h-9 shadow-md hover:shadow-xl transition-shadow duration-300"
                  />
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">Информация</h3>
              <nav className="space-y-1.5">
                {infoOrder.map((key) => {
                  const link = INFO_LINKS[key]
                  if (!link) return null
                  return (
                    <Link
                      key={key}
                      href={link.href}
                      className="block text-[11px] text-gray-600 hover:text-brand-yellow transition-colors"
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">Контакты</h3>
              <div className="space-y-1.5 text-[11px]">
                {contactsOrder.map((key) => {
                  const def = CONTACT_FIELDS[key]
                  if (!def) return null
                  const value = (settings as any)[def.field] as string
                  if (!value) return null
                  return (
                    <div key={key}>
                      <span className="font-semibold text-gray-900">{def.label}</span>
                      <span className="text-gray-600 ml-2">{value}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">Удалённая поддержка</h3>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Скачайте <b>PosPro Desk</b> — наше приложение для удалённой поддержки.
              </p>
              <Link
                href="/posprodesk"
                className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-full bg-yellow-50 border-2 border-brand-yellow text-gray-800 hover:bg-brand-yellow hover:border-black hover:text-black text-xs font-medium shadow-sm hover:shadow-md transition-all duration-200"
              >
                <MonitorSmartphone className="h-4 w-4" />
                PosPro Desk
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-4">
          <div className="flex items-center justify-between">
            <Image
              src="/ui/Logo.png"
              alt="PosPro"
              width={24}
              height={24}
              className="h-6 w-auto"
            />
            <span className="text-gray-500 text-[11px] text-center flex-1">
              © {copyrightYear} {copyrightName}. Все права защищены.
            </span>
            <span className="w-6" aria-hidden="true" />
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function Footer() {
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadFooterSettings = async () => {
      try {
        const settings = await getFooterSettings()
        setFooterSettings(settings)
      } catch (error) {
        console.error("Error loading footer settings:", error)
      } finally {
        setLoading(false)
      }
    }

    loadFooterSettings()
  }, [])

  if (loading) {
    return (
      <footer className="mt-6 bg-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="container mx-auto px-4 md:px-6 py-12">
          <div className="text-center text-gray-500">Загрузка...</div>
        </div>
      </footer>
    )
  }

  if (!footerSettings) return null

  return <FooterLayout settings={footerSettings} />
}
