import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatProductPrice(price?: number | null): string {
  if (price === null || price === undefined || price <= 0) {
    return "Цену уточняйте"
  }

  return `${price.toLocaleString("ru-RU")} тг`
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

export function getRetailPriceClass(price?: number | null, wholesaleUser = false): string {
  if (wholesaleUser) {
    return "text-red-600"
  }

  if (price && price > 0) {
    return "text-green-600"
  }

  return "text-red-600"
}

export function getWholesalePriceClass(): string {
  return "text-green-600"
}