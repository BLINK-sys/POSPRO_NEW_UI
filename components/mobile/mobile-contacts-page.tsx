"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { MapPin, Clock, Phone, Mail, Loader2 } from "lucide-react"
import { getFooterSettings, type FooterSettings } from "@/app/actions/public"

export default function MobileContactsPage() {
  const [settings, setSettings] = useState<FooterSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getFooterSettings()
        setSettings(data)
      } catch (error) {
        console.error("Error loading contacts:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-gray-500">
        Не удалось загрузить контакты
      </div>
    )
  }

  const contactItems = [
    { icon: MapPin, label: "Адрес", value: settings.address },
    { icon: Clock, label: "Время работы", value: settings.working_hours },
    { icon: Phone, label: "Телефон", value: settings.phone, href: `tel:${settings.phone?.replace(/[^\d+]/g, "")}` },
    { icon: Mail, label: "Почта", value: settings.email, href: `mailto:${settings.email}` },
  ]

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold mb-6 text-center">Контакты</h1>

      <div className="space-y-4">
        {contactItems.map((item) => {
          if (!item.value) return null
          const Icon = item.icon

          const content = (
            <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl shadow-md">
              <div className="w-10 h-10 bg-brand-yellow rounded-full flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.value}</p>
              </div>
            </div>
          )

          if (item.href) {
            return (
              <a key={item.label} href={item.href} className="block">
                {content}
              </a>
            )
          }

          return <div key={item.label}>{content}</div>
        })}
      </div>

      {/* Соцсети */}
      {(settings.instagram_url || settings.whatsapp_url || settings.telegram_url) && (
        <div className="mt-8">
          <h2 className="text-base font-semibold mb-4 text-center">Мы в соцсетях</h2>
          <div className="flex gap-4 justify-center">
            {settings.whatsapp_url && settings.whatsapp_url !== "#" && (
              <a
                href={settings.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full overflow-hidden shadow-md hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300"
              >
                <Image src="/ui/Whatsapp.png" alt="WhatsApp" width={48} height={48} className="w-12 h-12" />
              </a>
            )}
            {settings.telegram_url && settings.telegram_url !== "#" && (
              <a
                href={settings.telegram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full overflow-hidden shadow-md hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300"
              >
                <Image src="/ui/Telegram.png" alt="Telegram" width={48} height={48} className="w-12 h-12" />
              </a>
            )}
            {settings.instagram_url && settings.instagram_url !== "#" && (
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full overflow-hidden shadow-md hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300"
              >
                <Image src="/ui/Instagram.png" alt="Instagram" width={48} height={48} className="w-12 h-12" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
