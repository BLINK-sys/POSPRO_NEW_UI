"use client"

import type React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Edit,
  Trash2,
  GripVertical,
} from "lucide-react"
import type { ProductAvailabilityStatus } from "@/app/actions/product-availability-statuses"

interface SortableProductAvailabilityStatusItemProps {
  status: ProductAvailabilityStatus
  onEdit: (status: ProductAvailabilityStatus) => void
  onDelete: (status: ProductAvailabilityStatus) => void
  getOperatorText: (operator: string) => string
}

export function SortableProductAvailabilityStatusItem({ 
  status, 
  onEdit, 
  onDelete, 
  getOperatorText 
}: SortableProductAvailabilityStatusItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  const getFormulaDisplay = () => {
    const operatorText = getOperatorText(status.condition_operator)
    return `Если кол-во товара "${status.condition_operator} ${status.condition_value}" то статус "${status.status_name}"`
  }

  return (
    <div ref={setNodeRef} style={style} className="border-b border-gray-200 last:border-b-0">
      <div className="flex items-center py-3 px-4 hover:bg-gray-50">
        {/* Ручка для перетягивания */}
        <div className="w-12 flex justify-center">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Статус */}
        <div className="flex-1 px-4">
          <Badge
            style={{
              backgroundColor: status.background_color,
              color: status.text_color,
            }}
            className="px-3 py-1 text-sm font-medium"
          >
            {status.status_name}
          </Badge>
          {!status.active && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Неактивен
            </Badge>
          )}
          {status.supplier_name && (
            <span className="ml-2 text-xs text-gray-500">
              ({status.supplier_name})
            </span>
          )}
        </div>

        {/* Формула */}
        <div className="flex-1 px-4 text-sm text-gray-700">
          {getFormulaDisplay()}
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center space-x-2 px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(status)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(status)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
