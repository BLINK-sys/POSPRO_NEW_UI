"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
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
      <footer className="bg-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
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
    <footer className="bg-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      {/* Основной контент футера */}
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Левая колонка - Логотип и социальные сети */}
          <div className="space-y-6">
            {/* Логотип */}
            <div className="flex items-center">
              <Image
                src="/ui/big_logo.png"
                alt="PosPro Logo"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </div>
            
            {/* Описание */}
            <p className="text-gray-700 text-sm leading-relaxed">
              {footerSettings.description}
            </p>
            
            {/* Социальные сети */}
            <div className="flex gap-3">
              {footerSettings.whatsapp_url && footerSettings.whatsapp_url !== "#" && (
                <Link 
                  href={footerSettings.whatsapp_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-[50px] h-[50px] hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300 ease-in-out rounded-full overflow-hidden"
                >
                  <Image
                    src="/ui/Whatsapp.png"
                    alt="WhatsApp"
                    width={50}
                    height={50}
                    className="w-[50px] h-[50px] shadow-md hover:shadow-xl transition-shadow duration-300"
                  />
                </Link>
              )}
              
              {footerSettings.instagram_url && footerSettings.instagram_url !== "#" && (
                <Link 
                  href={footerSettings.instagram_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-[50px] h-[50px] hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300 ease-in-out rounded-full overflow-hidden"
                >
                  <Image
                    src="/ui/Instagram.png"
                    alt="Instagram"
                    width={50}
                    height={50}
                    className="w-[50px] h-[50px] shadow-md hover:shadow-xl transition-shadow duration-300"
                  />
                </Link>
              )}
              
              {footerSettings.telegram_url && footerSettings.telegram_url !== "#" && (
                <Link 
                  href={footerSettings.telegram_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-[50px] h-[50px] hover:opacity-80 hover:scale-110 hover:shadow-lg transition-all duration-300 ease-in-out rounded-full overflow-hidden"
                >
                  <Image
                    src="/ui/Telegram.png"
                    alt="Telegram"
                    width={50}
                    height={50}
                    className="w-[50px] h-[50px] shadow-md hover:shadow-xl transition-shadow duration-300"
                  />
                </Link>
              )}
            </div>
          </div>

          {/* Средняя колонка - Информация */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-black">Информация</h3>
            <nav className="space-y-2">
              <Link href="/about" className="block text-gray-600 hover:text-brand-yellow transition-colors">
                О нас
              </Link>
              <Link href="/delivery" className="block text-gray-600 hover:text-brand-yellow transition-colors">
                Доставка и оплата
              </Link>
              <Link href="/returns" className="block text-gray-600 hover:text-brand-yellow transition-colors">
                Политика возврата
              </Link>
              <Link href="/faq" className="block text-gray-600 hover:text-brand-yellow transition-colors">
                FAQ
              </Link>
            </nav>
          </div>

          {/* Правая колонка - Контакты */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-black">Контакты</h3>
            <div className="space-y-2 text-sm">
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
        </div>
        
        {/* Копирайт внутри серой области */}
        <div className="border-t border-gray-200 mt-8 pt-6">
          <div className="flex items-center justify-between">
            <Image
              src="/ui/Logo.png"
              alt="PosPro"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <span className="text-gray-500 text-sm text-center flex-1">
              2025 © PosPro. Все права защищены.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}