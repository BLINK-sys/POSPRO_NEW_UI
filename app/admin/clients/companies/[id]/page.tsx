import CompanyDetail from "@/components/clients/company-detail"

export default function AdminCompanyPage({ params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return <div className="py-24 text-center text-gray-500">Некорректный ID</div>
  }
  return <CompanyDetail companyId={id} />
}
