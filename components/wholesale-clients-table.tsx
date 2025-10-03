"use client"

import { useState } from "react"
import type { Client } from "@/app/actions/users"
import { deleteClient } from "@/app/actions/users"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Edit, Trash2, Plus } from "lucide-react"
import { ClientEditDialog } from "./client-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"

const typeTranslations: Record<Client["organization_type"], string> = {
  individual: "Физ. лицо",
  ip: "ИП",
  too: "ТОО",
}

export function WholesaleClientsTable({ data }: { data: Client[] }) {
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)

  const handleDelete = async () => {
    if (!deletingClient) return

    try {
      await deleteClient(deletingClient.id)
      setDeletingClient(null)
    } catch (error) {
      console.error("Error deleting client:", error)
    }
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Оптовые покупатели</h3>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить оптового покупателя
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Тип</TableHead>
              <TableHead>Название/ФИО</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>{typeTranslations[client.organization_type]}</TableCell>
                  <TableCell>{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingClient(client)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Редактировать</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingClient(client)}
                        className="h-8 w-8 text-red-600 hover:text-red-700"
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
                <TableCell colSpan={6} className="h-24 text-center">
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
        title={`Удалить оптового покупателя "${deletingClient?.full_name || deletingClient?.ip_name || deletingClient?.too_name}"?`}
        description="Это действие нельзя будет отменить. Все связанные данные будут удалены."
      />
    </>
  )
}
