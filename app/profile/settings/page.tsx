import { redirect } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { getProfile } from "@/app/actions/auth"
import { ProfileForm } from "@/components/profile-form"
import MobilePageWrapper from "@/components/mobile/mobile-page-wrapper"
import MobileProfileSettings from "@/components/mobile/mobile-profile-settings"

export default async function ProfileSettingsPage() {
  const user = await getProfile()

  if (!user) {
    redirect("/auth")
  }

  return (
    <MobilePageWrapper
      mobileComponent={<MobileProfileSettings />}
      desktopContent={
        <div className="container mx-auto max-w-3xl py-10">
          <Card>
            <CardHeader>
              <CardTitle>Настройки профиля</CardTitle>
              <CardDescription>Управление настройками вашего аккаунта.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm initialData={user} />
            </CardContent>
          </Card>
        </div>
      }
    />
  )
}
