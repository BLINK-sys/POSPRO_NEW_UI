"use server"

import { getApiUrl } from "@/lib/api-address"

// Типы данных
export interface PublicHomepageData {
  banners: Banner[]
  blocks: HomepageBlock[]
}

export interface Banner {
  id: number
  title: string
  subtitle: string
  image: string
  button_text: string
  button_link: string
  show_button: boolean
  order: number
}

export interface HomepageBlock {
  id: number
  type: 'category' | 'categories' | 'brand' | 'brands' | 'benefit' | 'benefits' | 'product' | 'products' | 'small_banner' | 'small_banners' | 'info_cards'
  title: string
  order: number
  carusel: boolean
  show_title: boolean
  title_align: 'left' | 'right' | 'center'
  items: any[]
}

export interface CategoryData {
  id: number
  name: string
  slug: string
  image_url: string
  description?: string
  parent_id?: number
  children?: CategoryData[]
  product_count?: number
  direct_product_count?: number
}

export interface ProductData {
  id: number
  name: string
  slug: string
  price: number
  wholesale_price?: number | null
  description?: string
  category_id?: number
  category?: CategoryData
  status?: {
    id: number
    name: string
    background_color: string
    text_color: string
  }
  brand_id?: number | null
  brand_info?: {
    id: number
    name: string
    country?: string
    description?: string
    image_url?: string
  }
  quantity: number
  supplier_id?: number | null
  supplier_name?: string | null
  image_url?: string
  availability_status?: ProductAvailabilityStatus
}

export interface PaginatedBrandProducts {
  brand: BrandData | null
  products: ProductData[]
  total_count: number
  page: number
  per_page: number
  total_pages: number
  category_id?: number
}

export interface BrandData {
  id: number
  name: string
  country: string
  description: string
  image_url: string
}

export interface BenefitData {
  id: number
  icon: string
  title: string
  description: string
}

export interface SmallBannerData {
  id: number
  title: string
  description: string
  image_url: string
  background_image_url?: string
  title_text_color?: string
  description_text_color?: string
  card_bg_color: string
  show_button: boolean
  button_text: string
  button_text_color: string
  button_bg_color: string
  button_link: string
  open_in_new_tab?: boolean
}

export interface FooterSettings {
  address: string
  working_hours: string
  phone: string
  email: string
  description: string
  instagram_url: string
  whatsapp_url: string
  telegram_url: string
}

export interface AllBrandsData {
  id: number
  name: string
  country: string
  description: string
  image_url: string
  products_count?: number
}

// Получить данные главной страницы
export async function getHomepageData(): Promise<PublicHomepageData> {
  try {
    const response = await fetch(getApiUrl("/api/public/homepage"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log("Raw API response:", data)
    
    // Обрабатываем блоки с товарами для добавления статусов наличия
    const processedBlocks = await Promise.all(
      data.blocks.map(async (block: any) => {
        if (block.type === 'product' || block.type === 'products') {
          // Получаем статусы наличия для товаров в блоке
          const productsWithStatuses = await Promise.all(
            block.items.map(async (product: any) => {
              const availabilityStatus = await getProductAvailabilityStatus(product.quantity, product.supplier_id)
              return {
                ...product,
                // Преобразуем brand в brand_info для совместимости
                brand_info: product.brand || product.brand_info,
                brand_id: product.brand_id || product.brand?.id,
                availability_status: availabilityStatus
              }
            })
          )
          return {
            ...block,
            items: productsWithStatuses
          }
        }
        return block
      })
    )
    
    return {
      ...data,
      blocks: processedBlocks
    }
  } catch (error) {
    console.error("Error fetching homepage data:", error)
    throw new Error("Ошибка получения данных главной страницы")
  }
}

// Получить все категории для каталога (только с show_in_menu=True)
export async function getCatalogCategories(): Promise<CategoryData[]> {
  try {
    const response = await fetch(getApiUrl("/api/public/catalog/categories"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Сервер уже возвращает иерархическую структуру
    const categories = await response.json()
    
    // Преобразуем в формат CategoryData
    const transformCategory = (cat: any): CategoryData => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image_url: cat.image_url,
      description: cat.description,
      parent_id: cat.parent_id,
      children: cat.children ? cat.children.map(transformCategory) : [],
      product_count: typeof cat.product_count === "number" ? cat.product_count : undefined,
      direct_product_count: typeof cat.direct_product_count === "number" ? cat.direct_product_count : undefined,
    })

    return categories.map(transformCategory)
  } catch (error) {
    console.error("Error fetching categories:", error)
    throw new Error("Ошибка получения категорий")
  }
}

// Получить данные категории с товарами
export async function getCategoryData(
  slug: string,
  options?: {
    page?: number
    perPage?: number
    search?: string
    brand?: string
    sort?: string
  }
): Promise<{
  category: CategoryData
  children: CategoryData[]
  products: ProductData[]
  brands: Array<{
    id: number
    name: string
    country?: string
    description?: string
    image_url?: string
  }>
  pagination?: {
    page: number
    per_page: number
    total_count: number
    total_pages: number
  }
}> {
  try {
    const params = new URLSearchParams()
    if (options?.page) {
      params.append("page", options.page.toString())
    }
    if (options?.perPage) {
      params.append("per_page", options.perPage.toString())
    }
    if (options?.search) {
      params.append("search", options.search)
    }
    if (options?.brand && options.brand !== "all") {
      params.append("brand", options.brand)
    }
    if (options?.sort) {
      params.append("sort", options.sort)
    }
    const queryString = params.toString() ? `?${params.toString()}` : ""

    const response = await fetch(getApiUrl(`/api/public/category/${slug}${queryString}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Получаем статусы наличия для товаров категории
    const productsWithStatuses = await Promise.all(
      data.products.map(async (product: any) => {
        const availabilityStatus = await getProductAvailabilityStatus(product.quantity, product.supplier_id)
        return {
          ...product,
          // Преобразуем brand в brand_info для совместимости
          brand_info: product.brand_info || product.brand,
          brand_id: product.brand_id || product.brand?.id,
          availability_status: availabilityStatus
        }
      })
    )
    
    return {
      ...data,
      products: productsWithStatuses
    }
  } catch (error) {
    console.error("Error fetching category data:", error)
    throw new Error("Ошибка получения данных категории")
  }
}

// Получить настройки футера
export async function getFooterSettings(): Promise<FooterSettings> {
  try {
    const response = await fetch(getApiUrl("/api/footer-settings"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching footer settings:", error)
    // Возвращаем дефолтные значения при ошибке
    return {
      address: "г. Алматы, ул. Достык, 105",
      working_hours: "Пн-Пт 9:00 - 18:00",
      phone: "+7 (727) 123-45-67",
      email: "support@pospro.kz",
      description: "PosPro - ваш надежный партнер в мире качественных товаров. Мы предлагаем широкий ассортимент и лучший сервис.",
      instagram_url: "#",
      whatsapp_url: "#",
      telegram_url: "#"
    }
  }
}

// Получить все товары
export async function getAllProducts(): Promise<ProductData[]> {
  try {
    const response = await fetch(getApiUrl("/products/"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const products = await response.json()
    
    // Получаем статусы наличия для всех товаров
    const productsWithStatuses = await Promise.all(
      products.map(async (product: any) => {
        const availabilityStatus = await getProductAvailabilityStatus(product.quantity, product.supplier_id)
        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          wholesale_price: product.wholesale_price,
          quantity: product.quantity,
          status: product.status,
          brand_id: product.brand_id,
          brand_info: product.brand_info,
          supplier_id: product.supplier_id,
          supplier_name: product.supplier_name || product.supplier?.name || null,
          description: product.description,
          category_id: product.category_id,
          image_url: product.image,
          availability_status: availabilityStatus
        }
      })
    )

    return productsWithStatuses
  } catch (error) {
    console.error("Error fetching products:", error)
    throw new Error("Ошибка получения товаров")
  }
}

// Поиск товаров
export async function searchProducts(query: string): Promise<ProductData[]> {
  try {
    if (!query.trim()) {
      return []
    }

    const response = await fetch(getApiUrl(`/products/search?q=${encodeURIComponent(query)}&limit=5000`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const products = await response.json()

    // availability_status и status теперь вычисляются на бэкенде (один SQL-запрос)
    return products.map((product: any) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      wholesale_price: product.wholesale_price,
      quantity: product.quantity,
      status: product.status && typeof product.status === 'object' ? product.status : undefined,
      brand_id: product.brand_id ? Number(product.brand_id) : null,
      brand_info: product.brand_info,
      supplier_id: product.supplier_id ?? null,
      supplier_name: product.supplier_name || product.supplier?.name || null,
      description: product.description,
      category_id: product.category_id ? Number(product.category_id) : undefined,
      category: product.category,
      image_url: product.image,
      availability_status: product.availability_status ?? undefined,
    }))
  } catch (error) {
    console.error("Error searching products:", error)
    throw new Error("Ошибка поиска товаров")
  }
}

// Получить товары по бренду
export async function getProductsByBrand(brandName: string): Promise<{
  brand: BrandData | null
  products: ProductData[]
  total_count: number
}> {
  try {
    const encodedBrandName = encodeURIComponent(brandName)
    const response = await fetch(getApiUrl(`/products/brand/${encodedBrandName}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Получаем статусы наличия для товаров бренда
    const productsWithStatuses = await Promise.all(
      data.products.map(async (product: any) => {
        const availabilityStatus = await getProductAvailabilityStatus(product.quantity, product.supplier_id)
        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          wholesale_price: product.wholesale_price,
          quantity: product.quantity,
          status: product.status,
          brand_id: product.brand_id,
          brand_info: product.brand_info,
          supplier_id: product.supplier_id,
          supplier_name: product.supplier_name || product.supplier?.name || null,
          description: product.description,
          category_id: product.category_id,
          image_url: product.image,
          availability_status: availabilityStatus
        }
      })
    )
    
    return {
      brand: data.brand || null,
      products: productsWithStatuses,
      total_count: data.total_count
    }
  } catch (error) {
    console.error("Error getting products by brand:", error)
    throw new Error("Ошибка получения товаров по бренду")
  }
}

// Получить товары по бренду с полной информацией
export async function getProductsByBrandDetailed(
  brandName: string,
  options?: { page?: number; perPage?: number }
): Promise<PaginatedBrandProducts> {
  try {
    const encodedBrandName = encodeURIComponent(brandName)
    const params = new URLSearchParams()
    if (options?.page) {
      params.append("page", options.page.toString())
    }
    if (options?.perPage) {
      params.append("per_page", options.perPage.toString())
    }
    const queryString = params.toString() ? `?${params.toString()}` : ""

    const response = await fetch(getApiUrl(`/products/brand/${encodedBrandName}/detailed${queryString}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const products = Array.isArray(data.products) ? data.products.map(normalizeProduct) : []
    const perPage = options?.perPage ?? data.per_page ?? 20

    return {
      brand: data.brand || null,
      products,
      total_count: data.total_count ?? products.length,
      page: data.page ?? options?.page ?? 1,
      per_page: perPage,
      total_pages: data.total_pages ?? (data.total_count ? Math.ceil(data.total_count / perPage) : 0),
      category_id: data.category_id,
    }
  } catch (error) {
    console.error("Error getting detailed products by brand:", error)
    throw new Error("Ошибка получения детальной информации о товарах по бренду")
  }
}

// Получить категории по бренду для фильтрации
export async function getCategoriesByBrand(brandName: string): Promise<{
  brand: BrandData | null
  categories: Array<CategoryData & { product_count: number }>
}> {
  try {
    const encodedBrandName = encodeURIComponent(brandName)
    const response = await fetch(getApiUrl(`/products/brand/${encodedBrandName}/categories`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return {
      brand: data.brand,
      categories: data.categories.map((category: any) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id,
        description: category.description,
        image_url: category.image_url,
        product_count: category.product_count
      }))
    }
  } catch (error) {
    console.error("Error getting categories by brand:", error)
    throw new Error("Ошибка получения категорий по бренду")
  }
}

// Получить товары по бренду с фильтрацией по категории
export async function getProductsByBrandAndCategory(
  brandName: string,
  categoryId?: number,
  options?: { page?: number; perPage?: number }
): Promise<PaginatedBrandProducts> {
  try {
    const encodedBrandName = encodeURIComponent(brandName)
    const params = new URLSearchParams()
    if (categoryId) {
      params.append("category_id", categoryId.toString())
    }
    if (options?.page) {
      params.append("page", options.page.toString())
    }
    if (options?.perPage) {
      params.append("per_page", options.perPage.toString())
    }
    const queryString = params.toString() ? `?${params.toString()}` : ""

    const response = await fetch(getApiUrl(`/products/brand/${encodedBrandName}/filter${queryString}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const products = Array.isArray(data.products) ? data.products.map(normalizeProduct) : []

    return {
      brand: data.brand || null,
      category_id: data.category_id,
      products,
      total_count: data.total_count ?? products.length,
      page: data.page ?? options?.page ?? 1,
      per_page: data.per_page ?? options?.perPage ?? 20,
      total_pages: data.total_pages ?? (data.total_count ? Math.ceil(data.total_count / (data.per_page ?? options?.perPage ?? 20)) : 0),
    }
  } catch (error) {
    console.error("Error filtering products by brand and category:", error)
    throw new Error("Ошибка фильтрации товаров")
  }
}

// Тип для статуса наличия товара
export interface ProductAvailabilityStatus {
  id: number
  status_name: string
  condition_operator: string
  condition_value: number
  background_color: string
  text_color: string
  order: number
  active: boolean
}

// Функция для получения статуса наличия по количеству товара
export async function getProductAvailabilityStatus(quantity: number, supplierId?: number | null): Promise<ProductAvailabilityStatus | null> {
  try {
    const params = new URLSearchParams()
    if (supplierId) {
      params.append('supplier_id', supplierId.toString())
    }
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await fetch(`${getApiUrl('/api/product-availability-statuses/check')}/${quantity}${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.status || null
  } catch (error) {
    console.error('Error fetching product availability status:', error)
    return null
  }
}

// Получить все бренды
export async function getAllBrands(): Promise<AllBrandsData[]> {
  try {
    const response = await fetch(getApiUrl("/meta/brands"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const brands = await response.json()
    return brands.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      country: brand.country || '',
      description: brand.description || '',
      image_url: brand.image_url || '',
      products_count: brand.products_count ?? brand.product_count ?? 0
    }))
  } catch (error) {
    console.error("Error fetching all brands:", error)
    // Возвращаем пустой массив вместо ошибки, чтобы не ломать страницу
    return []
  }
} 

const normalizeProduct = (product: any): ProductData => {
  const status = product && typeof product.status === "object" ? product.status : undefined

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    wholesale_price: product.wholesale_price ?? null,
    description: product.description,
    category_id: product.category_id,
    category: product.category,
    status,
    brand_id: product.brand_id,
    brand_info: product.brand_info || product.brand,
    quantity: typeof product.quantity === "number" ? product.quantity : Number(product.quantity) || 0,
    supplier_id: product.supplier_id ?? null,
    supplier_name: product.supplier_name || product.supplier?.name || null,
    image_url: product.image_url ?? product.image ?? product.imageUrl ?? undefined,
    availability_status: product.availability_status ?? undefined,
  }
}