"use client"

/**
 * Модалка-опросник, вызывается когда move_deal вернул 400 с missing_codes:
 * бэк сообщает, какие справочники обязательны при входе на целевую стадию
 * и ещё не заполнены на сделке. Фронт показывает селекты ТОЛЬКО по этим
 * кодам (а не все словари воронки — для карточки «Информация»), юзер
 * заполняет, нажимает «Переместить» → повторный move с `survey_values`.
 *
 * Бэк:
 *   POST /api/admin/deals/<id>/move  { stage_id, survey_values }
 *   GET  /api/admin/deal-pipelines/<pid>/survey-dicts  (из этой же воронки
 *     берём items + label для кодов из missing_codes)
 */

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { crmGet } from "@/lib/crm-fetch"


interface DictItem {
  id: number
  name: string
  is_active: boolean
}

interface DictRow {
  id: number
  code: string
  label: string
  items: DictItem[]
}


interface Props {
  open: boolean
  pipelineId: number
  missingCodes: string[]
  stageName?: string
  onCancel: () => void
  /** Коллбек: отправить move с собранными значениями. Родитель сам ловит
   *  ошибки (вдруг снова 400) и либо закрывает диалог, либо оставляет
   *  открытым. Возвращает true если переход удался. */
  onSubmit: (surveyValues: Record<string, number>) => Promise<boolean>
}

export default function DealMoveSurveyDialog({
  open,
  pipelineId,
  missingCodes,
  stageName,
  onCancel,
  onSubmit,
}: Props) {
  const [dicts, setDicts] = useState<DictRow[]>([])
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const r = await crmGet<{ dictionaries: DictRow[] }>(
        `/api/admin/deal-pipelines/${pipelineId}/survey-dicts`,
      )
      // Оставляем только нужные справочники.
      const codes = new Set(missingCodes)
      setDicts((r.dictionaries ?? []).filter((d) => codes.has(d.code)))
    } catch {
      setDicts([])
    } finally {
      setLoading(false)
    }
  }, [open, pipelineId, missingCodes])

  useEffect(() => {
    if (open) {
      setValues({})
      load()
    }
  }, [open, load])

  const allFilled = missingCodes.every((c) => values[c])

  const submit = async () => {
    if (!allFilled) return
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-yellow" />
            Заполните опросник
          </DialogTitle>
          <DialogDescription>
            {stageName
              ? `Для перехода на стадию «${stageName}» нужно указать:`
              : "Для перехода на эту стадию нужно указать:"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Загрузка…
          </div>
        ) : dicts.length === 0 ? (
          <div className="text-sm text-red-600 py-4">
            Не удалось загрузить справочники воронки. Обратитесь к владельцу.
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {dicts.map((d) => (
              <div key={d.id} className="space-y-1">
                <Label className="text-sm">{d.label}</Label>
                <Select
                  value={values[d.code] ? String(values[d.code]) : ""}
                  onValueChange={(v) =>
                    setValues((prev) => ({ ...prev, [d.code]: parseInt(v, 10) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— выбрать —" />
                  </SelectTrigger>
                  <SelectContent>
                    {d.items
                      .filter((it) => it.is_active)
                      .map((it) => (
                        <SelectItem key={it.id} value={String(it.id)}>
                          {it.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onCancel}
            disabled={submitting}
          >
            Отмена
          </Button>
          <Button
            className="rounded-full bg-brand-yellow text-black hover:bg-brand-yellow/90"
            disabled={!allFilled || submitting || loading}
            onClick={submit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Переместить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
