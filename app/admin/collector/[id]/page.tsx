import { redirect } from "next/navigation"
import { getCollectorTask } from "@/app/actions/collector"
import CollectorTaskClient from "@/components/collector-task-client"

export const dynamic = "force-dynamic"

export default async function CollectorTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const taskId = parseInt(id, 10)
  if (isNaN(taskId)) redirect("/admin/collector")

  const { task, online } = await getCollectorTask(taskId)
  if (!task) redirect("/admin/collector")

  return <CollectorTaskClient initialTask={task} initialWorkerOnline={online} />
}
