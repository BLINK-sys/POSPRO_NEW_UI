"use client"

import { useState, useTransition } from "react"
import { type Supplier, deleteSupplier } from "@/app/actions/suppliers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusCircle, Edit, Trash2, Search, X } from "lucide-react"
import { SupplierEditDialog } from "./supplier-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"

interface SuppliersManagementProps {
  initialSuppliers: Supplier[]
}

export function SuppliersManagement({ initialSuppliers }: SuppliersManagementProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    startTransition(async () => {
      try {
        const { getSuppliers } = await import("@/app/actions/suppliers")
        const results = await getSuppliers(query)
        setSuppliers(results)
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось выполнить поиск",
        })
      }
    })
  }

  const handleDelete = () => {
    if (!deletingSupplier) return

    startTransition(async () => {
      const result = await deleteSupplier(deletingSupplier.id)
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
        setSuppliers(suppliers.filter((s) => s.id !== deletingSupplier.id))
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
      setDeletingSupplier(null)
    })
  }

  const handleSupplierSaved = (supplier: Supplier, isNew: boolean) => {
    if (isNew) {
      setSuppliers([...suppliers, supplier])
    } else {
      setSuppliers(suppliers.map((s) => (s.id === supplier.id ? supplier : s)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск по названию, контакту, телефону, email..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => handleSearch("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={isPending}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Добавить поставщика
        </Button>
      </div>

      {suppliers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Список поставщиков ({suppliers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Контактное лицо</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contact_person || "-"}</TableCell>
                    <TableCell>{supplier.phone || "-"}</TableCell>
                    <TableCell>{supplier.email || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{supplier.address || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSupplier(supplier)}
                          disabled={isPending}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Редактировать
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeletingSupplier(supplier)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <PlusCircle className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-muted-foreground text-lg">
              {searchQuery ? "Поставщики не найдены" : "Поставщики не найдены."}
            </p>
            {!searchQuery && (
              <p className="text-muted-foreground text-sm mt-1">
                Добавьте первого поставщика, чтобы начать работу
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isCreating && (
        <SupplierEditDialog
          onClose={() => setIsCreating(false)}
          onSaved={handleSupplierSaved}
        />
      )}
      {editingSupplier && (
        <SupplierEditDialog
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSaved={handleSupplierSaved}
        />
      )}
      <DeleteConfirmationDialog
        open={!!deletingSupplier}
        onOpenChange={(open) => !open && setDeletingSupplier(null)}
        onConfirm={handleDelete}
        title={`Удалить поставщика "${deletingSupplier?.name}"?`}
        description="Это действие нельзя будет отменить."
      />
    </div>
  )
}

