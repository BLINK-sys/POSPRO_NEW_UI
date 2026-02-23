"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CatalogVisibility {
  sidebar: boolean
  main: boolean
  slide: boolean
}

const CATALOG_ITEMS = [
  {
    key: "sidebar" as const,
    label: "Боковой каталог",
    description: "Кнопка-язычок слева и боковая панель каталога",
  },
  {
    key: "main" as const,
    label: "Основной каталог (в Header)",
    description: "Кнопка «Каталог» в шапке сайта и модальное меню категорий",
  },
  {
    key: "slide" as const,
    label: "Нижний в Header",
    description: "Выдвижная панель каталога на главной странице (только десктоп)",
  },
]

export default function CatalogVisibilityTab() {
  const [visibility, setVisibility] = useState<CatalogVisibility>({ sidebar: true, main: true, slide: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchVisibility = async () => {
      try {
        const resp = await fetch('/api/admin/catalog-visibility')
        const data = await resp.json()
        if (data.success && data.visibility) {
          setVisibility(data.visibility)
        }
      } catch (e) {
        console.error('Ошибка загрузки настроек каталогов:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchVisibility()
  }, [])

  const handleToggle = async (key: keyof CatalogVisibility, enabled: boolean) => {
    // Оптимистичное обновление
    setVisibility(prev => ({ ...prev, [key]: enabled }))
    setSaving(key)

    try {
      const resp = await fetch('/api/admin/catalog-visibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: key, enabled }),
      })
      const data = await resp.json()

      if (!data.success) {
        // Откат при ошибке
        setVisibility(prev => ({ ...prev, [key]: !enabled }))
        toast({ title: 'Ошибка', description: data.error || 'Не удалось сохранить' })
      }
    } catch (e) {
      setVisibility(prev => ({ ...prev, [key]: !enabled }))
      toast({ title: 'Ошибка', description: 'Не удалось сохранить настройки' })
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Типы каталогов</h3>
        <p className="text-sm text-gray-500 mt-1">
          Управление отображением кнопок каталогов на десктопной версии сайта
        </p>
      </div>

      {CATALOG_ITEMS.map((item) => (
        <Card key={item.key} className="border">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <Label className="text-base font-medium cursor-pointer" htmlFor={`catalog-${item.key}`}>
                {item.label}
              </Label>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
              {saving === item.key && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              <span className="text-sm text-gray-500 w-16 text-right">
                {visibility[item.key] ? "Включён" : "Выключен"}
              </span>
              <Switch
                id={`catalog-${item.key}`}
                checked={visibility[item.key]}
                onCheckedChange={(checked) => handleToggle(item.key, checked)}
                disabled={saving === item.key}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
