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
import { cn } from "@/lib/utils"

const SOFT_CONTROL =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow " +
  "focus:ring-0 focus:ring-offset-0 focus:outline-none " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
const PRIMARY_BTN =
  "rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"

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
            className={cn("pl-10 pr-10 h-10", SOFT_CONTROL)}
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              onClick={() => handleSearch("")}
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={isPending} className={PRIMARY_BTN}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Добавить поставщика
        </Button>
      </div>

      {suppliers.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/60">
            <h4 className="font-medium">Список поставщиков ({suppliers.length})</h4>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                <TableHead className="text-gray-700 font-medium">ID</TableHead>
                <TableHead className="text-gray-700 font-medium">Название</TableHead>
                <TableHead className="text-gray-700 font-medium">Контактное лицо</TableHead>
                <TableHead className="text-gray-700 font-medium">Телефон</TableHead>
                <TableHead className="text-gray-700 font-medium">Email</TableHead>
                <TableHead className="text-gray-700 font-medium">Адрес</TableHead>
                <TableHead className="text-right text-gray-700 font-medium">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-yellow-50/40 transition-colors"
                >
                  <TableCell className="text-muted-foreground">{supplier.id}</TableCell>
                  <TableCell className="font-medium text-gray-900">{supplier.name}</TableCell>
                  <TableCell className="text-gray-700">{supplier.contact_person || "-"}</TableCell>
                  <TableCell className="text-gray-700">{supplier.phone || "-"}</TableCell>
                  <TableCell className="text-gray-700">{supplier.email || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate text-gray-700">{supplier.address || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingSupplier(supplier)}
                        disabled={isPending}
                        className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                        title="Редактировать"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingSupplier(supplier)}
                        disabled={isPending}
                        className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
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

