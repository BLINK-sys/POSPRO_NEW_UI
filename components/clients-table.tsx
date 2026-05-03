"use client"

import { useState } from "react"
import type { Client } from "@/app/actions/users"
import { deleteClient } from "@/app/actions/users"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, PlusCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClientEditDialog } from "./client-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"

const typeTranslations: Record<Client["organization_type"], string> = {
  individual: "Физ. лицо",
  ip: "ИП",
  too: "ТОО",
}

export function ClientsTable({ data }: { data: Client[] }) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!deletingClient) return
    const result = await deleteClient(deletingClient.id)
    if (result.success) {
      toast({ title: "Успех!", description: "Клиент успешно удален." })
    } else {
      toast({ variant: "destructive", title: "Ошибка", description: result.error })
    }
    setDeletingClient(null)
  }

  return (
    <>
      <div className="flex justify-end mt-4">
        <Button
          onClick={() => setIsCreating(true)}
          className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Создать клиента
        </Button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden mt-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
              <TableHead className="text-gray-700 font-medium">Тип</TableHead>
              <TableHead className="text-gray-700 font-medium">Имя / Название</TableHead>
              <TableHead className="text-gray-700 font-medium">Email</TableHead>
              <TableHead className="text-gray-700 font-medium">Телефон</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((client) => (
                <TableRow
                  key={client.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-yellow-50/40 transition-colors"
                >
                  <TableCell>{typeTranslations[client.organization_type]}</TableCell>
                  <TableCell className="font-medium text-gray-900">{client.name}</TableCell>
                  <TableCell className="text-gray-700">{client.email}</TableCell>
                  <TableCell className="text-gray-700">{client.phone}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingClient(client)}
                        className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Редактировать</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingClient(client)}
                        className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Удалить</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                  Нет данных.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {editingClient && <ClientEditDialog client={editingClient} onClose={() => setEditingClient(null)} />}
      {isCreating && <ClientEditDialog onClose={() => setIsCreating(false)} />}
      <DeleteConfirmationDialog
        open={!!deletingClient}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        onConfirm={handleDelete}
        title={`Удалить клиента "${deletingClient?.name}"?`}
        description="Это действие нельзя будет отменить. Все связанные данные будут удалены."
      />
    </>
  )
}
