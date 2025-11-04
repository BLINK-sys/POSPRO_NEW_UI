import { getSuppliers } from "@/app/actions/suppliers"
import { SuppliersManagement } from "@/components/suppliers-management"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SuppliersPage() {
  const suppliers = await getSuppliers()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Поставщики</CardTitle>
        <CardDescription>Управление справочником поставщиков. Создание, редактирование, удаление и поиск поставщиков.</CardDescription>
      </CardHeader>
      <CardContent>
        <SuppliersManagement initialSuppliers={suppliers} />
      </CardContent>
    </Card>
  )
}

