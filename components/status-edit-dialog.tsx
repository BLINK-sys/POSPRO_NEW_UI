"use client"

import { useEffect, useState, useTransition } from "react"
import { saveStatus, type Status, type MetaActionState } from "@/app/actions/meta"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface StatusEditDialogProps {
  status?: Status | null
  onClose: () => void
}

export function StatusEditDialog({ status, onClose }: StatusEditDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<MetaActionState>({ success: false })
  
  // Для статусов ID обязателен даже при создании
  const initialId = status?.id ?? Date.now() // Генерируем временный ID для новых

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await saveStatus(formData)
        setState(result)
        
        if (result.success) {
          toast({ title: "Успех!", description: result.message })
          onClose()
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.error })
        }
      } catch (error) {
        console.error("Error saving status:", error)
        toast({ variant: "destructive", title: "Ошибка", description: "Произошла ошибка при сохранении статуса" })
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{status ? "Редактировать статус" : "Создать статус"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          handleSubmit(formData)
        }}>
          <input type="hidden" name="id" value={initialId} />
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input name="name" defaultValue={status?.name ?? ""} required className={SOFT_CONTROL} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="background_color">Цвет фона</Label>
              <Input name="background_color" type="color" defaultValue={status?.background_color ?? "#ffffff"} className={cn("h-10 cursor-pointer", SOFT_CONTROL)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text_color">Цвет текста</Label>
              <Input name="text_color" type="color" defaultValue={status?.text_color ?? "#000000"} className={cn("h-10 cursor-pointer", SOFT_CONTROL)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className={SECONDARY_BTN}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending} className={PRIMARY_BTN}>
              {isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
