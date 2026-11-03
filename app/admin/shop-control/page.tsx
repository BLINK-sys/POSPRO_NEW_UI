"use client"

/**
 * /admin/shop-control — owner-only «Управление магазином».
 *
 * Главная кнопка — большая, с подтверждением, выключает магазин для
 * всех пользователей кроме owner (middleware ловит это и rewrite'ит
 * любую страницу на /maintenance со статусом 503). Owner для себя
 * видит всё как обычно.
 *
 * При выключении — модалка выбора «какая табличка». Можно создать
 * новую прямо из модалки.
 *
 * Снизу — CRUD для заготовок (title + body).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2, Power, PowerOff, Pencil, Trash2, Plus, Check, X,
  AlertTriangle, ShieldAlert, Clock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { crmGet, crmPost, crmPut, crmDelete } from "@/lib/crm-fetch"

// ---------- типы ----------
interface Notice {
  id: number
  title: string
  body: string
  created_at: string | null
  updated_at: string | null
}
interface SiteMode {
  is_maintenance: boolean
  notice_id: number | null
  notice: Notice | null
  started_at: string | null
  started_by_user_id: number | null
  updated_at: string | null
}

export default function ShopControlPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [mode, setMode] = useState<SiteMode | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])

  // модалки
  const [disableDialog, setDisableDialog] = useState(false)
  const [enableDialog, setEnableDialog] = useState(false)
  const [editNotice, setEditNotice] = useState<Notice | null>(null)
  const [createNoticeOpen, setCreateNoticeOpen] = useState(false)
  const [deleteNotice, setDeleteNotice] = useState<Notice | null>(null)

  const reload = useCallback(async () => {
    try {
      const [m, n] = await Promise.all([
        crmGet<SiteMode>("/api/admin/maintenance/mode"),
        crmGet<{ notices: Notice[] }>("/api/admin/maintenance/notices"),
      ])
      setMode(m)
      setNotices(n.notices)
    } catch (e: any) {
      if (String(e?.message).includes("403")) {
        setForbidden(true)
      } else {
        toast({
          variant: "destructive",
          title: "Не удалось загрузить",
          description: e?.message,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (forbidden) router.replace("/admin")
  }, [forbidden, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!mode) return null

  const isOn = mode.is_maintenance

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center h-10 w-10 rounded-full ${
          isOn ? "bg-red-100" : "bg-emerald-100"
        }`}>
          {isOn ? <PowerOff className="h-5 w-5 text-red-700" />
                : <Power className="h-5 w-5 text-emerald-700" />}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Управление магазином</h1>
          <p className="text-sm text-gray-500">
            Полное выключение сайта для всех пользователей кроме владельца
          </p>
        </div>
      </div>

      {/* Статус + большая кнопка */}
      <Card className={`rounded-xl border shadow-sm ${
        isOn ? "border-red-300 bg-red-50/50" : "border-gray-200"
      }`}>
        <CardContent className="pt-6 space-y-4">
          {isOn ? (
            <>
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-red-800">
                    Магазин сейчас ВЫКЛЮЧЕН
                  </div>
                  <div className="text-sm text-red-700 mt-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    с {fmtDateTime(mode.started_at)}
                  </div>
                  {mode.notice && (
                    <div className="mt-3 rounded-lg bg-white border border-red-200 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wider text-red-500 font-medium mb-1">
                        Показывается всем кроме вас
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {mode.notice.title}
                      </div>
                      {mode.notice.body && (
                        <div className="text-sm text-gray-700 whitespace-pre-wrap mt-1">
                          {mode.notice.body}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setEnableDialog(true)}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold"
              >
                <Power className="h-5 w-5 mr-2" />
                Включить магазин обратно
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <Power className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-emerald-800">
                    Магазин работает нормально
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Сайт доступен клиентам и сотрудникам
                  </div>
                </div>
              </div>
              <Button
                onClick={() => setDisableDialog(true)}
                className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white text-base font-semibold"
              >
                <PowerOff className="h-5 w-5 mr-2" />
                Выключить магазин
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* CRUD заготовок */}
      <Card className="rounded-xl border-gray-200">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Заготовки сообщений</CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Табличка, которую увидят все кроме вас при выключении
            </p>
          </div>
          <Button
            onClick={() => setCreateNoticeOpen(true)}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Создать
          </Button>
        </CardHeader>
        <CardContent>
          {notices.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Пока ни одной заготовки. Создайте первую — она понадобится,
              чтобы выключить магазин.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notices.map((n) => {
                const activeNow = mode.is_maintenance && mode.notice_id === n.id
                return (
                  <li key={n.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-gray-900">
                          {n.title}
                        </div>
                        {activeNow && (
                          <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            активна сейчас
                          </span>
                        )}
                      </div>
                      {n.body && (
                        <div className="text-sm text-gray-600 whitespace-pre-wrap mt-1">
                          {n.body}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditNotice(n)}
                        className="rounded-full h-8 w-8 text-gray-500 hover:text-gray-900"
                        title="Редактировать"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteNotice(n)}
                        className="rounded-full h-8 w-8 text-red-500 hover:bg-red-50"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Модалка выбора заготовки для выключения */}
      <DisableDialog
        open={disableDialog}
        onOpenChange={setDisableDialog}
        notices={notices}
        onCreateNew={() => { setDisableDialog(false); setCreateNoticeOpen(true) }}
        onConfirm={async (noticeId) => {
          try {
            await crmPost("/api/admin/maintenance/mode/enable", { notice_id: noticeId })
            toast({ title: "Магазин выключен" })
            setDisableDialog(false)
            await reload()
          } catch (e: any) {
            toast({ variant: "destructive", title: "Ошибка", description: e?.message })
          }
        }}
      />

      {/* Подтверждение включения */}
      <AlertDialog open={enableDialog} onOpenChange={setEnableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Включить магазин?</AlertDialogTitle>
            <AlertDialogDescription>
              Сайт сразу станет доступен всем клиентам и сотрудникам.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await crmPost("/api/admin/maintenance/mode/disable", {})
                  toast({ title: "Магазин включён" })
                  await reload()
                } catch (e: any) {
                  toast({ variant: "destructive", title: "Ошибка", description: e?.message })
                }
              }}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Включить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Создание / редактирование заготовки */}
      <NoticeEditDialog
        open={createNoticeOpen || Boolean(editNotice)}
        notice={editNotice}
        onOpenChange={(v) => {
          if (!v) { setCreateNoticeOpen(false); setEditNotice(null) }
        }}
        onSaved={async () => {
          setCreateNoticeOpen(false)
          setEditNotice(null)
          await reload()
        }}
      />

      {/* Удаление */}
      <AlertDialog open={Boolean(deleteNotice)} onOpenChange={(v) => !v && setDeleteNotice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заготовку?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteNotice?.title}» будет удалена. Если она сейчас
              активна — после удаления заглушка покажет стандартный
              текст, но магазин останется выключенным.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const nid = deleteNotice?.id
                if (!nid) return
                try {
                  await crmDelete(`/api/admin/maintenance/notices/${nid}`)
                  toast({ title: "Удалено" })
                  setDeleteNotice(null)
                  await reload()
                } catch (e: any) {
                  toast({ variant: "destructive", title: "Ошибка", description: e?.message })
                }
              }}
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

// ---------- вспомогательные компоненты ----------

function DisableDialog({
  open, onOpenChange, notices, onCreateNew, onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  notices: Notice[]
  onCreateNew: () => void
  onConfirm: (noticeId: number) => void | Promise<void>
}) {
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => { if (open) setPicked(notices[0]?.id ?? null) }, [open, notices])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <PowerOff className="h-5 w-5" />
            Выключить магазин
          </DialogTitle>
          <DialogDescription>
            Выберите, какую табличку увидят все кроме вас. Клиенты,
            менеджеры, сотрудники — все попадут на страницу-заглушку.
          </DialogDescription>
        </DialogHeader>

        {notices.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <div className="text-sm text-gray-600">
              Пока ни одной заготовки — создайте первую.
            </div>
            <Button onClick={onCreateNew} className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500">
              <Plus className="h-4 w-4 mr-1.5" />
              Создать заготовку
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
              {notices.map((n) => (
                <li key={n.id}>
                  <label className="flex items-start gap-3 py-2.5 px-1 cursor-pointer hover:bg-gray-50 rounded">
                    <input
                      type="radio"
                      name="notice"
                      checked={picked === n.id}
                      onChange={() => setPicked(n.id)}
                      className="mt-1 accent-brand-yellow"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-xs text-gray-500 line-clamp-2 whitespace-pre-wrap mt-0.5">
                          {n.body}
                        </div>
                      )}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              onClick={onCreateNew}
              className="w-full rounded-lg"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Создать новую заготовку
            </Button>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            onClick={() => picked != null && onConfirm(picked)}
            disabled={!picked}
            className="rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            <PowerOff className="h-4 w-4 mr-1.5" />
            Выключить магазин
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NoticeEditDialog({
  open, notice, onOpenChange, onSaved,
}: {
  open: boolean
  notice: Notice | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(notice?.title ?? "")
      setBody(notice?.body ?? "")
    }
  }, [open, notice])

  const isEdit = Boolean(notice)
  const canSave = title.trim().length > 0 && !saving

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      if (isEdit && notice) {
        await crmPut(`/api/admin/maintenance/notices/${notice.id}`, {
          title: title.trim(), body: body.trim(),
        })
      } else {
        await crmPost(`/api/admin/maintenance/notices`, {
          title: title.trim(), body: body.trim(),
        })
      }
      toast({ title: isEdit ? "Сохранено" : "Заготовка создана" })
      await onSaved()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать заготовку" : "Новая заготовка"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-normal">
              Заголовок
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Магазин временно недоступен"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-normal">
              Текст
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Проводим технические работы. Вернёмся к 15:00."
              rows={6}
              className="text-sm resize-y"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={submit}
            disabled={!canSave}
            className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
            {isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}
