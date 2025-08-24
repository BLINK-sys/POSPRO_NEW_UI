import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getProfile } from "@/app/actions/auth"
import { ProfileForm } from "@/components/profile-form"

export default async function ProfilePage() {
  const user = await getProfile()

  // Если пользователь не авторизован, перенаправляем на страницу входа
  if (!user) {
    redirect("/auth")
  }

  return (
    <div className="container mx-auto max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Мой профиль</CardTitle>
          <CardDescription>Здесь вы можете просмотреть и отредактировать свои данные.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm initialData={user} />
        </CardContent>
      </Card>
    </div>
  )
}
