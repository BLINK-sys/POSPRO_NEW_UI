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
    background_color: null,
    show_products_categories_filter: true,
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
          background_color: (block as any).background_color ?? null,
          show_products_categories_filter: (block as any).show_products_categories_filter ?? true,
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
      formDataObj.append("background_color", formData.background_color ?? "")
      formDataObj.append(
        "show_products_categories_filter",
        (formData.show_products_categories_filter ?? true).toString(),
      )
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
      <DialogContent className="w-[90vw] h-[90vh] max-w-none max-h-none flex flex-col p-0 overflow-hidden [&>button.absolute]:hidden">
        <DialogHeader className="px-6 pt-6 flex-shrink-0">
          <DialogTitle>
            {block ? "Редактировать блок" : "Создать новый блок"}
          </DialogTitle>
          <DialogDescription>
            Настройте параметры блока и выберите элементы для отображения
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-6 flex-1 min-h-0 px-6 py-4">
            {/* Левая колонка — Основные настройки + Настройки отображения
                со скроллом, снизу — кнопки Отмена / Сохранить. */}
            <div className="flex flex-col h-full min-h-0 gap-3">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
              <div className="space-y-3">
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

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="type" className="text-xs">Тип блока</Label>
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

                    <div className="space-y-1.5">
                      <Label htmlFor="title_align" className="text-xs">Выравнивание</Label>
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
              </div>

            {/* Раздел под «Основными настройками» в той же левой колонке */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Настройки отображения</h3>

              <div className="space-y-2">
                {/* Свитчи в 2 колонки — экономят место в узкой левой
                    колонке. Описание под названием — как раньше. */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <div className="min-w-0">
                      <Label htmlFor="active" className="cursor-pointer text-xs">Статус</Label>
                      <p className="text-[10px] leading-tight text-muted-foreground">
                        Показывать блок на главной
                      </p>
                    </div>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => handleInputChange("active", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <div className="min-w-0">
                      <Label htmlFor="show_title" className="cursor-pointer text-xs">Заголовок</Label>
                      <p className="text-[10px] leading-tight text-muted-foreground">
                        Показывать название блока
                      </p>
                    </div>
                    <Switch
                      id="show_title"
                      checked={formData.show_title}
                      onCheckedChange={(checked) => handleInputChange("show_title", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <div className="min-w-0">
                      <Label htmlFor="carusel" className="cursor-pointer text-xs">Карусель</Label>
                      <p className="text-[10px] leading-tight text-muted-foreground">
                        {isCarouselDisabled
                          ? "Недоступно для типа"
                          : "Элементы каруселью"}
                      </p>
                    </div>
                    <Switch
                      id="carusel"
                      checked={formData.carusel}
                      disabled={isCarouselDisabled}
                      onCheckedChange={(checked) => handleInputChange("carusel", checked)}
                    />
                  </div>

                  {formData.type === HOMEPAGE_BLOCK_TYPES.PRODUCTS && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                      <div className="min-w-0">
                        <Label htmlFor="show_products_categories_filter" className="cursor-pointer text-xs">
                          Фильтр категорий
                        </Label>
                        <p className="text-[10px] leading-tight text-muted-foreground">
                          Полоса категорий над списком
                        </p>
                      </div>
                      <Switch
                        id="show_products_categories_filter"
                        checked={formData.show_products_categories_filter ?? true}
                        onCheckedChange={(checked) => handleInputChange("show_products_categories_filter", checked)}
                      />
                    </div>
                  )}
                </div>

                {/* Кастомизация — только для блоков товаров. */}
                {formData.type === HOMEPAGE_BLOCK_TYPES.PRODUCTS && (
                  <>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                      <div className="mb-2">
                        <Label htmlFor="background_color" className="cursor-pointer text-sm">Цвет фона блока</Label>
                        <p className="text-xs text-muted-foreground">
                          Фон карточки-обёртки. Пусто = дефолт (светло-серый).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="background_color"
                          type="color"
                          value={formData.background_color || "#f3f4f6"}
                          onChange={(e) => handleInputChange("background_color", e.target.value)}
                          className="w-10 h-9 rounded-md border border-gray-300 cursor-pointer bg-white p-0.5"
                        />
                        <input
                          type="text"
                          value={formData.background_color ?? ""}
                          onChange={(e) => handleInputChange("background_color", e.target.value || null)}
                          placeholder="#RRGGBB"
                          className="flex-1 h-9 px-2 rounded-md border border-gray-300 bg-white text-sm font-mono focus:outline-none focus:border-brand-yellow"
                        />
                        {formData.background_color && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleInputChange("background_color", null)}
                            title="Сбросить на дефолт"
                            className="h-9"
                          >
                            Сброс
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
              </div>

              {/* Кнопки внизу левой колонки — вместо общей DialogFooter,
                  в одну строку 50/50. */}
              <div className="border-t pt-3 flex gap-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className={cn("flex-1", SECONDARY_BTN)}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={isSubmitting} className={cn("flex-1", PRIMARY_BTN)}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {block ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </div>

            {/* Правая колонка — маленькая кнопка «+ Выбрать» в шапке,
                остальную высоту занимает список выбранных карточек. */}
            <div className="flex flex-col h-full min-h-0">
              <div className="flex-shrink-0 mb-3 flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold">Выбор элементов</h3>
                <Badge variant="outline" className="text-xs">
                  {HOMEPAGE_BLOCK_TYPE_LABELS[formData.type]}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setElementsSelectionOpen(true)}
                  className={cn("ml-auto h-8 gap-1.5", PRIMARY_BTN)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Выбрать</span>
                </Button>
              </div>

              <div className="flex-1 min-h-0 rounded-xl border border-gray-200 bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <SelectedElementsDisplay
                  blockType={formData.type}
                  selectedItemIds={formData.items || []}
                  onRemoveItem={handleRemoveItem}
                  onClearAll={handleClearAllItems}
                  className="h-full"
                  layout="grid"
                />
              </div>
            </div>
          </div>
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