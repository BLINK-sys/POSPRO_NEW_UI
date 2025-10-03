import { API_BASE_URL } from "./api-address"

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
  LOGOUT: "/auth/logout",
  PROFILE: "/auth/profile",

  // User management endpoints
  CLIENTS: "/api/clients",
  SYSTEM_USERS: "/api/system-users",

  // Meta endpoints
  BRANDS: "/api/brands",
  STATUSES: "/api/statuses",
  CATEGORIES: "/api/categories",

  // Product endpoints
  PRODUCTS: "/api/products",
  PRODUCT_DRAFTS: "/api/product-drafts",

  // Order endpoints
  ORDERS: "/api/orders",

  // File upload endpoints
  UPLOAD: "/api/upload",
  MEDIA: "/api/media",
} as const

export const USER_ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  OPERATOR: "operator",
} as const

export const ORGANIZATION_TYPES = {
  INDIVIDUAL: "individual",
  IP: "ip",
  TOO: "too",
} as const

export const PRODUCT_STATUSES = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
} as const

export const ORDER_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const

export const ACCESS_PERMISSIONS = {
  DASHBOARD: "dashboard",
  USERS: "users",
  PRODUCTS: "products",
  ORDERS: "orders",
  REPORTS: "reports",
  SETTINGS: "settings",
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 25, 50, 100],
} as const

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const

export const COUNTRIES = ["Россия", "Китай", "США", "Германия", "Япония", "Южная Корея", "Тайвань", "Другое"]

export const ITEMS_PER_PAGE = 10

// Utility function for image URLs
export const getImageUrl = (url: string | null | undefined): string => {
  if (!url || url.trim() === "") return "/placeholder.svg"

  // If URL already starts with http/https, return as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  // If URL starts with /uploads, add the API base URL
  if (url.startsWith("/uploads/")) {
    return `${API_BASE_URL}${url}`
  }

  // For other relative URLs, add the API base URL
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
}

// Homepage Block Types
export const HOMEPAGE_BLOCK_TYPES = {
  CATEGORIES: "categories",
  PRODUCTS: "products",
  BRANDS: "brands",
  BENEFITS: "benefits",
  INFO_CARDS: "info_cards",
} as const

export type HomepageBlockType = typeof HOMEPAGE_BLOCK_TYPES[keyof typeof HOMEPAGE_BLOCK_TYPES]

export const HOMEPAGE_BLOCK_TYPE_LABELS: Record<HomepageBlockType, string> = {
  [HOMEPAGE_BLOCK_TYPES.CATEGORIES]: "Категории",
  [HOMEPAGE_BLOCK_TYPES.PRODUCTS]: "Товары",
  [HOMEPAGE_BLOCK_TYPES.BRANDS]: "Бренды",
  [HOMEPAGE_BLOCK_TYPES.BENEFITS]: "Преимущества",
  [HOMEPAGE_BLOCK_TYPES.INFO_CARDS]: "Информационные карточки",
}

export const TITLE_ALIGN_OPTIONS = [
  { value: "left", label: "По левому краю" },
  { value: "center", label: "По центру" },
  { value: "right", label: "По правому краю" },
] as const

export type TitleAlign = typeof TITLE_ALIGN_OPTIONS[number]["value"]

// Homepage Block Interfaces
export interface HomepageBlock {
  id: number
  title: string
  description?: string  // ✅ Добавлено поле описания
  type: HomepageBlockType
  active: boolean
  order: number
  carusel: boolean
  show_title: boolean
  title_align: TitleAlign
  items: number[] // IDs of categories, products, brands, etc.
}

export interface HomepageBlockItem {
  id: number
  block_id: number
  item_id: number
  order: number
}

export interface CreateHomepageBlockData {
  title: string
  description?: string  // ✅ Добавлено поле описания
  type: HomepageBlockType
  active?: boolean
  carusel?: boolean
  show_title?: boolean
  title_align?: TitleAlign
  items?: number[]
}

export interface UpdateHomepageBlockData extends Partial<CreateHomepageBlockData> {}
