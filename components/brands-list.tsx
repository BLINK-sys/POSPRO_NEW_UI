"use client"

import { useState, useTransition, useMemo } from "react"
import Image from "next/image"
import { type Brand, deleteBrand } from "@/app/actions/meta"
import { getImageUrl } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Edit, Trash2, Search, X } from "lucide-react"
import { BrandEditDialog } from "./brand-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"

const NO_COUNTRY = "__no_country__"

interface BrandsListProps {
  brands: Brand[]
}

export function BrandsList({ brands }: BrandsListProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null)
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState("")
  const [countryFilter, setCountryFilter] = useState<string>("all")
  const { toast } = useToast()

  // Уникальные страны из текущего списка брендов — для опций фильтра.
  // Сортируем по алфавиту, "Страна не указана" уезжает в начало.
  const countryOptions = useMemo(() => {
    const set = new Set<string>()
    let hasEmpty = false
    for (const b of brands) {
      const c = b.country?.trim()
      if (c) set.add(c)
      else hasEmpty = true
    }
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "ru"))
    return { hasEmpty, list: sorted }
  }, [brands])

  const filteredBrands = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return brands.filter((b) => {
      // Фильтр по стране применяется отдельно от текстового поиска,
      // чтобы можно было сужать выборку обоими сразу.
      if (countryFilter !== "all") {
        const c = b.country?.trim() || ""
        if (countryFilter === NO_COUNTRY) {
          if (c) return false
        } else if (c !== countryFilter) {
          return false
        }
      }
      if (!term) return true
      return (
        b.name.toLowerCase().includes(term) ||
        (b.country && b.country.toLowerCase().includes(term))
      )
    })
  }, [brands, searchTerm, countryFilter])

  const handleDelete = () => {
    if (!deletingBrand) return

    startTransition(async () => {
      const result = await deleteBrand(deletingBrand.id)
      if (result.success) {
        toast({ title: "Успех!", description: result.message })
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error })
      }
      setDeletingBrand(null)
    })
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">
          Бренды
          {(searchTerm || countryFilter !== "all") && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              · найдено {filteredBrands.length} из {brands.length}
            </span>
          )}
        </h3>
        <Button
          onClick={() => setIsCreating(true)}
          disabled={isPending}
          className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Добавить бренд
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Поиск по названию или стране..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 h-10 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-full sm:w-64 h-10 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300">
            <SelectValue placeholder="Страна" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все страны</SelectItem>
            {countryOptions.hasEmpty && (
              <SelectItem value={NO_COUNTRY}>Страна не указана</SelectItem>
            )}
            {countryOptions.list.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {countryFilter !== "all" && (
          <Button
            variant="outline"
            onClick={() => setCountryFilter("all")}
            className="h-10 rounded-lg text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
          >
            <X className="mr-2 h-4 w-4" />
            Сбросить фильтр
          </Button>
        )}
      </div>

      {brands.length > 0 ? (
        filteredBrands.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
          {filteredBrands.map((brand) => (
            <div
              key={brand.id}
              className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all duration-300 cursor-pointer shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5"
            >
              <div className="relative w-full h-full bg-white">
                {brand.image_url ? (
                  <Image
                    src={getImageUrl(brand.image_url) || "/placeholder.svg"}
                    alt={brand.name}
                    fill
                    className="object-cover transition-all duration-300 group-hover:blur-sm group-hover:scale-110"
                    unoptimized
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = "/placeholder.svg?height=200&width=200&text=" + encodeURIComponent(brand.name)
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full p-4 bg-gray-50 transition-all duration-300 group-hover:blur-sm group-hover:scale-105">
                    <span className="text-gray-900 font-semibold text-center text-lg break-words leading-tight">
                      {brand.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Overlay that appears on hover */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center space-y-3">
                <h4 className="text-white font-semibold text-lg text-center px-3">{brand.name}</h4>
                <p className="text-white/90 text-sm font-medium">{brand.country}</p>
                <div className="flex space-x-3">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingBrand(brand)
                    }}
                    disabled={isPending}
                    className="h-9 w-9 p-0 rounded-full bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeletingBrand(brand)
                    }}
                    disabled={isPending}
                    className="h-9 w-9 p-0 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-[0_2px_6px_rgba(220,38,38,0.30)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.40)] transition-shadow"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            По заданным фильтрам ничего не найдено
          </div>
        )
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <PlusCircle className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-muted-foreground text-lg">Бренды не найдены.</p>
          <p className="text-muted-foreground text-sm mt-1">Добавьте первый бренд, чтобы начать работу</p>
        </div>
      )}

      {isCreating && <BrandEditDialog onClose={() => setIsCreating(false)} />}
      {editingBrand && <BrandEditDialog brand={editingBrand} onClose={() => setEditingBrand(null)} />}
      <DeleteConfirmationDialog
        open={!!deletingBrand}
        onOpenChange={(open) => !open && setDeletingBrand(null)}
        onConfirm={handleDelete}
        title={`Удалить бренд "${deletingBrand?.name}"?`}
        description="Это действие нельзя будет отменить."
      />
    </div>
  )
}
