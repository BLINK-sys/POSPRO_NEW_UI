import ProjectDetail from "@/components/projects/project-detail"

export default function AdminProjectDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <ProjectDetail projectId={Number(params.id)} />
}
