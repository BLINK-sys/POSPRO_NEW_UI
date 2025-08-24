"use client"

import { useState } from "react"
import type { Client } from "@/app/actions/users"
import { deleteClient } from "@/app/actions/users"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, PlusCircle } from "lucide-react"
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

const typeTranslations: Record<Client["type"], string> = {
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
        <Button onClick={() => setIsCreating(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Создать клиента
        </Button>
      </div>
      <div className="rounded-md border mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Имя / Название</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.id}</TableCell>
                  <TableCell>{typeTranslations[client.type]}</TableCell>
                  <TableCell>{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Действия</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setEditingClient(client)}>Редактировать</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingClient(client)} className="text-red-600">
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
        title={`Удалить клиента "${deletingClient?.name}"?`}
        description="Это действие нельзя будет отменить. Все связанные данные будут удалены."
      />
    </>
  )
}
