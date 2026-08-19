"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCompare } from "@/context/compare-context"

/**
 * Модалка подтверждения замены сравнения при попытке добавить товар из
 * другой категории. Открывается автоматически, когда контекст переходит
 * в состояние `pendingReplace`.
 */
export function CompareReplaceDialog() {
  const { pendingReplace, confirmReplace, cancelReplace } = useCompare()
  const open = !!pendingReplace

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) cancelReplace() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Товар из другой категории</DialogTitle>
          <DialogDescription>
            В сравнении сейчас {pendingReplace?.currentCategoryName
              ? <>товары из категории <b>«{pendingReplace.currentCategoryName}»</b></>
              : <>товары другой категории</>}.
            Сравнение работает только внутри одной категории — можно очистить
            текущее и начать новое.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={cancelReplace}>
            Отмена
          </Button>
          <Button
            className="bg-brand-yellow text-black hover:bg-yellow-500"
            onClick={confirmReplace}
          >
            Очистить и добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
