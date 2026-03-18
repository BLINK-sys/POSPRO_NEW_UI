import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatProductPrice(price?: number | string | null): string {
  if (price === null || price === undefined || price === "" || Number(price) <= 0) {
    return "Цену уточняйте"
  }

  return `${Number(price).toLocaleString("ru-RU")} тг`
}

export function isWholesaleUser(user?: { role?: string; [key: string]: any } | null): boolean {
  if (!user) {
    return false
  }

  if (user.role === "admin" || user.role === "system") {
    return true
  }

  if (user.role === "client") {
    const wholesaleFlag = user.is_wholesale ?? user.isWholesale ?? user.wholesale ?? user.wholesale_status ?? user.isWholeSale

    if (typeof wholesaleFlag === "string") {
      return wholesaleFlag.toLowerCase() === "true"
    }

    if (typeof wholesaleFlag === "number") {
      return wholesaleFlag === 1
    }

    if (typeof wholesaleFlag === "boolean") {
      return wholesaleFlag
    }
  }

  return false
}

export function getRetailPriceClass(showWholesale = false): string {
  // Если показываем обе цены — розница красная, иначе зелёная
  return showWholesale ? "text-red-600" : "text-green-600"
}

export function getWholesalePriceClass(): string {
  return "text-green-600"
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  const raw = digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits
  const d = raw.slice(0, 10)
  let result = "+7"
  if (d.length > 0) result += ` (${d.slice(0, 3)}`
  if (d.length >= 3) result += ")"
  if (d.length > 3) result += ` ${d.slice(3, 6)}`
  if (d.length > 6) result += `-${d.slice(6, 8)}`
  if (d.length > 8) result += `-${d.slice(8, 10)}`
  return result
}