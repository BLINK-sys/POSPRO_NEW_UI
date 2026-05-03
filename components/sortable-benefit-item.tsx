"use client"

import type React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Edit,
  Trash2,
  GripVertical,
} from "lucide-react"
import type { Benefit } from "./benefits-tab"
import { getIcon } from "@/lib/icon-mapping"

interface SortableBenefitItemProps {
  benefit: Benefit
  onEdit: (benefit: Benefit) => void
  onDelete: (benefit: Benefit) => void
}

export function SortableBenefitItem({ benefit, onEdit, onDelete }: SortableBenefitItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: benefit.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="relative group h-full rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all">
        <CardContent className="flex flex-col items-center justify-center p-6 text-center h-48">
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 p-1.5 rounded-full cursor-grab text-muted-foreground hover:text-foreground hover:bg-gray-100 touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <div className="p-4 bg-brand-yellow/15 rounded-full text-black mb-3">{getIcon(benefit.icon)}</div>
          <CardTitle className="text-base font-semibold">{benefit.title}</CardTitle>
          <div className="absolute top-2 right-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-blue-600 hover:bg-blue-50" onClick={() => onEdit(benefit)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-red-500 hover:bg-red-50" onClick={() => onDelete(benefit)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
