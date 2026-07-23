import { redirect } from "next/navigation"
import { getIntegrationDetail } from "@/app/actions/integrations"
import IntegrationDetailClient from "@/components/integration-detail-client"

export const dynamic = "force-dynamic"

const ALLOWED = ["bio", "equip"] as const

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  if (!(ALLOWED as readonly string[]).includes(type)) {
    redirect("/admin/integrations")
  }
  const initial = await getIntegrationDetail(type as "bio" | "equip")
  if (!initial) redirect("/admin/integrations")

  return <IntegrationDetailClient type={type as "bio" | "equip"} initial={initial} />
}
