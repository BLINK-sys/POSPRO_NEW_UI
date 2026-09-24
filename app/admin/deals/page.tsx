"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import DealsKanban from "@/components/deals/deals-kanban"
import DealCreateDialog from "@/components/deals/deal-create-dialog"

export default function AdminDealsPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  // Триггер для forced refetch внутри Kanban: увеличиваем при create.
  const [refreshTick, setRefreshTick] = useState(0)

  return (
    <>
      <DealsKanban
        key={refreshTick}
        onCreate={() => setCreateOpen(true)}
        onOpenDeal={(id) => router.push(`/admin/deals/${id}`)}
      />
      <DealCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => setRefreshTick((t) => t + 1)}
      />
    </>
  )
}
