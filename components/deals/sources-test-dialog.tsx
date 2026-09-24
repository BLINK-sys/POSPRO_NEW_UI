"use client"

/**
 * Модалка «Тестовый вызов» для ingest-источника.
 * Пробрасывает произвольный JSON payload в POST /api/admin/crm-sources/<id>/test,
 * бэк прогоняет через ingest в SAVEPOINT+rollback — сделка НЕ создаётся, но
 * возвращается preview того что было бы.
 */

import { useState } from "react"
import { Loader2, Beaker, AlertTriangle } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { crmPost } from "@/lib/crm-fetch"
import { useToast } from "@/hooks/use-toast"
import type { CrmIngestSource } from "@/lib/crm-sources-types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  source: CrmIngestSource
}

const DEFAULT_PAYLOAD = {
  source_ref_id: "test-" + Math.floor(Math.random() * 10000),
  client: {
    name: "Тестовый Клиент",
    email: "test@example.com",
    phone: "+77771234567",
  },
  amount: 100000,
  currency: "KZT",
  product_name: "Тестовый товар",
  notes: "Проверка настройки хука",
  external_url: "https://example.com/test",
}

interface TestResponse {
  success: boolean
  result: {
    ok: boolean
    deal_id: number | null
    responsible_id: number | null
    dedupe: boolean
    error: string | null
  }
  preview_deal: Record<string, any> | null
  note: string
}

export default function SourceTestDialog({ open, onOpenChange, source }: Props) {
  const { toast } = useToast()
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(DEFAULT_PAYLOAD, null, 2),
  )
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResponse | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleRun = async () => {
    setParseError(null)
    let payload: any
    try {
      payload = JSON.parse(payloadText)
    } catch (e) {
      setParseError("Невалидный JSON")
      return
    }
    setLoading(true)
    try {
      const res = await crmPost<TestResponse>(
        `/api/admin/crm-sources/${source.id}/test`,
        payload,
      )
      setResult(res)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Тестовый вызов упал",
        description: e?.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Тестовый вызов: {source.name}
          </DialogTitle>
          <DialogDescription>
            Сделка НЕ будет создана в базе — вы увидите только preview того,
            что бы получилось.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Payload (JSON)</Label>
            <Textarea
              rows={16}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="font-mono text-xs"
            />
            {parseError && (
              <div className="text-xs text-red-600 flex items-center gap-1 pt-1">
                <AlertTriangle className="h-3 w-3" />
                {parseError}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Результат</Label>
            {result ? (
              <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50 max-h-[480px] overflow-y-auto">
                <ResultRow
                  ok={result.result.ok}
                  dedupe={result.result.dedupe}
                  responsibleId={result.result.responsible_id}
                  error={result.result.error}
                />
                {result.preview_deal && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Preview сделки
                    </div>
                    <pre className="text-[11px] bg-white border border-gray-200 rounded p-2 font-mono overflow-x-auto">
                      {JSON.stringify(result.preview_deal, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="text-[11px] text-gray-500">{result.note}</div>
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500 min-h-[240px] flex items-center justify-center">
                Нажмите «Запустить тест» — результат появится тут
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Закрыть
          </Button>
          <Button
            onClick={handleRun}
            disabled={loading}
            className="bg-brand-yellow text-black hover:bg-yellow-500"
          >
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Запустить тест
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResultRow({
  ok,
  dedupe,
  responsibleId,
  error,
}: {
  ok: boolean
  dedupe: boolean
  responsibleId: number | null
  error: string | null
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Результат
      </div>
      <div className="text-sm space-y-0.5">
        <div>
          <span className="text-gray-500">Статус:</span>{" "}
          {ok ? (
            <span className="text-emerald-700 font-medium">OK</span>
          ) : (
            <span className="text-red-700 font-medium">ошибка</span>
          )}
        </div>
        <div>
          <span className="text-gray-500">Дедупликация:</span>{" "}
          {dedupe ? (
            <span className="text-amber-700">сработала — сделка уже была</span>
          ) : (
            <span className="text-gray-700">нет</span>
          )}
        </div>
        <div>
          <span className="text-gray-500">Ответственный:</span>{" "}
          <span className="text-gray-700">
            {responsibleId ? `#${responsibleId}` : "не назначен"}
          </span>
        </div>
        {error && (
          <div className="text-red-700 mt-1 text-xs">
            <strong>Ошибка:</strong> {error}
          </div>
        )}
      </div>
    </div>
  )
}
