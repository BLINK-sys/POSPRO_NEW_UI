"use client"

/**
 * Карточка «Информация» на сделке — опросник из универсальных справочников
 * (dictionary / dictionary_item). Показывает union всех справочников,
 * привязанных к стадиям текущей воронки сделки (DealStage.required_dict_codes),
 * чтобы можно было заполнять поля в любой момент, а не только при переходе
 * стадии.
 *
 * Значения живут в `deal.survey_values` (JSONB, {code: item_id}) и
 * летят на бэк через общий draft родителя (deal-detail → PUT /deals/<id>).
 *
 * Пустой список словарей по воронке → карточка не рендерится.
 *
 * Бэк:
 *   GET /api/admin/deal-pipelines/<pid>/survey-dicts
 *   PUT /api/admin/deals/<id>  { survey_values: {...} }
 */

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Loader2 } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { crmGet } from "@/lib/crm-fetch"
import type { Deal } from "@/lib/deals-types"


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

const NONE_VALUE = "__none__"

interface Props {
  deal: Deal
  draft: Partial<Deal>
  onDraft: (patch: Partial<Deal>) => void
}

export default function DealSurveyCard({ deal, draft, onDraft }: Props) {
  const [dicts, setDicts] = useState<DictRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await crmGet<{ dictionaries: DictRow[] }>(
        `/api/admin/deal-pipelines/${deal.pipeline_id}/survey-dicts`,
      )
      setDicts(r.dictionaries ?? [])
    } catch {
      setDicts([])
    } finally {
      setLoading(false)
    }
  }, [deal.pipeline_id])

  useEffect(() => {
    load()
  }, [load])

  // Приоритет: сначала draft (несохранённые правки), потом deal.
  const values: Record<string, number> =
    (draft.survey_values as Record<string, number> | undefined) ??
    deal.survey_values ??
    {}

  const setValue = (code: string, itemId: number | null) => {
    const next = { ...(values || {}) }
    if (itemId == null) delete next[code]
    else next[code] = itemId
    onDraft({ survey_values: next })
  }

  // Пока грузим — не моргаем карточкой. Если словарей нет — не рендерим.
  if (loading) {
    return (
      <Card className="p-4 flex items-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Информация…
      </Card>
    )
  }
  if (dicts.length === 0) return null

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-brand-yellow" />
        <h3 className="text-sm font-semibold">Информация</h3>
      </div>
      <div className="space-y-3">
        {dicts.map((d) => {
          const val = values?.[d.code]
          const active = d.items.filter(
            (it) => it.is_active || it.id === val,
          )
          return (
            <div key={d.id} className="space-y-1">
              <Label className="text-xs text-gray-600">{d.label}</Label>
              <Select
                value={val ? String(val) : NONE_VALUE}
                onValueChange={(v) =>
                  setValue(d.code, v === NONE_VALUE ? null : parseInt(v, 10))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="— не указано —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— не указано —</SelectItem>
                  {active.map((it) => (
                    <SelectItem key={it.id} value={String(it.id)}>
                      {it.name}
                      {!it.is_active && " (архив)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
