"use client"

import { FileText } from "lucide-react"
import PagesManagementTabs from "@/components/pages-management-tabs"

export default function PagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-brand-yellow/30">
          <FileText className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Управление страницами</h1>
          <p className="text-sm text-gray-500">
            Настройка контента сайта: баннеры, блоки, карточки и информация в подвале
          </p>
        </div>
      </div>
      <PagesManagementTabs />
    </div>
  )
}
