"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import AdminLoading from "@/components/admin-loading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Save, Edit, Instagram, MessageCircle, Phone, Mail, MapPin, Clock,
  Building2, ArrowUp, ArrowDown, Eye, Landmark, EyeOff,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { FooterLayout } from "./footer"
import type { FooterSettings as PublicFooterSettings } from "@/app/actions/public"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
const CARD_CLASS =
  "rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"

// ─── Типы ───────────────────────────────────────────────────────────────
interface FooterSettings {
  description: string
  instagram_url: string
  whatsapp_url: string
  telegram_url: string
  phone: string
  email: string
  address: string
  working_hours: string
  // Юр. реквизиты. Полный блок — на /requisites, а эти три строки
  // выводятся кратко в самом подвале (под описанием компании).
  legal_name: string
  bin_number: string
  legal_address: string
  bank_name: string
  bank_bic: string
  bank_iik: string
  bank_kbe: string
  // Порядок колонок. null = дефолт.
  contacts_order: string[] | null
  info_order: string[] | null
}

const EMPTY_SETTINGS: FooterSettings = {
  description: "", instagram_url: "", whatsapp_url: "", telegram_url: "",
  phone: "", email: "", address: "", working_hours: "",
  legal_name: "", bin_number: "", legal_address: "",
  bank_name: "", bank_bic: "", bank_iik: "", bank_kbe: "",
  contacts_order: null, info_order: null,
}

// ─── Метаданные колонок подвала ────────────────────────────────────────
// Ключ → подпись (для админки/превью). Совпадает с теми же наборами в
// components/footer.tsx.
const CONTACT_META: Record<string, string> = {
  address: "Адрес",
  working_hours: "Время работы",
  phone: "Телефон",
  email: "Почта",
}
const CONTACTS_ALL: string[] = ["address", "working_hours", "phone", "email"]

const INFO_META: Record<string, string> = {
  "pay-delivery": "Оплата и доставка",
  "about": "О компании",
  "help": "Помощь",
  "return": "Возврат и обмен",
  "offer": "Публичная оферта",
  "privacy": "Политика конфиденциальности",
  "requisites": "Реквизиты",
}
const INFO_ALL: string[] = [
  "pay-delivery", "about", "help", "return", "offer", "privacy", "requisites",
]

// ─── Reorder-блок (общий для «Контакты» и «Информация») ─────────────────
interface OrderEditorProps {
  title: string
  all: string[]
  meta: Record<string, string>
  value: string[]
  onChange: (next: string[]) => void
  disabled: boolean
}

function OrderEditor({ title, all, meta, value, onChange, disabled }: OrderEditorProps) {
  // Разделяем на видимые (в value, в их порядке) и скрытые (которых нет в value).
  const visible = value.filter((k) => all.includes(k))
  const hidden = all.filter((k) => !visible.includes(k))

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= visible.length) return
    const next = [...visible]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }
  const show = (k: string) => onChange([...visible, k])
  const hide = (k: string) => onChange(visible.filter((x) => x !== k))

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{title}</div>
      <div className="space-y-1">
        {visible.map((k, i) => (
          <div
            key={k}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5"
          >
            <span className="flex-1 text-sm">{meta[k] ?? k}</span>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => move(i, -1)} disabled={disabled || i === 0}
              title="Выше"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => move(i, +1)} disabled={disabled || i === visible.length - 1}
              title="Ниже"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-600"
              onClick={() => hide(k)} disabled={disabled}
              title="Скрыть из подвала"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-gray-500 italic">Нет видимых пунктов — колонка пустая.</p>
        )}
      </div>

      {hidden.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <div className="text-[11px] font-medium text-gray-500 mb-1">Скрытые:</div>
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((k) => (
              <Button
                key={k}
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs rounded-md"
                onClick={() => show(k)}
                disabled={disabled}
              >
                <Eye className="h-3 w-3 mr-1" />
                {meta[k] ?? k}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Превью подвала использует тот же layout, что отрисовывается на сайте —
// см. `FooterLayout` в components/footer.tsx. Админ видит ровно то, что
// увидят посетители, со всеми стилями, логотипом и соцсетями.

// ─── Основной таб ──────────────────────────────────────────────────────
export default function FooterInfoTab() {
  const [settings, setSettings] = useState<FooterSettings>(EMPTY_SETTINGS)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadFooterSettings()
  }, [])

  const loadFooterSettings = async () => {
    setIsLoading(true)
    try {
      const data = await apiClient.get<Partial<FooterSettings>>("/api/footer-settings")
      setSettings({ ...EMPTY_SETTINGS, ...data })
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
      await apiClient.put("/api/footer-settings", settings)
      toast({ title: "Успешно", description: "Настройки подвала сохранены" })
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

  const upd = <K extends keyof FooterSettings>(f: K, v: FooterSettings[K]) =>
    setSettings((prev) => ({ ...prev, [f]: v }))

  const handleCancel = () => {
    setIsEditing(false)
    loadFooterSettings()
  }

  if (isLoading) {
    return <AdminLoading text="Загрузка настроек..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Информация в подвале</h3>
          <p className="text-sm text-muted-foreground">
            Контакты, соцсети, реквизиты и порядок пунктов в колонках подвала.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className={SECONDARY_BTN}
            title="Увидеть, как подвал будет выглядеть на сайте"
          >
            <Eye className="h-4 w-4 mr-2" />
            Предпросмотр
          </Button>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving} className={SECONDARY_BTN}>
                Отменить
              </Button>
              <Button onClick={saveFooterSettings} disabled={isSaving} className={PRIMARY_BTN}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className={PRIMARY_BTN}>
              <Edit className="h-4 w-4 mr-2" />
              Редактировать
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* О компании */}
        <Card className={CARD_CLASS}>
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
                  onChange={(e) => upd("description", e.target.value)}
                  placeholder="Введите описание компании"
                  rows={3}
                  className={SOFT_CONTROL}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {settings.description || "Описание не указано"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Социальные сети */}
        <Card className={CARD_CLASS}>
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
                  <Input id="instagram" value={settings.instagram_url}
                    onChange={(e) => upd("instagram_url", e.target.value)}
                    placeholder="https://instagram.com/company" className={SOFT_CONTROL} />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.instagram_url || "Не указано"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                {isEditing ? (
                  <Input id="whatsapp" value={settings.whatsapp_url}
                    onChange={(e) => upd("whatsapp_url", e.target.value)}
                    placeholder="https://wa.me/77771234567" className={SOFT_CONTROL} />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.whatsapp_url || "Не указано"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram</Label>
                {isEditing ? (
                  <Input id="telegram" value={settings.telegram_url}
                    onChange={(e) => upd("telegram_url", e.target.value)}
                    placeholder="https://t.me/company" className={SOFT_CONTROL} />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.telegram_url || "Не указано"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Контактная информация */}
        <Card className={CARD_CLASS}>
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Адрес
                  </Label>
                  {isEditing ? (
                    <Input id="address" value={settings.address}
                      onChange={(e) => upd("address", e.target.value)}
                      placeholder="г. Астана, ул. Ильяса Омарова, 2/1" className={SOFT_CONTROL} />
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
                    <Input id="working_hours" value={settings.working_hours}
                      onChange={(e) => upd("working_hours", e.target.value)}
                      placeholder="Пн-Пт 10:00-18:00" className={SOFT_CONTROL} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.working_hours || "Не указано"}</p>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Телефон
                  </Label>
                  {isEditing ? (
                    <Input id="phone" value={settings.phone}
                      onChange={(e) => upd("phone", e.target.value)}
                      placeholder="+7 (700) 950-99-13" className={SOFT_CONTROL} />
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
                    <Input id="email" type="email" value={settings.email}
                      onChange={(e) => upd("email", e.target.value)}
                      placeholder="info@pospro.kz" className={SOFT_CONTROL} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.email || "Не указано"}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Юр.реквизиты */}
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                <Building2 className="h-4 w-4 text-yellow-700" />
              </div>
              Юридические реквизиты
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Юрлицо + БИН + адрес выводятся кратко в подвале под описанием компании.
              Полный блок (банк, БИК, ИИК, Кбе) показывается на отдельной странице{" "}
              <code className="text-[11px] bg-gray-100 px-1 rounded">/requisites</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Наименование (ТОО/ИП/ТОВ)</Label>
                {isEditing ? (
                  <Input value={settings.legal_name}
                    onChange={(e) => upd("legal_name", e.target.value)}
                    placeholder="ТОО «PPD Company»" className={SOFT_CONTROL} />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.legal_name || "Не указано"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>БИН</Label>
                {isEditing ? (
                  <Input value={settings.bin_number}
                    onChange={(e) => upd("bin_number", e.target.value)}
                    placeholder="200840016521" className={SOFT_CONTROL} />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.bin_number || "Не указано"}</p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Юридический адрес</Label>
                {isEditing ? (
                  <Input value={settings.legal_address}
                    onChange={(e) => upd("legal_address", e.target.value)}
                    placeholder="Республика Казахстан, 010000, г. Астана, …" className={SOFT_CONTROL} />
                ) : (
                  <p className="text-sm text-muted-foreground">{settings.legal_address || "Не указано"}</p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Банковские реквизиты (для /requisites)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Банк</Label>
                  {isEditing ? (
                    <Input value={settings.bank_name}
                      onChange={(e) => upd("bank_name", e.target.value)}
                      placeholder="АО «Народный Банк Казахстана»" className={SOFT_CONTROL} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.bank_name || "Не указано"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>БИК</Label>
                  {isEditing ? (
                    <Input value={settings.bank_bic}
                      onChange={(e) => upd("bank_bic", e.target.value)}
                      placeholder="HSBKKZKX" className={SOFT_CONTROL} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.bank_bic || "Не указано"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>ИИК</Label>
                  {isEditing ? (
                    <Input value={settings.bank_iik}
                      onChange={(e) => upd("bank_iik", e.target.value)}
                      placeholder="KZ..." className={SOFT_CONTROL} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.bank_iik || "Не указано"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Кбе</Label>
                  {isEditing ? (
                    <Input value={settings.bank_kbe}
                      onChange={(e) => upd("bank_kbe", e.target.value)}
                      placeholder="17" className={SOFT_CONTROL} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{settings.bank_kbe || "Не указано"}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Порядок пунктов в колонках подвала */}
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <div className="p-2 bg-slate-100 rounded-lg mr-3">
                <ArrowUp className="h-4 w-4 text-slate-700" />
              </div>
              Порядок пунктов в колонках
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Переставь стрелками, спрячь ненужное. Пустой порядок — используется дефолтный.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OrderEditor
              title="Контакты"
              all={CONTACTS_ALL}
              meta={CONTACT_META}
              value={settings.contacts_order?.length ? settings.contacts_order : CONTACTS_ALL}
              onChange={(next) => upd("contacts_order", next)}
              disabled={!isEditing}
            />
            <OrderEditor
              title="Информация"
              all={INFO_ALL}
              meta={INFO_META}
              value={settings.info_order?.length ? settings.info_order : INFO_ALL}
              onChange={(next) => upd("info_order", next)}
              disabled={!isEditing}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        {/* 90% ширины экрана, фиксируем оверхлоу по вертикали — подвал
            в полный ширину содержит всю информацию и соцсети как на сайте. */}
        <DialogContent className="w-[90vw] max-w-[90vw] max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Предпросмотр подвала</DialogTitle>
          </DialogHeader>
          {/* Чтобы контейнер подвала не был зажат padding'ом карточки диалога
              — отрицательный margin на длину padding'а. */}
          <div className="-mx-6">
            <FooterLayout settings={settings as unknown as PublicFooterSettings} />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 px-1">
            Превью показывает текущие несохранённые данные. На сайте пункты и порядок
            применятся после «Сохранить».
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
