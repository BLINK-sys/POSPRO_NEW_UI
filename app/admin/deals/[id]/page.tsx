"use client"

import { useEffect } from "react"
import DealDetail from "@/components/deals/deal-detail"
import { useChatUnread } from "@/context/chat-unread-context"

export default function AdminDealDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const numId = Number(params.id)
  const { markEntityRead } = useChatUnread()
  useEffect(() => {
    if (!Number.isNaN(numId)) markEntityRead("deal", numId)
  }, [numId, markEntityRead])
  if (Number.isNaN(numId)) {
    return <div className="text-center py-24 text-gray-500">Некорректный ID</div>
  }
  return <DealDetail dealId={numId} />
}
