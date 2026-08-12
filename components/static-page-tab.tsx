"use client"

/**
 * Универсальный админ-таб для статической страницы сайта.
 * Три обёртки под каждый slug: `PayDeliveryTab`, `AboutTab`, `HelpTab`.
 *
 * Модель `StaticPage` на бэке — одна на slug (server actions в
 * `app/actions/static-pages.ts`). Контент = HTML от TipTap
 * (`RichPageEditor` — картинки/таблицы/YouTube/callout/выравнивание).
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Save, Loader2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import AdminLoading from "@/components/admin-loading"
import { PageBuilder } from "@/components/page-builder/page-builder"
import {
  getStaticPage,
  saveStaticPage,
  type StaticPage,
} from "@/app/actions/static-pages"

const SOFT_INPUT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)]"
const CARD_CLASS =
  "rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"

interface StaticPageTabProps {
  slug: string
  defaultTitle: string
  publicPath: string   // напр. "/pay-delivery"
  cardTitle: string    // напр. "Оплата и доставка"
  placeholder?: string // подсказка в редакторе
}

export function StaticPageTab({
  slug, defaultTitle, publicPath, cardTitle, placeholder,
}: StaticPageTabProps) {
  const { toast } = useToast()
  const [page, setPage] = useState<StaticPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const p = await getStaticPage(slug)
      setPage(p ?? {
        slug,
        title: defaultTitle,
        content: "",
        is_active: true,
      })
      setLoading(false)
    })()
  }, [slug, defaultTitle])

  const handleSave = async () => {
    if (!page) return
    setSaving(true)
    const res = await saveStaticPage(slug, {
      title: page.title,
      content: page.content,
      is_active: page.is_active,
    })
    setSaving(false)
    if (res.success) {
      toast({ title: "Сохранено", description: "Страница обновлена" })
    } else {
      toast({ title: "Ошибка", description: res.error, variant: "destructive" })
    }
  }

  if (loading || !page) return <AdminLoading />

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <CardTitle className="text-lg">{cardTitle}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Публичная страница <code className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded">{publicPath}</code>
              {" — редактор поддерживает картинки, таблицы, YouTube, callout-блоки и выравнивание."}
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <Switch
              checked={page.is_active}
              onCheckedChange={(v) => setPage({ ...page, is_active: v })}
            />
            <span>{page.is_active ? "Опубликована" : "Скрыта"}</span>
          </label>

          <Link
            href={publicPath}
            target="_blank"
            className="text-xs text-gray-500 hover:text-black inline-flex items-center gap-1"
            title="Открыть страницу в новой вкладке"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Открыть
          </Link>

          <Button onClick={handleSave} disabled={saving} size="sm" className={PRIMARY_BTN}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Save className="h-4 w-4 mr-1.5" /> Сохранить</>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-gray-500 mb-1.5 block">
            Заголовок страницы (H1)
          </Label>
          <Input
            value={page.title}
            onChange={(e) => setPage({ ...page, title: e.target.value })}
            placeholder={defaultTitle}
            maxLength={200}
            className={SOFT_INPUT}
          />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-gray-500 mb-1.5 block">
            Блоки страницы
          </Label>
          <PageBuilder
            value={page.content}
            onChange={(json) => setPage({ ...page, content: json })}
            slug={slug}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Тонкие обёртки под каждый slug ─────────────────────────────────────

export function PayDeliveryTab() {
  return (
    <StaticPageTab
      slug="pay-delivery"
      defaultTitle="Оплата и доставка"
      cardTitle="Оплата и доставка"
      publicPath="/pay-delivery"
      placeholder="Опишите способы оплаты, условия и сроки доставки, регионы и т.п."
    />
  )
}

export function AboutTab() {
  return (
    <StaticPageTab
      slug="about"
      defaultTitle="О компании"
      cardTitle="О компании"
      publicPath="/about"
      placeholder="Расскажите о компании: история, миссия, команда, партнёры."
    />
  )
}

export function HelpTab() {
  return (
    <StaticPageTab
      slug="help"
      defaultTitle="Помощь"
      cardTitle="Помощь"
      publicPath="/help"
      placeholder="FAQ, инструкции, гарантии, возврат."
    />
  )
}
