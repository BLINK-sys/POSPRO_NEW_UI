"use client"

import { useState } from "react"
import type { SystemUser } from '../app/actions/users'
import { deleteSystemUser } from '../app/actions/users'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'
import { MoreHorizontal, PlusCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { SystemUserEditDialog } from "./system-user-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"

export function SystemUsersTable({ data }: { data: SystemUser[] }) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!deletingUser) return
    const result = await deleteSystemUser(deletingUser.id)
    if (result.success) {
      toast({ title: "Успех!", description: "Пользователь успешно удален." })
    } else {
      toast({ variant: "destructive", title: "Ошибка", description: result.error })
    }
    setDeletingUser(null)
  }

  return (
    <>
      <div className="flex justify-end mt-4">
        <Button onClick={() => setIsCreating(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Создать пользователя
        </Button>
      </div>
      <div className="rounded-md border mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Полное имя</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.id}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
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
                        <DropdownMenuItem onClick={() => setEditingUser(user)}>Редактировать</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingUser(user)} className="text-red-600">
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Нет данных.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {editingUser && <SystemUserEditDialog user={editingUser} onClose={() => setEditingUser(null)} />}
      {isCreating && <SystemUserEditDialog onClose={() => setIsCreating(false)} />}
      <DeleteConfirmationDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        onConfirm={handleDelete}
        title={`Удалить пользователя "${deletingUser?.full_name}"?`}
        description="Это действие нельзя будет отменить."
      />
    </>
  )
}
