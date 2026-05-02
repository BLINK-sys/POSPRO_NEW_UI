/**
 * Хелперы для отображения связанных с товаром данных.
 */

export interface SupplierRef {
  id?: number
  name?: string | null
}

export interface ProductLikeForSuppliers {
  suppliers?: SupplierRef[] | null
  supplier?: SupplierRef | null
  supplier_name?: string | null
}

/**
 * Возвращает массив имён всех поставщиков товара (через
 * product_warehouse_cost.warehouse.supplier).
 *
 * Если backend ещё не отдаёт `suppliers` (старый ответ) — fallback на
 * `supplier`/`supplier_name` (один основной).
 */
export function getSupplierNames(product: ProductLikeForSuppliers): string[] {
  const fromArray = (product.suppliers || [])
    .map((s) => (s?.name || "").trim())
    .filter((n): n is string => Boolean(n))
  if (fromArray.length > 0) return fromArray

  const single = (product.supplier?.name || product.supplier_name || "").trim()
  return single ? [single] : []
}

/**
 * То же, склеенное через запятую — для inline-вывода в карточках/деталях.
 * Возвращает null если поставщиков нет (удобно для условного рендера).
 */
export function getSuppliersText(product: ProductLikeForSuppliers): string | null {
  const names = getSupplierNames(product)
  return names.length > 0 ? names.join(", ") : null
}

export interface ProductLikeForWinningWarehouse {
  winning_warehouse?: { id?: number; name?: string | null; city?: string | null } | null
}

/**
 * Suffix для inline-вывода рядом с ценой: " (Equip Алматы)" — это склад
 * с минимальной ценой и остатком (тот, кого выбрала автоматика магазина).
 *
 * Возвращает пустую строку для не-admin/system или для товаров у которых
 * нет «победившего» склада (нет ни одного склада с остатком).
 */
export function getWinningWarehouseSuffix(
  product: ProductLikeForWinningWarehouse,
  isAdminSystem: boolean
): string {
  if (!isAdminSystem) return ""
  const name = (product.winning_warehouse?.name || "").trim()
  return name ? ` (${name})` : ""
}
