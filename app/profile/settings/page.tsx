import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import MobilePageWrapper from "@/components/mobile/mobile-page-wrapper"
import MobileProfilePage from "@/components/mobile/mobile-profile-page"

export default function ProfileSettingsPage() {
  return (
    <MobilePageWrapper
      mobileComponent={<MobileProfilePage />}
      desktopContent={
        <div className="container py-10">
          <Card>
            <CardHeader>
              <CardTitle>Настройки</CardTitle>
              <CardDescription>Управление настройками вашего аккаунта.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Настройки уведомлений, пароля и т.д. будут здесь.</p>
            </CardContent>
          </Card>
        </div>
      }
    />
  )
}
