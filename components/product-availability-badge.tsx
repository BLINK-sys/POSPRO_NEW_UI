"use client"

import { Badge } from "@/components/ui/badge"
import type { ProductAvailabilityStatus } from "@/app/actions/public"

interface ProductAvailabilityBadgeProps {
  availabilityStatus: ProductAvailabilityStatus | null
  quantity: number
  className?: string
}

export function ProductAvailabilityBadge({ 
  availabilityStatus, 
  quantity, 
  className = "" 
}: ProductAvailabilityBadgeProps) {
  console.log('ProductAvailabilityBadge props:', { availabilityStatus, quantity })
  
  if (!availabilityStatus) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Наличие: {quantity} шт.
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-600">Наличие:</span>
      <Badge
        style={{
          backgroundColor: availabilityStatus.background_color,
          color: availabilityStatus.text_color,
        }}
        className="px-2 py-1 text-xs font-medium"
      >
        {availabilityStatus.status_name}
      </Badge>
    </div>
  )
}
