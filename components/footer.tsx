"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { MonitorSmartphone } from "lucide-react"
import { FooterSettings, getFooterSettings } from "@/app/actions/public"

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

  if (!footerSettings) {
    return null
  }
  return (
    <footer className="mt-6 bg-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      {/* Основной контент футера */}
      <div className="container mx-auto px-4 md:px-6 py-12">
        {/* Первая колонка (логотип/описание/соцсети) — ~40%, остальные 3
            прижаты к правому краю в оставшихся ~60% как единая группа. */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 items-start">
          {/* Левая колонка - Логотип и социальные сети */}
          <div className="space-y-3">
            {/* Логотип — по высоте близко к заголовкам соседних колонок */}
            <div className="flex items-center">
              <Image
                src="/ui/big_logo.png"
                alt="PosPro Logo"
                width={120}
                height={40}
                className="h-6 w-auto"
              />
            </div>

            {/* Описание */}
            <p className="text-gray-600 text-[11px] leading-relaxed">
              {footerSettings.description}
            </p>
            
            {/* Социальные сети */}
            <div className="flex gap-3">
              {footerSettings.whatsapp_url && footerSettings.whatsapp_url !== "#" && (
                <Link 
                  href={footerSettings.whatsapp_url} 
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
              
              {footerSettings.instagram_url && footerSettings.instagram_url !== "#" && (
                <Link 
                  href={footerSettings.instagram_url} 
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
              
              {footerSettings.telegram_url && footerSettings.telegram_url !== "#" && (
                <Link 
                  href={footerSettings.telegram_url} 
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

          {/* Правая область — 3 равномерные колонки */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Средняя колонка - Информация (ссылки те же, что в info-bar шапки) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-black uppercase tracking-wider">Информация</h3>
            <nav className="space-y-1.5">
              <Link href="/pay-delivery" className="block text-[11px] text-gray-600 hover:text-brand-yellow transition-colors">
                Оплата и доставка
              </Link>
              <Link href="/about" className="block text-[11px] text-gray-600 hover:text-brand-yellow transition-colors">
                О компании
              </Link>
              <Link href="/help" className="block text-[11px] text-gray-600 hover:text-brand-yellow transition-colors">
                Помощь
              </Link>
            </nav>
          </div>

          {/* Колонка - Контакты */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-black uppercase tracking-wider">Контакты</h3>
            <div className="space-y-1.5 text-[11px]">
              <div>
                <span className="font-semibold text-gray-900">Адрес:</span>
                <span className="text-gray-600 ml-2">{footerSettings.address}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">Время работы:</span>
                <span className="text-gray-600 ml-2">{footerSettings.working_hours}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">Телефон:</span>
                <span className="text-gray-600 ml-2">{footerSettings.phone}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">Почта:</span>
                <span className="text-gray-600 ml-2">{footerSettings.email}</span>
              </div>
            </div>
          </div>

          {/* Правая колонка - Удалённая поддержка (PosPro Desk).
              Видна всем типам пользователей. На мобиле этот футер вообще
              не рендерится (там MobileLayout). */}
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

        {/* Копирайт внутри серой области */}
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
              2025 © PosPro. Все права защищены.
            </span>
            {/* Пустой блок = ширина логотипа, чтобы копирайт был ровно по центру */}
            <span className="w-6" aria-hidden="true" />
          </div>
        </div>
      </div>
    </footer>
  )
}