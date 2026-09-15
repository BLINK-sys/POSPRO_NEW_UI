import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"

interface AdminInDevelopmentProps {
  title?: string
  description?: string
}

/**
 * Общая заглушка для админ-разделов, которые ещё не реализованы.
 * Используется, например, стабами CRM (Сделки/Задачи/Чат) на этапе 2
 * двумодовой навигации — пока идёт реализация backend-моделей.
 */
export default function AdminInDevelopment({
  title = "Пока в разработке",
  description = "Этот раздел скоро будет доступен",
}: AdminInDevelopmentProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-6 pt-6 pb-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          <Image
            src="/7VVE.gif"
            alt="В разработке"
            width={300}
            height={200}
            unoptimized
            className="rounded-lg"
          />
        </CardContent>
      </Card>
    </div>
  )
}
