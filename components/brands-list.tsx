"use client"

import { useState, useTransition, useMemo } from "react"
import Image from "next/image"
import { type Brand, deleteBrand } from "@/app/actions/meta"
import { getImageUrl } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusCircle, Edit, Trash2, Search, X } from "lucide-react"
import { BrandEditDialog } from "./brand-edit-dialog"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useToast } from "./ui/use-toast"

interface BrandsListProps {
  brands: Brand[]
}

export function BrandsList({ brands }: BrandsListProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null)
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const filteredBrands = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return brands
    return brands.filter((b) =>
      b.name.toLowerCase().includes(term) ||
      (b.country && b.country.toLowerCase().includes(term))
    )
  }, [brands, searchTerm])

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">
          Бренды
          {searchTerm && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              · найдено {filteredBrands.length} из {brands.length}
            </span>
          )}
        </h3>
        <Button onClick={() => setIsCreating(true)} disabled={isPending}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Добавить бренд
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          type="text"
          placeholder="Поиск по названию или стране..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {brands.length > 0 ? (
        filteredBrands.length > 0 ? (
        <div className="flex flex-wrap gap-6">
          {filteredBrands.map((brand) => (
            <div
              key={brand.id}
              className="group relative w-[250px] h-[250px] min-w-[100px] min-h-[100px] rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl"
            >
              <div className="relative w-full h-full bg-white">
                <Image
                  src={
                    getImageUrl(brand.image_url) ||
                    "/placeholder.svg?height=200&width=200&text=" + encodeURIComponent(brand.name) ||
                    "/placeholder.svg" ||
                    "/placeholder.svg"
                  }
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
              </div>

              {/* Overlay that appears on hover */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center space-y-3">
                <h4 className="text-white font-semibold text-lg text-center px-3">{brand.name}</h4>
                <p className="text-white/90 text-sm font-medium">{brand.country}</p>
                <div className="flex space-x-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingBrand(brand)
                    }}
                    disabled={isPending}
                    className="h-9 w-9 p-0 bg-white/90 hover:bg-white text-gray-900"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeletingBrand(brand)
                    }}
                    disabled={isPending}
                    className="h-9 w-9 p-0 bg-red-500 hover:bg-red-600"
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
            По запросу «{searchTerm}» ничего не найдено
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
