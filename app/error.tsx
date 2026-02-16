"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App Error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <h2 className="text-xl font-semibold mb-2">Что-то пошло не так</h2>
      <p className="text-sm text-gray-500 mb-4 text-center">{error.message}</p>
      <div className="flex gap-3">
        <Button onClick={reset} className="bg-brand-yellow text-black hover:bg-yellow-500">
          Попробовать снова
        </Button>
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          На главную
        </Button>
      </div>
    </div>
  )
}
