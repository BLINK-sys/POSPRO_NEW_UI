"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Save, Edit, Instagram, MessageCircle, Phone, Mail, MapPin, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"

interface FooterSettings {
  description: string
  instagram_url: string
  whatsapp_url: string
  telegram_url: string
  phone: string
  email: string
  address: string
  working_hours: string
}

export default function FooterInfoTab() {
  const [settings, setSettings] = useState<FooterSettings>({
    description: "",
    instagram_url: "",
    whatsapp_url: "",
    telegram_url: "",
    phone: "",
    email: "",
    address: "",
    working_hours: "",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  // Загрузка настроек при монтировании компонента
  useEffect(() => {
    loadFooterSettings()
  }, [])

  const loadFooterSettings = async () => {
    setIsLoading(true)
    try {
      const data = await apiClient.get<FooterSettings>("/api/footer-settings")
      setSettings(data)
    } catch (error) {
      console.error("Error loading footer settings:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки подвала",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const saveFooterSettings = async () => {
    setIsSaving(true)
    try {
      const result = await apiClient.put("/api/footer-settings", settings)
      toast({
        title: "Успешно",
        description: result.message || "Настройки подвала сохранены",
      })
      setIsEditing(false)
    } catch (error: any) {
      console.error("Error saving footer settings:", error)
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: keyof FooterSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleCancel = () => {
    setIsEditing(false)
    loadFooterSettings() // Перезагружаем данные при отмене
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Загрузка настроек...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Информация в подвале</h3>
          <p className="text-sm text-muted-foreground">Управляйте контактной информацией и ссылками в подвале сайта</p>
        </div>
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Отменить
              </Button>
              <Button onClick={saveFooterSettings} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Редактировать
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* Описание компании */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <MessageCircle className="h-4 w-4 text-blue-600" />
              </div>
              О компании
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Введите описание компании"
                  rows={3}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{settings.description || "Описание не указано"}</p>
            )}
          </CardContent>
        </Card>

        {/* Социальные сети */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <div className="p-2 bg-pink-100 rounded-lg mr-3">
                <Instagram className="h-4 w-4 text-pink-600" />
              </div>
              Социальные сети
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                {isEditing ? (
                  <Input
                    id="instagram"
                    value={settings.instagram_url}
                    onChange={(e) => handleInputChange("instagram_url", e.target.value)}
                    placeholder="https://instagram.com/company"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.instagram_url || "Не указано"}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                {isEditing ? (
                  <Input
                    id="whatsapp"
                    value={settings.whatsapp_url}
                    onChange={(e) => handleInputChange("whatsapp_url", e.target.value)}
                    placeholder="https://wa.me/77771234567"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.whatsapp_url || "Не указано"}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram</Label>
                {isEditing ? (
                  <Input
                    id="telegram"
                    value={settings.telegram_url}
                    onChange={(e) => handleInputChange("telegram_url", e.target.value)}
                    placeholder="https://t.me/company"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.telegram_url || "Не указано"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Контактная информация */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <Phone className="h-4 w-4 text-green-600" />
              </div>
              Контактная информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First column - Address and Working Hours */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Адрес
                  </Label>
                  {isEditing ? (
                    <Input
                      id="address"
                      value={settings.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      placeholder="г. Алматы, ул. Примерная, 123"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.address || "Не указано"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="working_hours" className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Часы работы
                  </Label>
                  {isEditing ? (
                    <Input
                      id="working_hours"
                      value={settings.working_hours}
                      onChange={(e) => handleInputChange("working_hours", e.target.value)}
                      placeholder="Пн-Пт: 9:00-18:00, Сб: 10:00-16:00"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.working_hours || "Не указано"}</p>
                  )}
                </div>
              </div>

              {/* Second column - Phone and Email */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Телефон
                  </Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={settings.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="+7 (777) 123-45-67"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.phone || "Не указано"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Label>
                  {isEditing ? (
                    <Input
                      id="email"
                      type="email"
                      value={settings.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="info@company.com"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.email || "Не указано"}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
