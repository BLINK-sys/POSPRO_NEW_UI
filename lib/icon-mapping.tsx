import React from "react"
import {
  Truck,
  Shield,
  Clock,
  Headphones,
  Star,
  Award,
  Zap,
  Heart,
  Archive,
  ALargeSmall,
  AlignHorizontalSpaceBetween,
  Album,
  AlignHorizontalJustifyEnd,
  HelpCircle,
} from "lucide-react"

// Общий маппинг иконок для всего приложения
export const iconMap: { [key: string]: React.ElementType } = {
  truck: Truck,
  shield: Shield,
  clock: Clock,
  headphones: Headphones,
  star: Star,
  award: Award,
  zap: Zap,
  heart: Heart,
  Archive: Archive,
  ALargeSmall: ALargeSmall,
  AlignHorizontalSpaceBetween: AlignHorizontalSpaceBetween,
  Album: Album,
  AlignHorizontalJustifyEnd: AlignHorizontalJustifyEnd,
}

// Функция для получения иконки по названию
export const getIcon = (iconName: string, className: string = "h-8 w-8") => {
  const Icon = iconMap[iconName] || HelpCircle
  return <Icon className={className} />
}

// Опции иконок для селекта в админке
export const iconOptions = [
  { value: "truck", label: "Грузовик", icon: Truck },
  { value: "shield", label: "Щит", icon: Shield },
  { value: "clock", label: "Часы", icon: Clock },
  { value: "headphones", label: "Наушники", icon: Headphones },
  { value: "star", label: "Звезда", icon: Star },
  { value: "award", label: "Награда", icon: Award },
  { value: "zap", label: "Молния", icon: Zap },
  { value: "heart", label: "Сердце", icon: Heart },
  { value: "Archive", label: "Архив", icon: Archive },
  { value: "ALargeSmall", label: "A-a", icon: ALargeSmall },
  { value: "AlignHorizontalSpaceBetween", label: "Выравнивание", icon: AlignHorizontalSpaceBetween },
  { value: "Album", label: "Альбом", icon: Album },
  { value: "AlignHorizontalJustifyEnd", label: "Выравнивание по краю", icon: AlignHorizontalJustifyEnd },
]
