import { ProfileSidebar } from "../../components/profile-sidebar"

// Отключаем статическую генерацию для страниц профиля
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <ProfileSidebar />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
