"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getAllBrands, type AllBrandsData } from "@/app/actions/public"
import { getImageUrl, isImageUrl } from "@/lib/image-utils"

export default function MobileBrandsPage() {
  const [brands, setBrands] = useState<AllBrandsData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAllBrands()
        setBrands(data || [])
      } catch (error) {
        console.error("Error loading brands:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-4">
      <div className="px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold">Все бренды</h1>
      </div>

      {brands.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 p-4">
          {brands.map((brand) => (
            <Link key={brand.id} href={`/brand/${encodeURIComponent(brand.name)}`}>
              <Card className="overflow-hidden border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)] rounded-xl aspect-square">
                <CardContent className="p-0 h-full relative">
                  {isImageUrl(brand.image_url) ? (
                    <Image
                      src={getImageUrl(brand.image_url)}
                      alt={brand.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-100 p-2">
                      <span className="text-[clamp(10px,3.5vw,16px)] font-bold text-gray-700 text-center leading-tight line-clamp-3">{brand.name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 text-sm">Бренды не найдены</div>
      )}
    </div>
  )
}
