"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { 
  HOMEPAGE_BLOCK_TYPES, 
  HOMEPAGE_BLOCK_TYPE_LABELS, 
  TITLE_ALIGN_OPTIONS,
  HomepageBlock, 
  CreateHomepageBlockData 
} from "@/lib/constants"
import { createHomepageBlock, updateHomepageBlock } from "@/app/actions/homepage-blocks"
import { Badge } from "@/components/ui/badge"
import { ElementsSelectionDialog } from "./elements-selection-dialog"
import SelectedElementsDisplay from "./selected-elements-display"
import { cn } from "@/lib/utils"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
const SECONDARY_BTN =
  "rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"

interface HomepageBlockEditDialogProps {
  block: HomepageBlock | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function HomepageBlockEditDialog({ 
  block, 
  open, 
  onOpenChange, 
  onSuccess 
}: HomepageBlockEditDialogProps) {
  const [formData, setFormData] = useState<CreateHomepageBlockData>({
    title: "",
    description: "",
    type: HOMEPAGE_BLOCK_TYPES.CATEGORIES,
    active: true,
    carusel: false,
    show_title: true,
    title_align: "left",
    items: [],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [elementsSelectionOpen, setElementsSelectionOpen] = useState(false)
  const { toast } = useToast()

  // Инициализация формы при открытии диалога
  useEffect(() => {
    if (open) {
      if (block) {
        // Режим редактирования
        setFormData({
          title: block.title,
          description: block.description || "",
          type: block.type,
          active: block.active,
          carusel: block.carusel,
          show_title: block.show_title,
          title_align: block.title_align,
          items: block.items,
        })
      } else {
        // Режим создания
        setFormData({
          title: "",
          description: "",
          type: HOMEPAGE_BLOCK_TYPES.CATEGORIES,
          active: true,
          carusel: false,
          show_title: true,
          title_align: "left",
          items: [],
        })
      }
    }
  }, [open, block])

  const handleInputChange = useCallback((field: keyof CreateHomepageBlockData, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Если изменился тип блока и он не поддерживает карусель, отключаем карусель
      if (field === 'type') {
        const isCarouselDisabled = value === HOMEPAGE_BLOCK_TYPES.BENEFITS || 
                                   value === HOMEPAGE_BLOCK_TYPES.BRANDS || 
                                   value === HOMEPAGE_BLOCK_TYPES.INFO_CARDS
        
        if (isCarouselDisabled) {
          newData.carusel = false
        }
      }
      
      return newData
    })
  }, [])

  const handleItemsChange = useCallback((items: number[]) => {
    setFormData(prev => ({ ...prev, items }))
  }, [])

  const handleRemoveItem = useCallback((itemId: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter(id => id !== itemId) || []
    }))
  }, [])

  const handleClearAllItems = useCallback(() => {
    setFormData(prev => ({ ...prev, items: [] }))
  }, [])

  // Определяем, должен ли переключатель "Карусель" быть отключен
  const isCarouselDisabled = useMemo(() => {
    return formData.type === HOMEPAGE_BLOCK_TYPES.BENEFITS || 
           formData.type === HOMEPAGE_BLOCK_TYPES.BRANDS || 
           formData.type === HOMEPAGE_BLOCK_TYPES.INFO_CARDS
  }, [formData.type])



  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast({
        title: "Ошибка",
        description: "Название блока обязательно",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      
      const formDataObj = new FormData()
      formDataObj.append("title", formData.title)
      formDataObj.append("description", formData.description || "")
      formDataObj.append("type", formData.type)
      formDataObj.append("active", (formData.active ?? true).toString())
      formDataObj.append("carusel", (formData.carusel ?? false).toString())
      formDataObj.append("show_title", (formData.show_title ?? true).toString())
      formDataObj.append("title_align", formData.title_align ?? "left")
      formDataObj.append("items", JSON.stringify(formData.items ?? []))

      let result
      if (block) {
        // Обновление существующего блока
        result = await updateHomepageBlock(block.id, {}, formDataObj)
      } else {
        // Создание нового блока
        result = await createHomepageBlock({}, formDataObj)
      }
      
      if (result.success) {
        toast({
          title: "Успешно",
          description: result.message,
        })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({
          title: "Ошибка",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving block:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить блок",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, block, toast, onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] max-h-[90vh] w-[95vw] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 flex-shrink-0">
          <DialogTitle>
            {block ? "Редактировать блок" : "Создать новый блок"}
          </DialogTitle>
          <DialogDescription>
            Настройте параметры блока и выберите элементы для отображения
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-h-0 px-6 py-4">
            {/* Колонка 1 — Основные настройки */}
            <div className="space-y-3 min-h-0">
              <h3 className="text-base font-semibold">Основные настройки</h3>

              <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="title">Название блока</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Введите название блока"
                      className={SOFT_CONTROL}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Описание блока</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ""}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder="Введите описание блока (необязательно)"
                      rows={2}
                      className={cn("resize-none", SOFT_CONTROL)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Тип блока</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleInputChange("type", value)}
                    >
                      <SelectTrigger className={SOFT_CONTROL}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(HOMEPAGE_BLOCK_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title_align">Выравнивание заголовка</Label>
                    <Select
                      value={formData.title_align}
                      onValueChange={(value) => handleInputChange("title_align", value)}
                    >
                      <SelectTrigger className={SOFT_CONTROL}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TITLE_ALIGN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

            {/* Колонка 2 — Настройки отображения */}
            <div className="space-y-3 min-h-0">
              <h3 className="text-base font-semibold">Настройки отображения</h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <div>
                    <Label htmlFor="active" className="cursor-pointer text-sm">Статус</Label>
                    <p className="text-xs text-muted-foreground">
                      Блок будет отображаться на главной странице
                    </p>
                  </div>
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => handleInputChange("active", checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <div>
                    <Label htmlFor="carusel" className="cursor-pointer text-sm">Карусель</Label>
                    <p className="text-xs text-muted-foreground">
                      {isCarouselDisabled
                        ? "Недоступно для данного типа блока"
                        : "Отображать элементы в виде карусели"
                      }
                    </p>
                  </div>
                  <Switch
                    id="carusel"
                    checked={formData.carusel}
                    disabled={isCarouselDisabled}
                    onCheckedChange={(checked) => handleInputChange("carusel", checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <div>
                    <Label htmlFor="show_title" className="cursor-pointer text-sm">Показывать заголовок</Label>
                    <p className="text-xs text-muted-foreground">
                      Отображать заголовок блока на странице
                    </p>
                  </div>
                  <Switch
                    id="show_title"
                    checked={formData.show_title}
                    onCheckedChange={(checked) => handleInputChange("show_title", checked)}
                  />
                </div>
              </div>
            </div>

            {/* Колонка 3 — Выбор элементов */}
            <div className="flex flex-col min-h-0">
              {/* Шапка колонки: заголовок + бейдж типа в одной строке,
                  кнопка «Выбрать элементы» — отдельной строкой на всю ширину.
                  Так колонка одинаково хорошо смотрится при любой ширине. */}
              <div className="flex-shrink-0 mb-3 space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Выбор элементов</h3>
                  <Badge variant="outline" className="text-xs">
                    {HOMEPAGE_BLOCK_TYPE_LABELS[formData.type]}
                  </Badge>
                </div>
                <Button
                  type="button"
                  onClick={() => setElementsSelectionOpen(true)}
                  className={cn("w-full flex items-center justify-center gap-2", PRIMARY_BTN)}
                >
                  <Plus className="h-4 w-4" />
                  <span>Выбрать элементы</span>
                </Button>
              </div>

            {/* Контейнер для списка элементов — карточка фиксированной высоты,
                внутри список прокручивается. Сама карточка не скроллится. */}
            <div className="flex-1 min-h-0 rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
              <SelectedElementsDisplay
                blockType={formData.type}
                selectedItemIds={formData.items || []}
                onRemoveItem={handleRemoveItem}
                onClearAll={handleClearAllItems}
                className="h-full"
              />
            </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-gray-50/50">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className={SECONDARY_BTN}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting} className={PRIMARY_BTN}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {block ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>

        {/* Диалог выбора элементов */}
        <ElementsSelectionDialog
          open={elementsSelectionOpen}
          onOpenChange={setElementsSelectionOpen}
          blockType={formData.type}
          selectedItems={formData.items || []}
          onItemsChange={handleItemsChange}
        />
      </DialogContent>
    </Dialog>
  )
} 