import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"

export default function AdminSettingsPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-6 pt-6 pb-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Пока в разработке</h2>
            <p className="text-muted-foreground text-sm">
              Этот раздел скоро будет доступен
            </p>
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
