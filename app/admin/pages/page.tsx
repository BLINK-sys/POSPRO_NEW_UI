"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import PagesManagementTabs from "@/components/pages-management-tabs"

export default function PagesPage() {
  return (
    <div className="container mx-auto py-6">
      <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle>Управление страницами</CardTitle>
          <CardDescription>Настройка контента сайта: баннеры, блоки, карточки и информация в подвале</CardDescription>
        </CardHeader>
        <CardContent>
          <PagesManagementTabs />
        </CardContent>
      </Card>
    </div>
  )
}
