"use client"

import React from "react"
import { Grid3X3, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export type CatalogTab = "categories" | "drivers"

export function CatalogTabs({
  active,
  onChange,
  className,
}: {
  active: CatalogTab
  onChange: (tab: CatalogTab) => void
  className?: string
}) {
  const Btn = ({ tab, label, icon }: { tab: CatalogTab; label: string; icon: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => onChange(tab)}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active === tab
          ? "bg-brand-yellow text-black"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className={cn("flex items-center gap-2 px-4 py-3 border-b", className)}>
      <Btn tab="categories" label="Категории" icon={<Grid3X3 className="h-4 w-4" />} />
      <Btn tab="drivers" label="Драйверы" icon={<FileText className="h-4 w-4" />} />
    </div>
  )
}
