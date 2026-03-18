import { cn } from "@/lib/utils"

interface AdminLoadingProps {
  /** Текст под гифкой */
  text?: string
  /** Размер: sm (кнопки), md (секции), lg (страницы) */
  size?: "sm" | "md" | "lg"
  /** Дополнительные классы контейнера */
  className?: string
}

export default function AdminLoading({ text, size = "md", className }: AdminLoadingProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-16",
    lg: "h-24",
  }

  const containerClasses = {
    sm: "",
    md: "p-8",
    lg: "p-16",
  }

  return (
    <div className={cn("flex flex-col items-center justify-center", containerClasses[size], className)}>
      <img src="/loading.gif" alt="Загрузка..." className={sizeClasses[size]} />
      {text && <span className="mt-2 text-sm text-gray-500">{text}</span>}
    </div>
  )
}
