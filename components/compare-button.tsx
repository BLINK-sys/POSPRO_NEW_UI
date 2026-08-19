"use client"

import { Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCompare, COMPARE_MAX } from "@/context/compare-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface CompareButtonProps {
  productId: number
  productName: string
  productSlug: string
  categoryId?: number
  categoryName?: string
  className?: string
}

/**
 * Кнопка «Сравнить» — иконка в стопке правого-верхнего угла карточки
 * товара (рядом с лупой быстрого просмотра и сердечком избранного).
 * Toggle: клик добавляет / убирает. При попытке добавить товар из другой
 * категории — контекст поднимает `pendingReplace`, глобальная модалка
 * (`CompareReplaceDialog`) сама покажется.
 */
export function CompareButton({
  productId,
  productName,
  productSlug,
  categoryId,
  categoryName,
  className,
}: CompareButtonProps) {
  const { has, toggle } = useCompare()
  const { toast } = useToast()
  const inCompare = has(productId)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const result = toggle({ id: productId, slug: productSlug, categoryId, categoryName })
    if (result === "added") {
      toast({ title: "В сравнении", description: productName })
    } else if (result === "removed") {
      toast({ title: "Убрано из сравнения", description: productName })
    } else if (result === "full") {
      toast({
        title: "Достигнут лимит",
        description: `В сравнении может быть не больше ${COMPARE_MAX} товаров.`,
        variant: "destructive",
      })
    }
    // "conflict" → модалка появится сама, тост не нужен
  }

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="ghost"
      className={cn(
        "w-7 h-7 p-0 rounded-full shadow-md hover:shadow-lg transition-colors",
        inCompare
          ? "bg-brand-yellow hover:bg-yellow-500 text-black"
          : "bg-white/95 hover:bg-white text-gray-700 hover:text-black",
        className,
      )}
      title={inCompare ? "Убрать из сравнения" : "Добавить к сравнению"}
    >
      <Scale className="h-4 w-4" />
    </Button>
  )
}
