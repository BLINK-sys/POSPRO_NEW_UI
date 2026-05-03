"use client"

import { useEffect, useState, useTransition } from "react"
import type { Client, UserActionState } from "@/app/actions/users"
import { saveClient } from "@/app/actions/users"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const FOCUS_NO_RING =
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  FOCUS_NO_RING
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface ClientEditDialogProps {
  client?: Client | null
  onClose: () => void
}

export function ClientEditDialog({ client, onClose }: ClientEditDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<UserActionState>({ success: false })
  const [orgType, setOrgType] = useState(client?.organization_type ?? "individual")
  const [isWholesale, setIsWholesale] = useState<boolean>(client?.is_wholesale ?? false)

  const isEditMode = !!client

  const handleSubmit = async (formData: FormData) => {
    console.log("Form submitted with data:", Object.fromEntries(formData.entries()))
    startTransition(async () => {
      try {
        const result = await saveClient(state, formData)
        console.log("Save result:", result)
        setState(result)
        
        if (result.success) {
          toast({ title: "Успех!", description: result.message })
          onClose()
        } else {
          toast({ variant: "destructive", title: "Ошибка", description: result.error })
        }
      } catch (error) {
        console.error("Error saving client:", error)
        toast({ variant: "destructive", title: "Ошибка", description: "Произошла ошибка при сохранении клиента" })
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Редактировать клиента" : "Создать клиента"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Внесите изменения и нажмите 'Сохранить'." : "Заполните данные для создания нового клиента."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          handleSubmit(formData)
        }}>
          {isEditMode && <input type="hidden" name="id" value={client.id} />}
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Тип организации</Label>
              <RadioGroup
                name="organization_type"
                value={orgType}
                onValueChange={(value) => setOrgType(value as Client["type"])}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="individual" />
                  <Label htmlFor="individual">Физ. лицо</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ip" id="ip" />
                  <Label htmlFor="ip">ИП</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="too" id="too" />
                  <Label htmlFor="too">ТОО</Label>
                </div>
              </RadioGroup>
            </div>

            {orgType === "individual" && (
              <div className="space-y-2">
                <Label htmlFor="full_name">Полное имя (ФИО)</Label>
                <Input name="full_name" defaultValue={client?.name ?? ""} className={SOFT_CONTROL} />
              </div>
            )}
            {orgType === "ip" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ip_name">Название ИП</Label>
                  <Input name="ip_name" defaultValue={client?.name ?? ""} className={SOFT_CONTROL} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iin">ИИН</Label>
                  <Input name="iin" defaultValue={client?.identifier ?? ""} className={SOFT_CONTROL} />
                </div>
              </>
            )}
            {orgType === "too" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="too_name">Название ТОО</Label>
                  <Input name="too_name" defaultValue={client?.name ?? ""} className={SOFT_CONTROL} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bin">БИН</Label>
                  <Input name="bin" defaultValue={client?.identifier ?? ""} className={SOFT_CONTROL} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input name="email" type="email" defaultValue={client?.email ?? ""} required className={SOFT_CONTROL} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input name="phone" type="tel" defaultValue={client?.phone ?? ""} required className={SOFT_CONTROL} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_address">Адрес доставки</Label>
              <Input name="delivery_address" defaultValue={client?.delivery_address ?? ""} required className={SOFT_CONTROL} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is_wholesale">Оптовый покупатель</Label>
                <p className="text-sm text-muted-foreground">
                  Включить оптовые скидки для этого клиента
                </p>
              </div>
              <Switch
                id="is_wholesale"
                checked={isWholesale}
                onCheckedChange={setIsWholesale}
              />
              <input type="hidden" name="is_wholesale" value={isWholesale ? "true" : "false"} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                name="password"
                type="password"
                placeholder={isEditMode ? "Оставьте пустым, чтобы не менять" : ""}
                required={!isEditMode}
                className={SOFT_CONTROL}
              />
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
