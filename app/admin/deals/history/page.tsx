"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"

import DealsHistory from "@/components/deals/deals-history"


export default function AdminDealsHistoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const canSeeAll = Boolean(user && (user.is_owner || user.can_see_all_deals))

  useEffect(() => {
    // Если юзер зашёл по URL без прав — редиректим на канбан.
    if (user && !canSeeAll) {
      router.replace("/admin/deals")
    }
  }, [user, canSeeAll, router])

  if (!user) return null
  if (!canSeeAll) return null

  return <DealsHistory />
}
