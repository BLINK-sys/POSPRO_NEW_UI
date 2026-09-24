"use client"

import DealDetail from "@/components/deals/deal-detail"

export default function AdminDealDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const numId = Number(params.id)
  if (Number.isNaN(numId)) {
    return <div className="text-center py-24 text-gray-500">Некорректный ID</div>
  }
  return <DealDetail dealId={numId} />
}
