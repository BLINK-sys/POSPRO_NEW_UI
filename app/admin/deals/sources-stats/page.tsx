"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"

import DealsSourcesStats from "@/components/deals/deals-sources-stats"


export default function AdminDealsSourcesStatsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const canSeeAll = Boolean(user && (user.is_owner || user.can_see_all_deals))

  useEffect(() => {
    if (user && !canSeeAll) router.replace("/admin/deals")
  }, [user, canSeeAll, router])

  if (!user || !canSeeAll) return null
  return <DealsSourcesStats />
}
