"use client"

/**
 * Админ-страница «Справочники сделок»: два функциональных раздела —
 *   1. «Источники» — иерархический DealSource (parent + variants, свой UI).
 *   2. «Опросник для стадий» — набор универсальных Dictionary (Теплота/Город/
 *      Деятельность/Тип бизнеса из B24, админ может добавить любые).
 *
 * Выбранные здесь коды справочников дальше нужно отметить в стадии воронки
 * (pipelines-manager) как «обязательные при входе на стадию» —
 * тогда карточка «Информация» на сделке и модалка при перемещении на
 * стадию будут их спрашивать.
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Signpost } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { crmGet, crmPost } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"

import DealSourcesList from "./deal-sources-list"
import DictionaryEditor, { DictionaryRow } from "./dictionary-editor"


type Tab = { kind: "sources" } | { kind: "dict"; dict: DictionaryRow }


export default function DealDictionariesManager() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canManage = Boolean(user && (user.is_owner || user.can_manage_pipelines))

  const [dicts, setDicts] = useState<DictionaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeKey, setActiveKey] = useState<string>("sources")

  const [createDialog, setCreateDialog] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newCode, setNewCode] = useState("")
  const [newCodeTouched, setNewCodeTouched] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadDicts = useCallback(async () => {
    setLoading(true)
    try {
      const r = await crmGet<{ dictionaries: DictionaryRow[] }>(
        "/api/admin/dictionaries",
      )
      setDicts(r.dictionaries ?? [])
    } catch (e: any) {
      toast({
        title: "Не удалось загрузить справочники",
        description: e?.message ?? "",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadDicts()
  }, [loadDicts])

  const slugifyLabel = (v: string) =>
    v
      .toLowerCase()
      .replace(/[ёЁ]/g, "e")
      .replace(/[а-я]/g, (c) => {
        const map: Record<string, string> = {
          а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z",
          и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
          р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch",
          ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
        }
        return map[c] ?? ""
      })
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64)

  const openCreate = () => {
    setNewLabel("")
    setNewCode("")
    setNewCodeTouched(false)
    setCreateDialog(true)
  }

  const submitCreate = async () => {
    const label = newLabel.trim()
    const code = (newCodeTouched ? newCode : slugifyLabel(newLabel)).trim()
    if (!label || !code) return
    setCreating(true)
    try {
      const r = await crmPost<{ dictionary: DictionaryRow }>(
        "/api/admin/dictionaries",
        { label, code, order_pos: dicts.length },
      )
      setDicts((prev) => [...prev, { ...r.dictionary, items_count: 0 }])
      setActiveKey(`dict:${r.dictionary.id}`)
      setCreateDialog(false)
      toast({ title: "Справочник создан" })
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e?.message ?? "",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDictChanged = (did: number, upd: DictionaryRow | null) => {
    if (upd === null) {
      setDicts((prev) => prev.filter((d) => d.id !== did))
      setActiveKey("sources")
    } else {
      setDicts((prev) => prev.map((d) => (d.id === did ? { ...d, ...upd } : d)))
    }
  }

  const activeDict =
    activeKey.startsWith("dict:")
      ? dicts.find((d) => `dict:${d.id}` === activeKey) ?? null
      : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="outline" size="sm"
                className="rounded-full h-7 px-2.5 text-xs">
          <Link href="/admin/deals">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            К сделкам
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Signpost className="h-6 w-6 text-brand-yellow" />
          Справочники сделок
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveKey("sources")}
          className={cn(
            "px-4 h-9 text-sm rounded-full transition-all border",
            activeKey === "sources"
              ? "bg-brand-yellow text-black border-brand-yellow font-medium"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
          )}
        >
          Источники
        </button>
        <div className="h-5 w-px bg-gray-300 mx-1" />
        <div className="text-xs text-gray-500 mr-1">Опросник для стадий:</div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          dicts.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveKey(`dict:${d.id}`)}
              className={cn(
                "px-4 h-9 text-sm rounded-full transition-all border inline-flex items-center gap-1.5",
                activeKey === `dict:${d.id}`
                  ? "bg-brand-yellow text-black border-brand-yellow font-medium"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
              )}
            >
              {d.label}
              {typeof d.items_count === "number" && (
                <span className="text-[11px] text-gray-500">
                  {d.items_count}
                </span>
              )}
            </button>
          ))
        )}
        {canManage && !loading && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-9"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4 mr-1" />
            Новый
          </Button>
        )}
      </div>

      {/* Content */}
      <Card className="p-5">
        {activeKey === "sources" && <DealSourcesList />}
        {activeDict && (
          <DictionaryEditor
            dictionary={activeDict}
            onDictChanged={(upd) => handleDictChanged(activeDict.id, upd)}
          />
        )}
      </Card>

      {/* Create dict */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый справочник</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value)
                  if (!newCodeTouched) setNewCode(slugifyLabel(e.target.value))
                }}
                placeholder="Например, Тип клиента"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                code <span className="text-xs text-gray-400">(ascii, _0-9, уникален)</span>
              </Label>
              <Input
                value={newCode}
                onChange={(e) => {
                  setNewCode(e.target.value.toLowerCase())
                  setNewCodeTouched(true)
                }}
                placeholder="client_type"
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Нужен бэку для привязки к стадии (<code>required_dict_codes</code>).
                После создания менять не стоит.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full"
                    onClick={() => setCreateDialog(false)}>Отмена</Button>
            <Button className="rounded-full bg-brand-yellow text-black hover:bg-brand-yellow/90"
                    onClick={submitCreate} disabled={creating || !newLabel.trim() || !newCode.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
