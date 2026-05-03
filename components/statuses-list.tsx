"use client"

import { useState } from "react"
import { type Status, deleteStatus } from "@/app/actions/meta"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusEditDialog } from "./status-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"
import { PlusCircle, Pencil, Trash2 } from "lucide-react"

export function StatusesList({ statuses }: { statuses: Status[] }) {
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editingStatus, setEditingStatus] = useState<Status | null>(null)
  const [deletingStatus, setDeletingStatus] = useState<Status | null>(null)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!deletingStatus) return
    const result = await deleteStatus(deletingStatus.id)
    if (result.success) {
      toast({ title: "Успех!", description: result.message })
    } else {
      toast({ variant: "destructive", title: "Ошибка", description: result.error })
    }
    setDeletingStatus(null)
  }

  return (
    <>
      <div className="flex justify-end mt-4">
        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Создать статус
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
        {statuses.map((status) => (
          <Card
            key={status.id}
            className="relative group overflow-hidden rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all"
          >
            <div className="p-4">
              <div
                style={{ backgroundColor: status.background_color, color: status.text_color }}
                className="p-2 rounded-md text-center font-semibold text-sm"
              >
                {status.name}
              </div>
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p className="truncate">Фон: {status.background_color}</p>
                <p className="truncate">Текст: {status.text_color}</p>
              </div>
            </div>
            {/* Оверлей с кнопками */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex space-x-3">
                <Button
                  size="sm"
                  onClick={() => setEditingStatus(status)}
                  className="h-9 w-9 p-0 rounded-full bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => setDeletingStatus(status)}
                  className="h-9 w-9 p-0 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-[0_2px_6px_rgba(220,38,38,0.30)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.40)] transition-shadow"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isCreateOpen && <StatusEditDialog onClose={() => setCreateOpen(false)} />}
      {editingStatus && <StatusEditDialog status={editingStatus} onClose={() => setEditingStatus(null)} />}
      {deletingStatus && (
        <DeleteConfirmationDialog
          open={!!deletingStatus}
          onOpenChange={(open) => !open && setDeletingStatus(null)}
          onConfirm={handleDelete}
          title={`Удалить статус "${deletingStatus.name}"?`}
          description="Это действие нельзя будет отменить."
        />
      )}
    </>
  )
}
