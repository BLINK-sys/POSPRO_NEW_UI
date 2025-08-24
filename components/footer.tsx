"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Instagram, Send, MessageCircle, Loader2 } from "lucide-react"
import { getFooterSettings, FooterSettings } from "@/app/actions/public"

export default function Footer() {
  const [settings, setSettings] = useState<FooterSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadFooterSettings = async () => {
      try {
        setLoading(true)
        const data = await getFooterSettings()
        console.log("📋 Footer settings loaded:", data)
        setSettings(data)
      } catch (error) {
        console.error("Error loading footer settings:", error)
        setSettings({
          address: "г. Алматы, ул. Достык, 105",
          working_hours: "Пн-Пт 9:00 - 18:00",
          phone: "+7 (727) 123-45-67",
          email: "support@pospro.kz",
          description: "PosPro - ваш надежный партнер в мире качественных товаров. Мы предлагаем широкий ассортимент и лучший сервис.",
          instagram_url: "",
          whatsapp_url: "",
          telegram_url: ""
        })
      } finally {
        setLoading(false)
      }
    }

    loadFooterSettings()
  }, [])

  // Проверка наличия ссылок на соцсети
  const hasSocialLinks = settings && (
    settings.instagram_url?.trim() || 
    settings.whatsapp_url?.trim() || 
    settings.telegram_url?.trim()
  )
  
  // Отладочная информация
  console.log("🔗 Social links check:", {
    hasSocialLinks,
    instagram: settings?.instagram_url,
    whatsapp: settings?.whatsapp_url,
    telegram: settings?.telegram_url
  })

  if (loading) {
    return (
      <footer className="bg-white text-black border-t">
        <div className="container mx-auto px-4 md:px-6 py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Загрузка...</span>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="bg-white text-black border-t">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Первая колонка - О компании */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center" prefetch={false}>
              <Image 
                src="/logo/Logo_PP.png" 
                alt="PosPro Logo" 
                width={60} 
                height={20}
                onError={(e) => {
                  console.error("Error loading logo:", e)
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = '<span class="text-2xl font-bold text-brand-yellow">PosPro</span>'
                  }
                }}
              />
            </Link>
            <p className="text-gray-600">
              {settings?.description || "PosPro - ваш надежный партнер в мире качественных товаров. Мы предлагаем широкий ассортимент и лучший сервис."}
            </p>
            {hasSocialLinks && (
              <div className="flex gap-4 mt-2">
                {settings?.instagram_url?.trim() && (
                  <Link href={settings.instagram_url} aria-label="Instagram">
                    <Instagram className="h-6 w-6 text-gray-500 hover:text-brand-yellow" />
                  </Link>
                )}
                {settings?.whatsapp_url?.trim() && (
                  <Link href={settings.whatsapp_url} aria-label="WhatsApp">
                    <MessageCircle className="h-6 w-6 text-gray-500 hover:text-brand-yellow" />
                  </Link>
                )}
                {settings?.telegram_url?.trim() && (
                  <Link href={settings.telegram_url} aria-label="Telegram">
                    <Send className="h-6 w-6 text-gray-500 hover:text-brand-yellow" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Вторая колонка - Контакты */}
          <div>
            <h4 className="font-bold text-lg mb-4">Контакты</h4>
            <ul className="space-y-2 text-gray-600">
              <li>Адрес: {settings?.address || "г. Алматы, ул. Достык, 105"}</li>
              <li>Время работы: {settings?.working_hours || "Пн-Пт 9:00 - 18:00"}</li>
              <li>Телефон: {settings?.phone || "+7 (727) 123-45-67"}</li>
              <li>Почта: {settings?.email || "support@pospro.kz"}</li>
            </ul>
          </div>

          {/* Третья колонка - Информация */}
          <div>
            <h4 className="font-bold text-lg mb-4">Информация</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-gray-600 hover:text-brand-yellow">
                  О нас
                </Link>
              </li>
              <li>
                <Link href="#" className="text-gray-600 hover:text-brand-yellow">
                  Доставка и оплата
                </Link>
              </li>
              <li>
                <Link href="#" className="text-gray-600 hover:text-brand-yellow">
                  Политика возврата
                </Link>
              </li>
              <li>
                <Link href="#" className="text-gray-600 hover:text-brand-yellow">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200">
        <div className="container mx-auto px-4 md:px-6 py-4 text-center text-gray-500 text-sm">
          &copy; 2025 PosPro. Все права защищены.
        </div>
      </div>
    </footer>
  )
}
