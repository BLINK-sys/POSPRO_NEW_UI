"use server"

import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"
import { API_ENDPOINTS } from "@/lib/api-endpoints"

export interface BrandInfo {
  id: number
  name: string
  country?: string
  description?: string
  image_url?: string
}

export interface Product {
  id: number
  name: string
  article: string
  slug: string
  price: number
  wholesale_price?: number
  quantity: number
  is_visible: boolean
  country?: string
  brand_id?: number | null
  brand_info?: BrandInfo | null
  postavka?: string
  supplier_id?: number
  description?: string
  status?: string
  is_draft: boolean
  category_id?: number
  category?: string
  image?: string // Первое изображение для превью
  availability_status?: {
    status_name: string
    background_color: string
    text_color: string
  } | null
  characteristics?: Array<{
    id: number
    key: string
    value: string
    sort_order: number
  }>
  media?: Array<{
    id: number
    media_type: 'image' | 'video' // image, video
    url: string
    order: number
  }>
  documents?: Array<{
    id: number
    filename: string
    url: string
    file_type: string
    mime_type: string
  }>
  drivers?: Array<{
    id: number
    filename: string
    url: string
    file_type: string
    mime_type: string
  }>
}

export interface ProductMedia {
  id: number
  url: string
  media_type: 'image' | 'video' // image, video
  order: number
}

export interface ProductCharacteristic {
  id: number
  key: string
  value: string
  order: number
  characteristic_id?: number
  unit_of_measurement?: string
}

export interface ProductDocument {
  id: number
  name: string
  url: string
  order: number
}

export interface ProductDriver {
  id: number
  name: string
  url: string
  order: number
}

export interface PaginatedProducts {
  products: Product[]
  page: number
  per_page: number
  total_pages: number
  total_count: number
}

export interface GetProductsParams {
  page?: number
  perPage?: number
  search?: string
  categoryId?: number
  status?: string
  brand?: string
  supplier?: string
  visibility?: string
  quantity?: string
}

// Получить товары (с поддержкой пагинации и фильтров)
export async function getProducts(params: GetProductsParams = {}): Promise<PaginatedProducts> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const url = new URL(getApiUrl(API_ENDPOINTS.PRODUCTS.LIST))

    if (params.page) {
      url.searchParams.set("page", String(params.page))
    }
    if (params.perPage) {
      url.searchParams.set("per_page", String(params.perPage))
    }
    if (params.search) {
      url.searchParams.set("search", params.search)
    }
    if (params.categoryId) {
      url.searchParams.set("category_id", String(params.categoryId))
    }
    if (params.status && params.status !== "all") {
      url.searchParams.set("status", params.status)
    }
    if (params.brand && params.brand !== "all") {
      url.searchParams.set("brand", params.brand)
    }
    if (params.supplier && params.supplier !== "all") {
      url.searchParams.set("supplier", params.supplier)
    }
    if (params.visibility && params.visibility !== "all") {
      url.searchParams.set("visibility", params.visibility)
    }
    if (params.quantity && params.quantity !== "all") {
      url.searchParams.set("quantity", params.quantity)
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      return {
        products: data,
        page: params.page ?? 1,
        per_page: params.perPage ?? data.length,
        total_pages: 1,
        total_count: data.length,
      }
    }

    return {
      products: data.products ?? [],
      page: data.page ?? params.page ?? 1,
      per_page: data.per_page ?? params.perPage ?? (data.products?.length ?? 0),
      total_pages: data.total_pages ?? 1,
      total_count: data.total_count ?? (data.products?.length ?? 0),
    }
  } catch (error) {
    console.error("Error fetching products:", error)
    throw new Error("Ошибка получения товаров")
  }
}

// Получить товар по slug
export async function getProductBySlug(slug: string): Promise<Product> {
  try {
    const response = await fetch(getApiUrl(`/products/${slug}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching product:", error)
    throw new Error("Ошибка получения товара")
  }
}

// Создать черновик товара
export async function createProductDraft(data?: Partial<Product>): Promise<{ success: boolean; id?: number; article?: string; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.PRODUCTS.CREATE_DRAFT), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...data, is_draft: true }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `HTTP error! status: ${response.status}`
      }
    }

    const result = await response.json()
    return {
      success: true,
      id: result.id,
      article: result.article
    }
  } catch (error) {
    console.error("Error creating product draft:", error)
    return {
      success: false,
      error: "Ошибка создания черновика товара"
    }
  }
}

// Обновить товар
export async function updateProduct(id: number, data: Partial<Product>): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.PRODUCTS.UPDATE(id)), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `HTTP error! status: ${response.status}`
      }
    }

    const product = await response.json()
    return {
      success: true,
      product
    }
  } catch (error) {
    console.error("Error updating product:", error)
    return {
      success: false,
      error: "Ошибка обновления товара"
    }
  }
}

// Финализировать товар
export async function finalizeProduct(id: number, data: Partial<Product>): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.PRODUCTS.FINALIZE(id)), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `HTTP error! status: ${response.status}`
      }
    }

    const product = await response.json()
    return {
      success: true,
      product
    }
  } catch (error) {
    console.error("Error finalizing product:", error)
    return {
      success: false,
      error: "Ошибка финализации товара"
    }
  }
}

// Удалить черновик товара
export async function deleteProductDraft(id: number): Promise<{ success: boolean; error?: string }> {
  console.log("deleteProductDraft called with ID:", id)
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      console.error("No token found")
      throw new Error("Не авторизован")
    }

    const url = getApiUrl(API_ENDPOINTS.PRODUCTS.DELETE_DRAFT(id))
    console.log("Delete draft URL:", url)

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    console.log("Delete draft response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Delete draft error:", errorData)
      return {
        success: false,
        error: errorData.message || `HTTP error! status: ${response.status}`
      }
    }

    console.log("Delete draft successful")
    return { success: true }
  } catch (error) {
    console.error("Error deleting product draft:", error)
    return {
      success: false,
      error: "Ошибка удаления черновика товара"
    }
  }
}

// Удалить товар
export async function deleteProduct(id: number): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`${API_ENDPOINTS.PRODUCTS.LIST}/${id}`), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Error deleting product:", error)
    throw new Error("Ошибка удаления товара")
  }
}

// Получить медиа товара
export async function getMedia(productId: number): Promise<ProductMedia[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/media/${productId}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching media:", error)
    throw new Error("Ошибка получения медиа")
  }
}

// Добавить медиа по URL
export async function addMediaByUrl(productId: number, url: string, mediaType: string): Promise<ProductMedia> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/media/${productId}`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, media_type: mediaType }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error adding media by URL:", error)
    throw new Error("Ошибка добавления медиа")
  }
}

// Загрузить файл медиа
export async function uploadProductFile(formData: FormData): Promise<ProductMedia> {
  try {
    const productId = formData.get('product_id') as string
    const file = formData.get('file') as File
    
    console.log("uploadProductFile called with:", { productId, fileName: file?.name, fileSize: file?.size, fileType: file?.type })
    
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    console.log("FormData prepared, uploading to:", getApiUrl(`/upload/upload_product`))

    const response = await fetch(getApiUrl(`/upload/upload_product`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    console.log("Upload response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Upload failed:", errorData)
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log("Upload successful:", result)
    return result
  } catch (error) {
    console.error("Error uploading product file:", error)
    throw new Error("Ошибка загрузки файла")
  }
}

// Удалить медиа
export async function deleteMedia(productId: number, mediaId: number): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/media/${mediaId}`), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Error deleting media:", error)
    throw new Error("Ошибка удаления медиа")
  }
}

// Изменить порядок медиа
export async function reorderMedia(productId: number, mediaIds: number[]): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/media/reorder/${productId}`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(mediaIds.map((id, index) => ({ id, sort_order: index }))),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Error reordering media:", error)
    throw new Error("Ошибка изменения порядка медиа")
  }
}

// Получить характеристики товара
export async function getCharacteristics(productId: number): Promise<ProductCharacteristic[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/characteristics/${productId}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.map((item: any) => ({
      id: item.id,
      key: item.key,
      value: item.value,
      order: item.sort_order,
      characteristic_id: item.characteristic_id,
      unit_of_measurement: item.unit_of_measurement || ''
    }))
  } catch (error) {
    console.error("Error fetching characteristics:", error)
    throw new Error("Ошибка получения характеристик")
  }
}

// Добавить характеристику
export async function addCharacteristic(productId: number, characteristicId: number, value: string): Promise<ProductCharacteristic> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/characteristics/${productId}`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ characteristic_id: characteristicId, value }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return {
      id: data.id,
      key: data.key,
      value: data.value,
      order: data.sort_order,
      characteristic_id: data.characteristic_id,
      unit_of_measurement: data.unit_of_measurement || ''
    }
  } catch (error) {
    console.error("Error adding characteristic:", error)
    throw new Error("Ошибка добавления характеристики")
  }
}

// Удалить характеристику
export async function deleteCharacteristic(productId: number, characteristicId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return { success: false, error: "Не авторизован" }
    }

    const response = await fetch(getApiUrl(`/characteristics/${characteristicId}`), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { success: false, error: errorData.message || `HTTP error! status: ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting characteristic:", error)
    return { success: false, error: "Ошибка удаления характеристики" }
  }
}

// Изменить порядок характеристик
export async function reorderCharacteristics(productId: number, orderPayload: { id: number; sort_order: number }[]): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/characteristics/reorder/${productId}`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Error reordering characteristics:", error)
    throw new Error("Ошибка изменения порядка характеристик")
  }
}

// Получить документы товара
export async function getDocuments(productId: number): Promise<ProductDocument[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/documents/${productId}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching documents:", error)
    throw new Error("Ошибка получения документов")
  }
}

// Загрузить документ
export async function uploadDocumentFile(formData: FormData): Promise<ProductDocument> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/documents/upload`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error uploading document:", error)
    throw new Error("Ошибка загрузки документа")
  }
}

// Удалить документ
export async function deleteDocument(productId: number, documentId: number): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/documents/${documentId}`), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Error deleting document:", error)
    throw new Error("Ошибка удаления документа")
  }
}

// Получить драйверы товара
export async function getDrivers(productId: number): Promise<ProductDriver[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/drivers/${productId}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching drivers:", error)
    throw new Error("Ошибка получения драйверов")
  }
}

// Загрузить драйвер
export async function uploadDriverFile(formData: FormData): Promise<ProductDriver> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/drivers/upload`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error uploading driver:", error)
    throw new Error("Ошибка загрузки драйвера")
  }
}

// Удалить драйвер
export async function deleteDriver(productId: number, driverId: number): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(`/upload/drivers/${driverId}`), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Error deleting driver:", error)
    throw new Error("Ошибка удаления драйвера")
  }
}
