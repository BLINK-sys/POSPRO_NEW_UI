/**
 * Общие константы и хелперы для корп.расчётника.
 *
 * Используются И в [`app/calculator/page.tsx`](../app/calculator/page.tsx)
 * (где есть полная логика рендера и состояния), И в [`app/kp/page.tsx`](../app/kp/page.tsx)
 * (где нужно посчитать «контрактную цену» сохранённых calc items для индикатора
 * расхождения с KPItem.price). Источник правды один — чтобы две страницы не
 * расходились в формуле.
 */

// Контрактная сторона ВСЕГДА считается с 16% НДС — глобальное правило,
// не зависит от настроек склада.
export const CONTRACT_VAT_RATE = 16
// НДС себестоимости — 16% если `item.vatEnabled` (склад с НДС), иначе 0.
export const DEFAULT_VAT_RATE = 16

// Минимальный набор полей CalcItem нужный для подсчёта контрактной цены.
// Полный тип живёт в `app/calculator/page.tsx` — здесь только subset.
export interface CalcItemForContract {
  costPriceKzt: number
  vatEnabled: boolean
  deliveryPerUnit: number
  costPerUnitOverride: number | null
  contractPerUnitOverride: number | null
}

/**
 * Считает «Цену за ед.» контрактной стороны для одного товара. Совпадает с
 * логикой `calcRow()` в калькуляторе:
 *
 *   1. Если есть `contractPerUnitOverride` — берём его (ручная фиксация).
 *   2. Иначе считаем: (costPriceKzt без НДС склада + доставка) × 1.16.
 *      `costPriceKzt` уже включает НДС iff `vatEnabled=true`.
 */
export function computeContractPerUnit(item: CalcItemForContract): number {
  if (item.contractPerUnitOverride !== null) return item.contractPerUnitOverride
  const costPerUnit = item.costPerUnitOverride !== null ? item.costPerUnitOverride : item.costPriceKzt
  const costVatMul = item.vatEnabled ? CONTRACT_VAT_RATE / 100 : 0
  const contractVatMul = CONTRACT_VAT_RATE / 100
  const costNoVat = costPerUnit / (1 + costVatMul)
  const contractNoVat = costNoVat + item.deliveryPerUnit
  return contractNoVat * (1 + contractVatMul)
}
