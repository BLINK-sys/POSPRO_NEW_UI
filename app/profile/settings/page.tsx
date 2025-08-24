import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function ProfileSettingsPage() {
  return (
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
  )
}
