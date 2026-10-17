"use client"

/**
 * Карточка компании /admin/clients/companies/[id].
 * Показывает основные поля компании + список связанных контактов
 * (`kp_client` с `company_id = <id>`).
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { crmGet } from "@/lib/crm-fetch"
import { formatPhone } from "@/lib/utils"

import type { Company } from "./companies-list"

interface ClientLite {
  id: number
  full_name: string | null
  object: string | null
  display_name: string
  contacts: Array<{ phone: string; note?: string }>
}

interface CompanyFull extends Company {
  clients?: ClientLite[]
}

export default function CompanyDetail({ companyId }: { companyId: number }) {
  const router = useRouter()
  const { toast } = useToast()
  const [company, setCompany] = useState<CompanyFull | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    crmGet<{ company: CompanyFull }>(`/api/admin/kp-companies/${companyId}`)
      .then((res) => {
        if (!ignore) setCompany(res.company)
      })
      .catch((e) =>
        toast({
          variant: "destructive",
          title: "Не удалось загрузить компанию",
          description: e?.message,
        }),
      )
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [companyId, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!company) {
    return (
      <div className="text-center py-24 text-gray-500">Компания не найдена</div>
    )
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" asChild size="sm" className="rounded-full">
          <Link href="/admin/clients?tab=companies">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            К списку
          </Link>
        </Button>
        <div className="h-10 w-10 rounded-full bg-brand-yellow/25 flex items-center justify-center">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold leading-tight truncate">{company.name}</h1>
          {company.bin && (
            <p className="text-sm text-gray-500">БИН/ИНН: {company.bin}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-4">
        {/* Карточка данных */}
        <Card className="rounded-xl border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Контактные данные
          </h2>
          <InfoRow icon={<Phone className="h-4 w-4" />} label="Телефон">
            {company.phone ? formatPhone(company.phone) : "—"}
          </InfoRow>
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
            {company.email || "—"}
          </InfoRow>
          <InfoRow icon={<Globe className="h-4 w-4" />} label="Сайт">
            {company.website || "—"}
          </InfoRow>
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Адрес">
            {company.address || "—"}
          </InfoRow>
          {company.note && (
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[11px] uppercase text-gray-400 tracking-wider mb-1">
                Заметка
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{company.note}</div>
            </div>
          )}
        </Card>

        {/* Сотрудники компании */}
        <Card className="rounded-xl border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Сотрудники · {company.clients?.length ?? 0}
            </h2>
          </div>
          {!company.clients || company.clients.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              К этой компании ещё не привязаны контакты
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {company.clients.map((cl) => (
                <div key={cl.id} className="py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {cl.display_name}
                    </div>
                    {cl.object && (
                      <div className="text-xs text-gray-500 truncate">{cl.object}</div>
                    )}
                    {cl.contacts && cl.contacts.length > 0 && (
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                        {cl.contacts.map((contact, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"
                          >
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span className="tabular-nums">{formatPhone(contact.phone)}</span>
                            {contact.note && (
                              <span className="text-gray-400">· {contact.note}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase text-gray-400 tracking-wider">{label}</div>
        <div className="text-gray-800 truncate">{children}</div>
      </div>
    </div>
  )
}
