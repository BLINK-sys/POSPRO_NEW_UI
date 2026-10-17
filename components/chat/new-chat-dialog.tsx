"use client"

/**
 * Модалка «Новый чат» на /admin/chat.
 *  1. Выбор типа: личка (direct) или группа (group).
 *  2. Для direct — выбираем одного юзера из списка через
 *     EntityPickerDialog. Backend возвращает существующую комнату если
 *     уже есть — открываем её.
 *  3. Для group — вводим название + отмечаем нескольких юзеров
 *     чекбоксами.
 */

import { useEffect, useMemo, useState } from "react"
import { Loader2, UserRound, Users2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { crmPost } from "@/lib/crm-fetch"
import type { ChatRoomSummary } from "@/lib/chat-types"

interface Sys {
  id: number
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  users: Sys[]
  currentUserId: number | null
  onCreated: (room: ChatRoomSummary) => void
}

type Mode = "choose" | "direct" | "group"

export default function NewChatDialog({
  open, onOpenChange, users, currentUserId, onCreated,
}: Props) {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>("choose")
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [groupName, setGroupName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode("choose")
    setQ("")
    setSelected(new Set())
    setGroupName("")
  }, [open])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return users
      .filter((u) => u.id !== currentUserId)
      .filter((u) => !ql || userName(u).toLowerCase().includes(ql) || (u.email || "").toLowerCase().includes(ql))
      .sort((a, b) => userName(a).localeCompare(userName(b)))
  }, [users, q, currentUserId])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const submitDirect = async (userId: number) => {
    setSaving(true)
    try {
      const res = await crmPost<{ room: ChatRoomSummary }>(
        "/api/admin/chat/rooms/direct",
        { user_id: userId },
      )
      toast({ title: "Личка открыта" })
      onCreated(res.room)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось открыть личку",
        description: e?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const submitGroup = async () => {
    const name = groupName.trim()
    if (!name) {
      toast({ variant: "destructive", title: "Введите название группы" })
      return
    }
    if (selected.size === 0) {
      toast({ variant: "destructive", title: "Выберите хотя бы одного участника" })
      return
    }
    setSaving(true)
    try {
      const res = await crmPost<{ room: ChatRoomSummary }>(
        "/api/admin/chat/rooms",
        { name, member_user_ids: Array.from(selected) },
      )
      toast({ title: "Группа создана" })
      onCreated(res.room)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось создать группу",
        description: e?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose" && "Новый чат"}
            {mode === "direct" && "Личка — выберите человека"}
            {mode === "group" && "Группа"}
          </DialogTitle>
        </DialogHeader>

        {mode === "choose" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("direct")}
              className="rounded-xl border border-gray-200 hover:border-brand-yellow hover:bg-yellow-50 p-4 text-left focus:outline-none"
            >
              <UserRound className="h-6 w-6 text-gray-700 mb-2" />
              <div className="text-sm font-medium">Личка</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Один-на-один
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("group")}
              className="rounded-xl border border-gray-200 hover:border-brand-yellow hover:bg-yellow-50 p-4 text-left focus:outline-none"
            >
              <Users2 className="h-6 w-6 text-gray-700 mb-2" />
              <div className="text-sm font-medium">Группа</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Несколько участников
              </div>
            </button>
          </div>
        )}

        {(mode === "direct" || mode === "group") && (
          <div className="space-y-3">
            {mode === "group" && (
              <div className="space-y-1">
                <Label>Название группы *</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Например «Проект X»"
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>{mode === "direct" ? "С кем" : "Участники"}</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск по имени / email"
              />
            </div>

            <div className="max-h-[40vh] overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6">
                  {q ? "Никто не найден" : "Нет пользователей"}
                </div>
              ) : (
                filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    selectable={mode === "group"}
                    selected={selected.has(u.id)}
                    onSelectToggle={() => toggle(u.id)}
                    onDirect={() => submitDirect(u.id)}
                    disabled={saving}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {mode !== "choose" && (
            <Button variant="ghost" onClick={() => setMode("choose")} disabled={saving}>
              Назад
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          {mode === "group" && (
            <Button
              onClick={submitGroup}
              disabled={saving}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Создать группу
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================

function UserRow({
  user, selectable, selected, onSelectToggle, onDirect, disabled,
}: {
  user: Sys
  selectable: boolean
  selected: boolean
  onSelectToggle: () => void
  onDirect: () => void
  disabled: boolean
}) {
  const name = userName(user)
  const initials = getInitials(name)
  const content = (
    <>
      <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-700 text-xs font-medium flex items-center justify-center shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{name}</div>
        {user.email && (
          <div className="text-[11px] text-gray-500 truncate">{user.email}</div>
        )}
      </div>
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelectToggle}
          className={cn(
            "h-4 w-4 rounded border-gray-300 text-brand-yellow shrink-0 cursor-pointer",
            "focus:ring-brand-yellow",
          )}
        />
      )}
    </>
  )
  if (selectable) {
    return (
      <button
        type="button"
        onClick={onSelectToggle}
        disabled={disabled}
        className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-gray-50 text-left disabled:opacity-50"
      >
        {content}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onDirect}
      disabled={disabled}
      className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-gray-50 text-left disabled:opacity-50"
    >
      {content}
    </button>
  )
}

function userName(u: Sys): string {
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `#${u.id}`
  )
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
