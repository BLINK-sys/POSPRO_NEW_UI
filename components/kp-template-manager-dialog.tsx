"use client"

/**
 * Модалка управления шаблонами КП.
 *
 * Левая колонка — список шаблонов с поиском и кнопкой «+ Создать из текущих».
 * Правая — детали выбранного шаблона: имя, описание, превью настроек +
 * две главные кнопки «Применить ко мне» и «Перезаписать текущими».
 *
 * Применение шаблона = разовое копирование `template.settings` в локальный
 * `kpSettings` пользователя (через onApply callback). Сам шаблон не меняется.
 * Кнопка «Применить» вызывает confirm-диалог «Перезаписать текущие
 * настройки?» — настройки заменяются полностью (кроме kpName, items,
 * calculator, активного клиента — это другие сущности).
 *
 * Создание шаблона = снэпшот текущих `kpSettings` пользователя без
 * `kpName`. Юзер даёт имя и описание.
 *
 * Удаление шаблона ничего не блокирует на бэке (КП-документы хранят
 * settings прямо в kp_history, не ссылку на шаблон). А вот удаление
 * файлов лого/картинок из галереи бэк блокирует если файл упомянут
 * в каком-то шаблоне.
 */

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Search, Trash2, Check, FileText, Download, Upload, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  listKpTemplates,
  createKpTemplate,
  updateKpTemplate,
  deleteKpTemplate,
  type KpTemplate,
} from "@/app/actions/kp-templates"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { cn } from "@/lib/utils"

const SOFT =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Откуда модалка открыта:
  //   - 'editor' — юзер работает над конкретным КП. Создание шаблона
  //     берёт настройки этого открытого КП (currentSettings).
  //   - 'list'   — модалка открыта со списка КП на пустой /kp. Создание
  //     требует выбора одного из сохранённых КП как источника настроек
  //     (через historyEntries + onFetchHistorySettings).
  source: 'editor' | 'list'
  // Текущие настройки юзера. Используются:
  //   - в source='editor' для «Создать на основе текущего»
  //   - всегда для «Перезаписать шаблон текущими» (если в editor)
  currentSettings: Record<string, any>
  // Колбэк применения шаблона. Получает `settings` из шаблона — должен
  // заменить локальный kpSettings (за исключением kpName).
  onApply: (settings: Record<string, any>) => void
  // Только для source='list': список сохранённых КП (id + name) для
  // выбора источника настроек при создании шаблона.
  historyEntries?: { id: number; name: string }[]
  // Только для source='list': фетчер настроек конкретного сохранённого
  // КП. Возвращает kpSettings или null если не получилось.
  onFetchHistorySettings?: (id: number) => Promise<Record<string, any> | null>
}

// Короткое описание содержимого шаблона для превью справа.
function summarizeSettings(s: Record<string, any>): { label: string; value: string }[] {
  const logos = Array.isArray(s.logos) ? s.logos.length : 0
  const textEls = Array.isArray(s.textElements) ? s.textElements.length : 0
  const footerOn = !!(s.footer && s.footer.enabled)
  const footerEls = footerOn && Array.isArray(s.footer?.elements) ? s.footer.elements.length : 0
  const cols = s.columns && typeof s.columns === 'object'
    ? Object.entries(s.columns).filter(([_, v]) => v === true).length
    : 0
  return [
    { label: 'Колонки таблицы', value: `${cols} вкл` },
    { label: 'Логотипы', value: logos === 0 ? '—' : `${logos} шт` },
    { label: 'Текст-блоки', value: textEls === 0 ? '—' : `${textEls} шт` },
    { label: 'Колонтитул', value: footerOn ? `вкл, ${footerEls} элемент(ов)` : 'выкл' },
    { label: 'Заголовок', value: s.title || '—' },
  ]
}

// Создаёт payload для шаблона из текущих kpSettings: всё кроме kpName.
function settingsToTemplatePayload(s: Record<string, any>): Record<string, any> {
  const { kpName, ...rest } = s
  return rest
}

export function KpTemplateManagerDialog({
  open,
  onOpenChange,
  source,
  currentSettings,
  onApply,
  historyEntries,
  onFetchHistorySettings,
}: Props) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<KpTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [activeId, setActiveId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<KpTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Подтверждение применения — отдельный диалог, чтобы случайный клик
  // не стёр текущие настройки.
  const [applyCandidate, setApplyCandidate] = useState<KpTemplate | null>(null)
  // Подтверждение «Перезаписать текущими» — заливает текущие kpSettings
  // в шаблон, перезаписывая то что в шаблоне было.
  const [pushCandidate, setPushCandidate] = useState<KpTemplate | null>(null)

  // Состояние выбора сохранённого КП как источника настроек для нового
  // шаблона. Только для source='list'. null = picker закрыт.
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false)
  const [historyPickerSearch, setHistoryPickerSearch] = useState("")

  // Форма редактирования name/description выбранного шаблона.
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editDirty, setEditDirty] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch("")
    listKpTemplates()
      .then((list) => {
        setTemplates(list)
        setActiveId(null)
        setEditName("")
        setEditDescription("")
        setEditDirty(false)
      })
      .catch(() => {
        toast({ title: "Ошибка", description: "Не удалось загрузить шаблоны", variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [open, toast])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(t => {
      return (t.name && t.name.toLowerCase().includes(q))
        || (t.description && t.description.toLowerCase().includes(q))
    })
  }, [templates, search])

  const active = useMemo(() => templates.find(t => t.id === activeId) || null, [templates, activeId])

  const handleSelect = (t: KpTemplate) => {
    setActiveId(t.id)
    setEditName(t.name)
    setEditDescription(t.description || "")
    setEditDirty(false)
  }

  // Универсальное создание шаблона из заранее подготовленных settings.
  // Используется и в editor-режиме (currentSettings), и в list-режиме
  // (settings конкретного сохранённого КП из истории).
  const createFromSettings = async (settings: Record<string, any>, sourceLabel: string) => {
    const ts = new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
    const defaultName = `Шаблон от ${ts} (${sourceLabel})`
    setSaving(true)
    try {
      const res = await createKpTemplate({
        name: defaultName,
        description: null,
        settings: settingsToTemplatePayload(settings),
      })
      if (!res.success || !res.template) {
        toast({ title: "Ошибка", description: res.error || "Не удалось создать", variant: "destructive" })
        return
      }
      setTemplates(prev => [res.template!, ...prev])
      setActiveId(res.template.id)
      setEditName(res.template.name)
      setEditDescription(res.template.description || "")
      setEditDirty(false)
      toast({ title: "Шаблон создан", description: "Дайте ему понятное название" })
    } finally {
      setSaving(false)
    }
  }

  // Editor-режим: снимок текущих kpSettings.
  const handleCreateFromCurrent = async () => {
    await createFromSettings(currentSettings, "текущее КП")
  }

  // List-режим: фетчим settings указанного КП из истории, потом создаём.
  const handleCreateFromHistoryEntry = async (entry: { id: number; name: string }) => {
    if (!onFetchHistorySettings) return
    setSaving(true)
    try {
      const settings = await onFetchHistorySettings(entry.id)
      if (!settings) {
        toast({ title: "Ошибка", description: "Не удалось загрузить настройки выбранного КП", variant: "destructive" })
        return
      }
      setHistoryPickerOpen(false)
      setHistoryPickerSearch("")
      await createFromSettings(settings, entry.name)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMeta = async () => {
    if (!active) return
    if (!editName.trim()) {
      toast({ title: "Заполните поле", description: "Название шаблона не может быть пустым", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await updateKpTemplate(active.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      })
      if (!res.success || !res.template) {
        toast({ title: "Ошибка", description: res.error || "Не удалось сохранить", variant: "destructive" })
        return
      }
      setTemplates(prev => prev.map(t => t.id === active.id ? res.template! : t))
      setEditDirty(false)
      toast({ title: "Сохранено" })
    } finally {
      setSaving(false)
    }
  }

  // «Перезаписать текущими» — снимок текущих kpSettings заменяет
  // содержимое шаблона. После confirm-диалога.
  const handlePushCurrent = async () => {
    if (!pushCandidate) return
    setSaving(true)
    try {
      const res = await updateKpTemplate(pushCandidate.id, {
        settings: settingsToTemplatePayload(currentSettings),
      })
      if (!res.success || !res.template) {
        toast({ title: "Ошибка", description: res.error || "Не удалось обновить", variant: "destructive" })
        return
      }
      setTemplates(prev => prev.map(t => t.id === pushCandidate.id ? res.template! : t))
      setPushCandidate(null)
      toast({ title: "Шаблон обновлён", description: "Настройки шаблона заменены вашими текущими" })
    } finally {
      setSaving(false)
    }
  }

  const handleApplyConfirmed = () => {
    if (!applyCandidate) return
    onApply(applyCandidate.settings || {})
    setApplyCandidate(null)
    onOpenChange(false)
    toast({ title: "Шаблон применён", description: `Настройки заменены из «${applyCandidate.name}»` })
  }

  const handleDelete = async () => {
    if (!deleteCandidate) return
    setDeleting(true)
    try {
      const res = await deleteKpTemplate(deleteCandidate.id)
      if (!res.success) {
        toast({ title: "Не удалось удалить", description: res.error || "Ошибка", variant: "destructive" })
        return
      }
      setTemplates(prev => prev.filter(t => t.id !== deleteCandidate.id))
      if (activeId === deleteCandidate.id) {
        setActiveId(null)
        setEditName("")
        setEditDescription("")
        setEditDirty(false)
      }
      setDeleteCandidate(null)
      toast({ title: "Удалено" })
    } finally {
      setDeleting(false)
    }
  }

  const summary = active ? summarizeSettings(active.settings || {}) : []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-700" />
              Шаблоны КП
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-[320px_1fr] h-[560px] min-h-0">
            {/* ─── Левая колонка: список ─────────────── */}
            <div className="border-r flex flex-col bg-gray-50/50 min-h-0">
              <div className="p-3 space-y-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Поиск по названию"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn("h-9 pl-8 text-sm", SOFT)}
                  />
                </div>
                {source === 'editor' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCreateFromCurrent}
                      disabled={saving}
                      className="w-full justify-center gap-1.5 text-sm bg-yellow-50 border-yellow-300 text-yellow-900 hover:bg-yellow-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Создать на основе текущего
                    </Button>
                    <p className="text-[10px] text-gray-400 px-1 leading-tight">
                      Снимет настройки правой панели открытого сейчас КП
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryPickerOpen(true)}
                      disabled={saving || !historyEntries || historyEntries.length === 0}
                      className="w-full justify-center gap-1.5 text-sm bg-yellow-50 border-yellow-300 text-yellow-900 hover:bg-yellow-100 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Создать на основе сохранённого КП
                    </Button>
                    <p className="text-[10px] text-gray-400 px-1 leading-tight">
                      {!historyEntries || historyEntries.length === 0
                        ? 'Сначала сохраните хотя бы одно КП, чтобы было откуда снять настройки'
                        : 'Выберите одно из ваших сохранённых КП — его настройки станут основой шаблона'}
                    </p>
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-10 px-4 text-sm text-gray-400">
                    {search ? "Ничего не найдено" : "Шаблонов пока нет"}
                  </div>
                ) : (
                  <ul className="py-1">
                    {filtered.map((t) => {
                      const isActive = activeId === t.id
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(t)}
                            className={cn(
                              "w-full text-left px-3 py-2 hover:bg-yellow-50 transition-colors group flex items-start gap-2",
                              isActive && "bg-yellow-100 hover:bg-yellow-100",
                            )}
                          >
                            <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-gray-900 truncate">
                                {t.name}
                              </span>
                              {t.description && (
                                <span className="block text-[11px] text-gray-500 truncate">
                                  {t.description}
                                </span>
                              )}
                              <span className="block text-[10px] text-gray-400">
                                {new Date(t.updated_at).toLocaleDateString('ru-RU')}
                              </span>
                            </span>
                            {isActive && <Check className="h-4 w-4 text-yellow-700 shrink-0 mt-0.5" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* ─── Правая колонка: детали ──────────────── */}
            <div className="flex flex-col min-h-0">
              {!active ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm px-8 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mb-3" />
                  Выберите шаблон слева, чтобы посмотреть, применить или отредактировать.
                  <br />
                  Или создайте новый — кнопкой слева сверху.
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Название
                      </Label>
                      <Input
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setEditDirty(true) }}
                        className={cn("mt-1 h-9 text-sm", SOFT)}
                        placeholder="Например: Стандартный с логотипом"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Описание
                      </Label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => { setEditDescription(e.target.value); setEditDirty(true) }}
                        className={cn("mt-1 text-sm min-h-[60px] resize-none", SOFT)}
                        placeholder="Кратко: для каких задач этот шаблон"
                      />
                    </div>

                    {editDirty && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleSaveMeta}
                          disabled={saving}
                          className="h-8 text-xs bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
                        >
                          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Pencil className="h-3 w-3 mr-1" />}
                          Сохранить имя и описание
                        </Button>
                      </div>
                    )}

                    <div className="pt-2 border-t">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                        Что в шаблоне
                      </Label>
                      <div className="space-y-1 text-xs">
                        {summary.map((row, i) => (
                          <div key={i} className="flex justify-between gap-2 py-0.5">
                            <span className="text-gray-500">{row.label}</span>
                            <span className="font-medium text-gray-800 text-right truncate ml-2">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 pt-1 leading-tight">
                      «Применить» заменит ваши локальные настройки правой панели на содержимое шаблона.
                      Сам шаблон не меняется.
                      {source === 'editor' && ' Чтобы наоборот залить настройки текущего КП в шаблон — «Перезаписать текущими».'}
                    </p>
                  </div>

                  <div className="shrink-0 px-6 py-3 border-t bg-gray-50 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteCandidate(active)}
                      className="h-9 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Удалить шаблон
                    </Button>

                    <div className="flex gap-2">
                      {/* «Перезаписать текущими» имеет смысл только в editor-режиме —
                          там «текущие» это настройки конкретного открытого КП. В list-режиме
                          юзер ничего не редактирует, поэтому кнопку прячем (для замены
                          содержимого шаблона по сохранённому КП можно удалить старый
                          и создать новый — это явнее). */}
                      {source === 'editor' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPushCandidate(active)}
                          disabled={saving}
                          className="h-9 text-xs"
                          title="Заменить настройки шаблона настройками текущего открытого КП"
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          Перезаписать текущими
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => setApplyCandidate(active)}
                        className="h-9 text-xs bg-yellow-400 hover:bg-yellow-500 text-black"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Применить ко мне
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={!!deleteCandidate}
        onOpenChange={(o) => !o && !deleting && setDeleteCandidate(null)}
        onConfirm={handleDelete}
        title="Удалить шаблон?"
        description={
          deleteCandidate
            ? `Шаблон «${deleteCandidate.name}» будет удалён. Уже импортированные на его основе КП останутся как есть — у них настройки скопированы локально.`
            : ""
        }
      />

      <DeleteConfirmationDialog
        open={!!applyCandidate}
        onOpenChange={(o) => !o && setApplyCandidate(null)}
        onConfirm={handleApplyConfirmed}
        title="Применить шаблон?"
        confirmLabel="Применить"
        description={
          applyCandidate
            ? `Ваши текущие настройки правой панели (колонки, логотипы, тексты, колонтитул) будут заменены содержимым шаблона «${applyCandidate.name}». Товары и название КП останутся как есть.`
            : ""
        }
      />

      <DeleteConfirmationDialog
        open={!!pushCandidate}
        onOpenChange={(o) => !o && !saving && setPushCandidate(null)}
        onConfirm={handlePushCurrent}
        title="Перезаписать шаблон вашими текущими?"
        confirmLabel="Перезаписать"
        description={
          pushCandidate
            ? `Содержимое шаблона «${pushCandidate.name}» будет заменено вашими текущими настройками правой панели. Это видно всем системным пользователям.`
            : ""
        }
      />

      {/* Picker сохранённых КП как источника настроек для нового шаблона.
          Только в list-режиме. После выбора фетчим settings выбранного КП
          и создаём из них шаблон. */}
      <Dialog open={historyPickerOpen} onOpenChange={(o) => { if (!o) { setHistoryPickerOpen(false); setHistoryPickerSearch("") } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-4 pb-3 border-b">
            <DialogTitle className="text-base">Откуда снять настройки</DialogTitle>
          </DialogHeader>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Поиск по названию КП"
                value={historyPickerSearch}
                onChange={(e) => setHistoryPickerSearch(e.target.value)}
                className={cn("h-9 pl-8 text-sm", SOFT)}
              />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {(() => {
              const q = historyPickerSearch.trim().toLowerCase()
              const list = (historyEntries || []).filter(e => !q || e.name.toLowerCase().includes(q))
              if (list.length === 0) {
                return (
                  <p className="text-sm text-gray-400 text-center py-10 px-5">
                    {q ? 'Ничего не найдено' : 'Сохранённых КП пока нет'}
                  </p>
                )
              }
              return (
                <ul className="py-1">
                  {list.map(entry => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleCreateFromHistoryEntry(entry)}
                        className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                          {entry.name}
                        </span>
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
          <div className="px-5 py-3 border-t bg-gray-50 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setHistoryPickerOpen(false); setHistoryPickerSearch("") }} disabled={saving}>
              Отмена
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
