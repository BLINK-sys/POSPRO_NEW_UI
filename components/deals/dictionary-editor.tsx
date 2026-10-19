"use client"

/**
 * Редактор одного универсального справочника (dictionary + dictionary_item).
 * Используется внутри DealDictionariesManager — каждый таб-опросник
 * показывает такой редактор своего словаря. Переименование словаря,
 * удаление, CRUD его items, тумблер is_active.
 *
 * Бэк: /api/admin/dictionaries, /api/admin/dictionaries/<id>/items,
 * /api/admin/dictionary-items/<iid>.
 *
 * Доступ: owner / can_manage_pipelines (та же привычная связка «настройщик
 * CRM-структуры»). Для остальных админов — read-only (кнопки прячутся).
 */

import { useCallback, useEffect, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { crmDelete, crmGet, crmPost, crmPut } from "@/lib/crm-fetch"

interface DictionaryItem {
  id: number
  dict_id: number
  name: string
  order_pos: number
  is_active: boolean
}

export interface DictionaryRow {
  id: number
  code: string
  label: string
  order_pos: number
  items_count?: number
}

interface Props {
  dictionary: DictionaryRow
  /** Коллбек-уведомление о переименовании/удалении словаря (для обновления списка табов). */
  onDictChanged?: (upd: DictionaryRow | null) => void
}

export default function DictionaryEditor({ dictionary, onDictChanged }: Props) {
  const { toast } = useToast()
  const { user } = useAuth()
  const canManage = Boolean(user && (user.is_owner || user.can_manage_pipelines))

  const [items, setItems] = useState<DictionaryItem[]>([])
  const [loading, setLoading] = useState(true)

  const [dictLabel, setDictLabel] = useState(dictionary.label)
  const [renameDialog, setRenameDialog] = useState(false)
  const [renameValue, setRenameValue] = useState(dictionary.label)
  const [savingRename, setSavingRename] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [editItem, setEditItem] = useState<DictionaryItem | null>(null)
  const [itemName, setItemName] = useState("")
  const [savingItem, setSavingItem] = useState(false)

  const [deleteItem, setDeleteItem] = useState<DictionaryItem | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await crmGet<{ items: DictionaryItem[] }>(
        `/api/admin/dictionaries/${dictionary.id}/items`,
      )
      setItems(r.items ?? [])
    } catch (e: any) {
      toast({
        title: "Не удалось загрузить элементы",
        description: e?.message ?? "",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [dictionary.id, toast])

  useEffect(() => {
    loadItems()
    setDictLabel(dictionary.label)
    setRenameValue(dictionary.label)
  }, [dictionary.id, dictionary.label, loadItems])

  const submitRename = async () => {
    const v = renameValue.trim()
    if (!v) return
    if (v === dictLabel) {
      setRenameDialog(false)
      return
    }
    setSavingRename(true)
    try {
      const r = await crmPut<{ dictionary: DictionaryRow }>(
        `/api/admin/dictionaries/${dictionary.id}`,
        { label: v },
      )
      setDictLabel(r.dictionary.label)
      onDictChanged?.(r.dictionary)
      setRenameDialog(false)
      toast({ title: "Название обновлено" })
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e?.message ?? "",
        variant: "destructive",
      })
    } finally {
      setSavingRename(false)
    }
  }

  const submitDeleteDict = async () => {
    setDeleting(true)
    try {
      await crmDelete(`/api/admin/dictionaries/${dictionary.id}`)
      onDictChanged?.(null)
      setDeleteDialog(false)
      toast({ title: "Справочник удалён" })
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e?.message ?? "",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const openCreateItem = () => {
    setEditItem({ id: 0, dict_id: dictionary.id, name: "", order_pos: items.length, is_active: true })
    setItemName("")
  }

  const openEditItem = (it: DictionaryItem) => {
    setEditItem(it)
    setItemName(it.name)
  }

  const submitItem = async () => {
    if (!editItem) return
    const v = itemName.trim()
    if (!v) return
    setSavingItem(true)
    try {
      if (editItem.id === 0) {
        const r = await crmPost<{ item: DictionaryItem }>(
          `/api/admin/dictionaries/${dictionary.id}/items`,
          { name: v, order_pos: editItem.order_pos },
        )
        setItems((prev) => [...prev, r.item])
      } else {
        const r = await crmPut<{ item: DictionaryItem }>(
          `/api/admin/dictionary-items/${editItem.id}`,
          { name: v },
        )
        setItems((prev) => prev.map((x) => (x.id === r.item.id ? r.item : x)))
      }
      setEditItem(null)
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e?.message ?? "",
        variant: "destructive",
      })
    } finally {
      setSavingItem(false)
    }
  }

  const toggleActive = async (it: DictionaryItem) => {
    try {
      const r = await crmPut<{ item: DictionaryItem }>(
        `/api/admin/dictionary-items/${it.id}`,
        { is_active: !it.is_active },
      )
      setItems((prev) => prev.map((x) => (x.id === r.item.id ? r.item : x)))
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e?.message ?? "",
        variant: "destructive",
      })
    }
  }

  const submitDeleteItem = async () => {
    if (!deleteItem) return
    try {
      await crmDelete(`/api/admin/dictionary-items/${deleteItem.id}`)
      setItems((prev) => prev.filter((x) => x.id !== deleteItem.id))
      setDeleteItem(null)
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e?.message ?? "",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Загрузка…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-lg font-semibold truncate">{dictLabel}</h3>
        </div>
        {canManage && (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setRenameValue(dictLabel)
                setRenameDialog(true)
              }}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Переименовать
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-red-600 hover:text-red-700"
              onClick={() => setDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Удалить справочник
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-lg divide-y">
        {items.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            Пока нет значений. {canManage && "Добавь первое."}
          </div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className={it.is_active ? "" : "text-gray-400 line-through"}>
                  {it.name}
                </div>
              </div>
              {canManage && (
                <>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Switch
                      checked={it.is_active}
                      onCheckedChange={() => toggleActive(it)}
                    />
                    <span>{it.is_active ? "вкл" : "выкл"}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="rounded-full"
                          onClick={() => openEditItem(it)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="rounded-full text-red-600 hover:text-red-700"
                    onClick={() => setDeleteItem(it)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {canManage && (
        <Button
          variant="outline"
          className="rounded-full"
          onClick={openCreateItem}
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить значение
        </Button>
      )}

      {/* Rename dict */}
      <Dialog open={renameDialog} onOpenChange={setRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать справочник</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Название</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full"
                    onClick={() => setRenameDialog(false)}>Отмена</Button>
            <Button className="rounded-full bg-brand-yellow text-black hover:bg-brand-yellow/90"
                    onClick={submitRename} disabled={savingRename}>
              {savingRename && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dict */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить справочник «{dictLabel}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Все элементы справочника будут удалены. Значения на сделках
              останутся в данных, но перестанут отображаться.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
              onClick={submitDeleteDict}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit/Create item */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editItem?.id === 0 ? "Новое значение" : "Переименовать значение"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Название</Label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitItem()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full"
                    onClick={() => setEditItem(null)}>Отмена</Button>
            <Button className="rounded-full bg-brand-yellow text-black hover:bg-brand-yellow/90"
                    onClick={submitItem} disabled={savingItem}>
              {savingItem && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete item */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить «{deleteItem?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Значение исчезнет из селектов. На сделках, где оно было выбрано,
              поле станет пустым.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
              onClick={submitDeleteItem}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
