"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"
import type { Currency } from "./currencies"

export interface WarehouseVariable {
  id?: number
  warehouse_id?: number
  name: string
  label?: string | null
  formula: string
  sort_order: number
}

export interface WarehouseFormula {
  id: number
  warehouse_id: number
  formula: string
  delivery_formula: string | null
  // Опциональная формула «Себестоимость без маржи». Используется только для
  // отображения колонки в модалке «Остатки» товара, дальше нигде не учитывается.
  cost_formula: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Warehouse {
  id: number
  supplier_id: number
  supplier_name: string | null
  name: string
  city: string | null
  address: string | null
  currency_id: number
  currency: Currency | null
  // Работает ли склад с НДС. Default true. При false товары из этого
  // склада в корп.расчётнике добавляются с vatEnabled=false (см. KPItem).
  vat_enabled: boolean
  product_count?: number
  has_formula?: boolean
  variables?: WarehouseVariable[]
  formula?: WarehouseFormula | null
  created_at: string | null
  updated_at: string | null
}

export interface WarehouseActionResponse {
  success: boolean
  message?: string
  data?: Warehouse
  error?: string
}

export interface FormulaValidationResponse {
  success: boolean
  message?: string
}

export interface CalculatePreviewResponse {
  success: boolean
  message?: string
  data?: {
    calculated_price: number
    variables: Record<string, number>
    formula: string
  }
}

export interface RecalculateData {
  status: 'running' | 'done' | 'error'
  started_at?: string
  finished_at?: string | null
  total: number
  processed: number
  price_calculated: number
  delivery_calculated: number
  // Сколько товаров получили calculated_cost_no_margin за этот пересчёт.
  // Поле приходит только если cost_formula задана у склада.
  cost_no_margin_calculated?: number
  zero_price: number
  zero_price_reasons: Array<{ name: string; reason: string }>
  error_count: number
  errors: string[]
  has_delivery_formula: boolean
  // True если cost_formula задана. Помогает UI решить показывать ли счётчик.
  has_cost_formula?: boolean
}

export interface RecalculateResponse {
  success: boolean
  message?: string
  data?: RecalculateData
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

// ============ Warehouse CRUD ============

export async function getWarehouses(supplierId?: number): Promise<Warehouse[]> {
  try {
    const token = await getToken()
    const url = supplierId
      ? `${API_BASE_URL}/meta/warehouses/?supplier_id=${supplierId}`
      : `${API_BASE_URL}/meta/warehouses/`
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    const response = await res.json()
    return response.data || []
  } catch (e) {
    console.error("Error fetching warehouses:", e)
    return []
  }
}

export async function getWarehouse(id: number): Promise<Warehouse | null> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const response = await res.json()
    return response.data || null
  } catch (e) {
    console.error("Error fetching warehouse:", e)
    return null
  }
}

export async function createWarehouse(
  data: {
    supplier_id: number
    name: string
    city?: string
    address?: string
    currency_id: number
    vat_enabled?: boolean
  }
): Promise<WarehouseActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка создания склада" }
    }
    revalidatePath("/admin/suppliers")
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function updateWarehouse(
  id: number,
  data: Partial<{
    name: string
    city: string
    address: string
    currency_id: number
    vat_enabled: boolean
  }>
): Promise<WarehouseActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка обновления склада" }
    }
    revalidatePath("/admin/suppliers")
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function deleteWarehouse(id: number): Promise<WarehouseActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка удаления склада" }
    }
    revalidatePath("/admin/suppliers")
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

// ============ Variables ============

export async function saveVariables(
  warehouseId: number,
  variables: WarehouseVariable[]
): Promise<FormulaValidationResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/variables`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ variables }),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Ошибка сохранения переменных" }
    }
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}

export async function saveSingleVariable(
  warehouseId: number,
  variable: WarehouseVariable & { sort_order: number; vars_above?: string[] }
): Promise<{ success: boolean; message?: string; data?: WarehouseVariable }> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/variables/single`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(variable),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Ошибка сохранения переменной" }
    }
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}

// ============ Formula ============

export async function saveFormula(
  warehouseId: number,
  formula: string,
  delivery_formula?: string,
  cost_formula?: string,
): Promise<FormulaValidationResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/formula`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        formula,
        delivery_formula: delivery_formula || null,
        cost_formula: cost_formula || null,
      }),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Ошибка сохранения формулы" }
    }
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}

export async function deleteFormula(warehouseId: number): Promise<FormulaValidationResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/formula`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Ошибка удаления формулы" }
    }
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}

export async function validateFormula(
  warehouseId: number,
  formula: string
): Promise<FormulaValidationResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/validate-formula`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ formula }),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Формула некорректна" }
    }
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}

export async function calculatePreview(
  warehouseId: number,
  productId: number,
  costPrice?: number,
  extra?: { weight?: number; dimensions?: string }
): Promise<CalculatePreviewResponse> {
  try {
    const token = await getToken()
    const body: Record<string, unknown> = {}
    if (productId) body.product_id = productId
    if (costPrice !== undefined) body.cost_price = costPrice
    if (extra?.weight) body.weight = extra.weight
    if (extra?.dimensions) body.dimensions = extra.dimensions

    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/calculate-preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Ошибка расчёта" }
    }
    return { success: true, data: result.data }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}

export async function recalculateWarehouse(warehouseId: number): Promise<RecalculateResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/recalculate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Ошибка пересчёта" }
    }
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}

// ============ Copy configuration ============

export interface CopyConfigResponse {
  success: boolean
  message?: string
  copied?: number
  skipped?: Array<{ id: number; reason: string }>
  source_id?: number
  source_name?: string
}

export async function copyWarehouseConfig(
  sourceId: number,
  targetIds: number[],
): Promise<CopyConfigResponse> {
  try {
    const token = await getToken()
    const res = await fetch(
      `${API_BASE_URL}/meta/warehouses/${sourceId}/copy-config`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_ids: targetIds }),
      },
    )
    const result = await res.json()
    if (!res.ok) {
      return { success: false, message: result.message || "Ошибка копирования" }
    }
    return result as CopyConfigResponse
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}


export async function getRecalculateStatus(warehouseId: number): Promise<RecalculateResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/warehouses/${warehouseId}/recalculate-status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const result = await res.json()
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, message: "Ошибка сети" }
  }
}
