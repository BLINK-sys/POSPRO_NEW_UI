"use client"

/**
 * /posprodesk — публичная страница приложения «PosPro Desk».
 *
 * Объясняет клиенту зачем эта программа нужна (удалённая поддержка от
 * сотрудников PosPro), как работает (WebRTC P2P, 9-значный код, явное
 * подтверждение клиентом), и даёт скачать установочный файл или
 * портативную версию.
 *
 * Доступна **всем** — авторизация не нужна. Кнопка ведёт сюда из шапки.
 */

import { useState } from "react"
import {
  MonitorSmartphone,
  Download,
  Shield,
  Zap,
  Lock,
  Eye,
  FileText,
  PackageOpen,
  CheckCircle2,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_BASE_URL } from "@/lib/api-address"

const POSPRO_DESK_VERSION = "0.1.0"
const POSPRO_DESK_PORTABLE_URL = `${API_BASE_URL}/uploads/posprodesk/PosPro-Desk-${POSPRO_DESK_VERSION}-portable.exe`
const POSPRO_DESK_INSTALLER_URL = `${API_BASE_URL}/uploads/posprodesk/PosPro-Desk-Setup-${POSPRO_DESK_VERSION}.exe`
const POSPRO_DESK_FILE_SIZE_MB = 71

export default function PosProDeskPage() {
  const [activeStep, setActiveStep] = useState<number | null>(null)

  const scrollToVersions = () => {
    const el = document.getElementById("versions")
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-brand-yellow blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-yellow-400 blur-3xl" />
        </div>
        <div className="relative container mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-brand-yellow border-4 border-yellow-500 shadow-[0_8px_32px_rgba(250,204,21,0.40)] mb-6">
              <MonitorSmartphone className="h-10 w-10 text-black" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              PosPro <span className="text-brand-yellow">Desk</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-2">
              Приложение удалённой поддержки от сотрудников PosPro
            </p>
            <p className="text-sm text-gray-400">
              Версия {POSPRO_DESK_VERSION} · Windows 10/11 · ~{POSPRO_DESK_FILE_SIZE_MB} MB
            </p>

            <div className="mt-8 flex items-center justify-center">
              <Button
                onClick={scrollToVersions}
                className="bg-brand-yellow text-black hover:bg-yellow-400 rounded-full shadow-lg hover:shadow-xl transition-all px-8 py-6 text-base font-semibold"
              >
                <Download className="h-5 w-5 mr-2" />
                Скачать
              </Button>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Без регистрации · Без подписки · Без рекламы
            </p>
          </div>
        </div>
      </section>

      {/* Что это */}
      <section className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 text-center">
            Что это и зачем нужно
          </h2>
          <p className="text-base text-gray-700 leading-relaxed mb-6 text-center">
            <b>PosPro Desk</b> — это аналог TeamViewer/AnyDesk, который мы сделали сами специально
            для наших клиентов. Программа позволяет нашему сотруднику подключиться к вашему
            компьютеру и:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: MonitorSmartphone, text: "Видеть ваш экран в реальном времени" },
              { icon: Eye, text: "Помочь разобраться с настройкой оборудования" },
              { icon: FileText, text: "Передать вам нужные драйверы и файлы" },
              { icon: Zap, text: "Быстро решить вопрос без выезда мастера" },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-sm"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-yellow-50 border border-yellow-200 shrink-0">
                  <f.icon className="h-5 w-5 text-yellow-700" />
                </div>
                <div className="text-sm text-gray-800 leading-relaxed pt-1.5">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как работает */}
      <section className="bg-white border-y border-gray-200 py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 text-center">
              Как работает
            </h2>
            <p className="text-center text-gray-500 mb-10 text-sm">
              Никаких регистраций. Просто 4 простых шага.
            </p>

            <div className="grid md:grid-cols-4 gap-4">
              {[
                {
                  num: 1,
                  title: "Скачайте и запустите",
                  text: "Нажмите кнопку «Скачать» вверху страницы и запустите файл.",
                },
                {
                  num: 2,
                  title: "Получите код",
                  text: "Приложение покажет 9-значный код. Назовите его сотруднику по телефону.",
                },
                {
                  num: 3,
                  title: "Подтвердите подключение",
                  text: "Когда сотрудник введёт код, у вас всплывёт окно «Разрешить». Нажмите.",
                },
                {
                  num: 4,
                  title: "Готово",
                  text: "Сотрудник видит ваш экран. Можете спокойно следить или закрыть приложение в любой момент.",
                },
              ].map((s) => (
                <div
                  key={s.num}
                  onMouseEnter={() => setActiveStep(s.num)}
                  onMouseLeave={() => setActiveStep(null)}
                  className={`relative rounded-2xl border-2 p-5 transition-all flex flex-col items-center text-center ${
                    activeStep === s.num
                      ? "border-brand-yellow shadow-lg bg-yellow-50/50 -translate-y-1"
                      : "border-gray-200 bg-white shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-full bg-brand-yellow text-black font-bold text-base shadow-sm mb-3">
                    {s.num}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{s.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Безопасность */}
      <section className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">
            Это безопасно
          </h2>

          <div className="space-y-3">
            {[
              {
                icon: Shield,
                title: "Каждое подключение требует вашего разрешения",
                text: "Никто не может подключиться к вам без явного нажатия кнопки «Разрешить» в окне приложения. Сотрудник по телефону скажет код, который видите только вы — никакой ссылки или удалённого «взлома».",
              },
              {
                icon: Lock,
                title: "Прямое P2P-соединение, без посредников",
                text: "Передача экрана идёт напрямую между нашим сотрудником и вами по WebRTC. Никто третий не может вмешаться или подслушать.",
              },
              {
                icon: CheckCircle2,
                title: "Полный контроль у вас",
                text: "Вы можете в любой момент закрыть приложение и сеанс прервётся.",
              },
              {
                icon: Info,
                title: "Откроется только когда нужно",
                text: "Приложение не работает в фоне. Вы запускаете его только когда обращаетесь за поддержкой, потом закрываете. Никакого автозапуска.",
              },
            ].map((b, i) => (
              <div
                key={i}
                className="flex gap-4 p-5 rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 shrink-0">
                  <b.icon className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{b.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Какая версия нужна */}
      <section id="versions" className="bg-white border-t border-gray-200 py-12 md:py-16 scroll-mt-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">
              Какую версию выбрать
            </h2>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Установщик */}
              <div className="rounded-2xl border-2 border-brand-yellow bg-yellow-50/60 p-6 shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-brand-yellow shadow">
                    <Download className="h-5 w-5 text-black" />
                  </div>
                  <h3 className="text-lg font-semibold">Установщик</h3>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-brand-yellow text-black">
                    Рекомендуется
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  Установится как обычная программа: появится ярлык в меню «Пуск», легко будет найти
                  и запустить когда понадобится. Можно удалить через «Установка и удаление программ».
                </p>
                <Button
                  asChild
                  className="w-full bg-brand-yellow text-black hover:bg-yellow-400 rounded-full shadow hover:shadow-md transition-all font-semibold"
                >
                  <a href={POSPRO_DESK_INSTALLER_URL} download>
                    <Download className="h-4 w-4 mr-2" />
                    Скачать установщик
                  </a>
                </Button>
                <p className="mt-3 text-[11px] text-gray-500 text-center">
                  PosPro-Desk-Setup-{POSPRO_DESK_VERSION}.exe · ~{POSPRO_DESK_FILE_SIZE_MB} MB
                </p>
              </div>

              {/* Портативная */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gray-100 border border-gray-200">
                    <PackageOpen className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="text-lg font-semibold">Портативная версия</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  Один файл — нечего устанавливать. Запускается двойным кликом. Можно положить на
                  флешку или рабочий стол. Подойдёт если нужно один раз помочь и забыть.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-full font-semibold"
                >
                  <a href={POSPRO_DESK_PORTABLE_URL} download>
                    <PackageOpen className="h-4 w-4 mr-2" />
                    Скачать портативную
                  </a>
                </Button>
                <p className="mt-3 text-[11px] text-gray-500 text-center">
                  PosPro-Desk-{POSPRO_DESK_VERSION}-portable.exe · ~{POSPRO_DESK_FILE_SIZE_MB} MB
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-8 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                Программа работает <b>только на Windows 10 и Windows 11</b>. На Linux и macOS пока
                не поддерживается. При запуске Windows может показать предупреждение «Защита Windows
                SmartScreen» — нажмите «Подробнее» → «Выполнить в любом случае».
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
