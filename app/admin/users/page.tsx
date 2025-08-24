import { getClients, getSystemUsers } from "@/app/actions/users"
import { UserManagementTabs } from "@/components/user-management-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function UsersPage() {
  // Запрашиваем данные параллельно для ускорения загрузки
  const [clients, systemUsers] = await Promise.all([getClients(), getSystemUsers()])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Управление пользователями</CardTitle>
        <CardDescription>Просмотр, создание и редактирование клиентов и системных пользователей.</CardDescription>
      </CardHeader>
      <CardContent>
        <UserManagementTabs clients={clients} systemUsers={systemUsers} />
      </CardContent>
    </Card>
  )
}
