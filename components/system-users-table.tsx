"use client"

import { useState } from "react"
import type { SystemUser } from "@/app/actions/users"
import { deleteSystemUser } from "@/app/actions/users"
import { useAuth } from "@/context/auth-context"

const PROTECTED_EMAIL = "bocan.anton@mail.ru"
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
import { SystemUserEditDialog } from "./system-user-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "@/hooks/use-toast"

export function SystemUsersTable({ data }: { data: SystemUser[] }) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null)
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const currentEmail = currentUser?.email

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
        <Button
          onClick={() => setIsCreating(true)}
          className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Создать пользователя
        </Button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden mt-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
              <TableHead className="text-gray-700 font-medium">Полное имя</TableHead>
              <TableHead className="text-gray-700 font-medium">Email</TableHead>
              <TableHead className="text-gray-700 font-medium">Телефон</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-yellow-50/40 transition-colors"
                >
                  <TableCell className="font-medium text-gray-900">{user.full_name}</TableCell>
                  <TableCell className="text-gray-700">{user.email}</TableCell>
                  <TableCell className="text-gray-700">{user.phone}</TableCell>
                  <TableCell>
                    {!(user.email === PROTECTED_EMAIL && currentEmail !== PROTECTED_EMAIL) && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingUser(user)}
                          className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Редактировать</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeletingUser(user)}
                          className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Удалить</span>
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
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
