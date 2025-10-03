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
      <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {block ? "Редактировать блок" : "Создать новый блок"}
          </DialogTitle>
          <DialogDescription>
            Настройте параметры блока и выберите элементы для отображения
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 h-full flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
            {/* Левая колонка - Основные настройки */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Основные настройки</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Название блока</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Введите название блока"
                      className="focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
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
                      rows={3}
                      className="resize-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Тип блока</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleInputChange("type", value)}
                    >
                      <SelectTrigger className="focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300">
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
                      <SelectTrigger className="focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300">
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

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Настройки отображения</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="active">Статус</Label>
                      <p className="text-sm text-muted-foreground">
                        Блок будет отображаться на главной странице
                      </p>
                    </div>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => handleInputChange("active", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="carusel">Карусель</Label>
                      <p className="text-sm text-muted-foreground">
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

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show_title">Показывать заголовок</Label>
                      <p className="text-sm text-muted-foreground">
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
            </div>

            {/* Правая колонка - Выбор элементов */}
          <div className="flex flex-col h-full">
            {/* Заголовок */}
            <div className="flex items-center justify-between flex-shrink-0 mb-4">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold">Выбор элементов</h3>
                <Badge variant="outline">
                  {HOMEPAGE_BLOCK_TYPE_LABELS[formData.type]}
                </Badge>
              </div>
              <Button
                type="button"
                onClick={() => setElementsSelectionOpen(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Выбрать элементы</span>
              </Button>
              </div>
              
                         {/* Контейнер для списка элементов */}
             <div className="border rounded-lg p-4" style={{ height: '400px' }}>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
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