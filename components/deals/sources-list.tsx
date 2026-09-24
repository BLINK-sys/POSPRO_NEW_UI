"use client"

/**
 * Список ingest-источников (Веб хуки) на /admin/webhooks.
 *
 * Показывает две ветки:
 *  - Webhook — внешние сайты/лендинги, у каждого свой URL с токеном
 *  - Internal — внутренние триггеры (order/price_request), крючки на бэке
 *
 * Клик по «Создать хук» → sources-builder.tsx (модалка-визард).
 * Клик по строке → редактирование (тот же визард с pre-fill).
 * Кнопка «URL» — копирует ссылку в буфер. «Тест» — dry-run.
 * Ротация токена — с confirm.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Plus,
  Copy,
  Beaker,
  Trash2,
  RotateCw,
  Circle,
  Zap,
  Webhook,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { crmGet, crmPost, crmDelete } from "@/lib/crm-fetch"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type {
  CrmIngestSource,
  CrmSourcesListResponse,
  CrmSourceDetailResponse,
} from "@/lib/crm-sources-types"

import SourceBuilder from "./sources-builder"
import SourceTestDialog from "./sources-test-dialog"

export default function SourcesList() {
  const router = useRouter()
  const { toast } = useToast()

  const [sources, setSources] = useState<CrmIngestSource[]>([])
  const [loading, setLoading] = useState(true)

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editing, setEditing] = useState<CrmIngestSource | null>(null)

  const [testing, setTesting] = useState<CrmIngestSource | null>(null)

  const [rotateTarget, setRotateTarget] = useState<CrmIngestSource | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrmIngestSource | null>(null)

  const load = () => {
    setLoading(true)
    crmGet<CrmSourcesListResponse>("/api/admin/crm-sources")
      .then((res) => setSources(res.sources || []))
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить источники",
          description: e?.message,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const [webhooks, internals] = useMemo(() => {
    const w: CrmIngestSource[] = []
    const i: CrmIngestSource[] = []
    for (const s of sources) {
      if (s.kind === "webhook") w.push(s)
      else i.push(s)
    }
    return [w, i]
  }, [sources])

  // Открытие для редактирования — нужен full source с token'ом.
  const openEditor = async (s?: CrmIngestSource) => {
    if (!s) {
      setEditing(null)
      setBuilderOpen(true)
      return
    }
    try {
      const res = await crmGet<CrmSourceDetailResponse>(
        `/api/admin/crm-sources/${s.id}`,
      )
      setEditing(res.source)
      setBuilderOpen(true)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось открыть источник",
        description: e?.message,
      })
    }
  }

  const buildWebhookUrl = (token: string | null | undefined) => {
    if (!token) return ""
    // Прод-URL. Если понадобится dev/staging — потом заведём через env.
    return `https://pospro-new-server.onrender.com/api/webhooks/crm/ingest/${token}`
  }

  const handleCopyUrl = async (s: CrmIngestSource) => {
    try {
      const detail = await crmGet<CrmSourceDetailResponse>(
        `/api/admin/crm-sources/${s.id}`,
      )
      const url = buildWebhookUrl(detail.source.token)
      await navigator.clipboard.writeText(url)
      toast({ title: "URL скопирован", description: url })
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось скопировать",
        description: e?.message,
      })
    }
  }

  const handleRotate = async () => {
    if (!rotateTarget) return
    try {
      const res = await crmPost<CrmSourceDetailResponse>(
        `/api/admin/crm-sources/${rotateTarget.id}/rotate-token`,
      )
      toast({
        title: "Токен перегенерирован",
        description: "Старый URL больше не работает",
      })
      setRotateTarget(null)
      load()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось перегенерить",
        description: e?.message,
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await crmDelete(`/api/admin/crm-sources/${deleteTarget.id}`)
      toast({ title: "Источник удалён" })
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось удалить",
        description: e?.message,
      })
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
            <Webhook className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">
              Источники сделок
            </h1>
            <p className="text-sm text-gray-500">
              Правила автосоздания сделок из заявок сайта и внешних webhook'ов
            </p>
          </div>
        </div>
        <Button
          onClick={() => openEditor()}
          className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)]"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Создать хук
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Webhook источники */}
          <Section
            title="Внешние webhook'и"
            hint="Приходят на публичный URL с токеном. Приклеиваются к внешним сервисам (лендинги, формы Tilda, интеграции)."
          >
            {webhooks.length === 0 ? (
              <EmptyBlock text="Пока ни одного webhook'а — создайте первый" />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {webhooks.map((s) => (
                  <SourceRow
                    key={s.id}
                    s={s}
                    onOpen={() => openEditor(s)}
                    onCopyUrl={() => handleCopyUrl(s)}
                    onTest={() => setTesting(s)}
                    onRotate={() => setRotateTarget(s)}
                    onDelete={() => setDeleteTarget(s)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Internal источники */}
          <Section
            title="Внутренние триггеры"
            hint="Крючки на бэке ловят события с сайта и создают сделки. `order` — заказы через форму, `price_request` — уточнения цены. Правило можно выключить, тогда crm не будет создавать сделки для этого события."
          >
            {internals.length === 0 ? (
              <EmptyBlock text="Внутренних правил нет" />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {internals.map((s) => (
                  <SourceRow
                    key={s.id}
                    s={s}
                    onOpen={() => openEditor(s)}
                    onTest={() => setTesting(s)}
                    onDelete={() => setDeleteTarget(s)}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Builder-модалка */}
      <SourceBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initial={editing}
        onSaved={() => {
          setBuilderOpen(false)
          setEditing(null)
          load()
        }}
      />

      {/* Test-модалка */}
      {testing && (
        <SourceTestDialog
          source={testing}
          open={Boolean(testing)}
          onOpenChange={(v) => !v && setTesting(null)}
        />
      )}

      {/* Confirm-модалки */}
      <AlertDialog
        open={Boolean(rotateTarget)}
        onOpenChange={(v) => !v && setRotateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перегенерировать токен?</AlertDialogTitle>
            <AlertDialogDescription>
              Старый URL{" "}
              <strong>сразу перестанет работать</strong> — внешний сервис нужно
              будет переконфигурировать на новый URL. Действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRotate}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              Перегенерировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить источник?</AlertDialogTitle>
            <AlertDialogDescription>
              Источник «{deleteTarget?.name}» перестанет ловить события.
              Существующие сделки, созданные через него, остаются.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {hint && <p className="text-xs text-gray-500 -mt-1">{hint}</p>}
      {children}
    </section>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <Card className="rounded-xl border-dashed border-gray-300 bg-gray-50/50 p-8 text-center text-sm text-gray-500">
      {text}
    </Card>
  )
}

function SourceRow({
  s,
  onOpen,
  onCopyUrl,
  onTest,
  onRotate,
  onDelete,
}: {
  s: CrmIngestSource
  onOpen: () => void
  onCopyUrl?: () => void
  onTest: () => void
  onRotate?: () => void
  onDelete: () => void
}) {
  const lastUsed = s.last_used_at
    ? new Date(s.last_used_at).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "не использовался"

  const strategyLabel: Record<string, string> = {
    round_robin: "по кругу",
    least_busy: "наименее загруженный",
    fixed: "фиксированный",
    unassigned: "без ответственного",
  }[s.assignment_strategy] as any

  return (
    <Card
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-4",
        "transition-all hover:shadow-[0_4px_10px_rgba(0,0,0,0.06)] hover:-translate-y-[1px]",
        !s.active && "opacity-60",
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-1 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base truncate">{s.name}</h3>
            <StatusDot active={s.active} />
            {s.kind === "internal" && s.source_key && (
              <span className="text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 font-mono">
                {s.source_key}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 space-x-2">
            <span>Стратегия: {strategyLabel}</span>
            <span>·</span>
            <span>Использований: {s.request_count}</span>
            <span>·</span>
            <span>Последний: {lastUsed}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onCopyUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyUrl}
              className="rounded-lg"
              title="Скопировать URL"
            >
              <Copy className="h-4 w-4 mr-1" /> URL
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onTest}
            className="rounded-lg"
            title="Тестовый вызов"
          >
            <Beaker className="h-4 w-4 mr-1" /> Тест
          </Button>
          {onRotate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRotate}
              className="rounded-full text-amber-600 hover:bg-amber-50"
              title="Перегенерить токен"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="rounded-full text-red-500 hover:bg-red-50"
            title="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full shrink-0",
        active ? "bg-emerald-500" : "bg-gray-300",
      )}
      title={active ? "активен" : "выключен"}
    />
  )
}
