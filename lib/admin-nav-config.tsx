import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BookOpen,
  Briefcase,
  FileText,
  HardDrive,
  LayoutDashboard,
  ListTodo,
  MapPin,
  MessageSquare,
  MonitorSmartphone,
  Package,
  RefreshCw,
  Search,
  Share2,
  ShoppingCart,
  Sparkles,
  Tags,
  Truck,
  Users,
} from "lucide-react"

export type AdminMode = "crm" | "shop"

export interface AdminNavSubItem {
  href: string
  label: string
}

export interface AdminNavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Плоские подпункты, отрисовываются inline под родителем (кейс «Каталог»). */
  children?: AdminNavSubItem[]
}

export interface AdminNavSection {
  id: string
  label: string
  items: AdminNavItem[]
}

/** Контекст доступов для сборки навигации. */
export interface AccessCtx {
  hasKey: (key: string) => boolean
  aiSettingsAccess: boolean
  kpManagementAccess: boolean
}

/** Пути CRM-режима — используются для авто-переключения режима по URL. */
const CRM_PATH_PREFIXES = ["/admin/deals", "/admin/tasks", "/admin/chat"] as const

export function isCrmPath(pathname: string): boolean {
  const norm = pathname.replace(/\/$/, "") || "/"
  return CRM_PATH_PREFIXES.some((p) => norm === p || norm.startsWith(p + "/"))
}

function buildShopSections(a: AccessCtx): AdminNavSection[] {
  const sections: AdminNavSection[] = []

  // — Главная —
  const main: AdminNavItem[] = []
  if (a.hasKey("dashboard")) main.push({ href: "/admin", label: "Дашборд", icon: LayoutDashboard })
  if (a.hasKey("dashboard"))
    main.push({ href: "/admin/customer-activity", label: "Поисковые запросы", icon: Search })
  if (a.hasKey("orders")) main.push({ href: "/admin/orders", label: "Заказы", icon: ShoppingCart })
  if (main.length) sections.push({ id: "main", label: "Главная", items: main })

  // — Справочники —
  const refs: AdminNavItem[] = []
  if (a.hasKey("catalog"))
    refs.push({
      href: "/admin/catalog/categories",
      label: "Каталог",
      icon: Package,
      children: [
        { href: "/admin/catalog/categories", label: "Категории" },
        { href: "/admin/catalog/products", label: "Товары" },
      ],
    })
  if (a.hasKey("users")) refs.push({ href: "/admin/users", label: "Пользователи", icon: Users })
  if (a.hasKey("brands") || a.hasKey("statuses"))
    refs.push({ href: "/admin/brands-and-statuses", label: "Бренды и Статусы", icon: Tags })
  if (a.hasKey("catalog")) refs.push({ href: "/admin/drivers", label: "Драйверы", icon: HardDrive })
  if (a.hasKey("catalog")) refs.push({ href: "/admin/suppliers", label: "Поставщики", icon: Truck })
  if (refs.length) sections.push({ id: "refs", label: "Справочники", items: refs })

  // — Внешний вид —
  if (a.hasKey("pages"))
    sections.push({
      id: "appearance",
      label: "Внешний вид",
      items: [{ href: "/admin/pages", label: "Страницы", icon: FileText }],
    })

  // — Удалённое управление —
  sections.push({
    id: "remote",
    label: "Удалённое управление",
    items: [{ href: "/admin/remote", label: "Удалённое управление", icon: MonitorSmartphone }],
  })

  // — AI настройки —
  if (a.aiSettingsAccess)
    sections.push({
      id: "ai",
      label: "AI настройки",
      items: [{ href: "/admin/ai-consultant", label: "AI настройки", icon: Sparkles }],
    })

  // — Сбор данных —
  if (a.hasKey("catalog"))
    sections.push({
      id: "collect",
      label: "Сбор данных",
      items: [
        { href: "/admin/integrations", label: "Автоматическая выгрузка", icon: RefreshCw },
        { href: "/admin/collector", label: "2GIS сбор данных", icon: MapPin },
      ],
    })

  // — Раздел админа —
  if (a.kpManagementAccess)
    sections.push({
      id: "adminOnly",
      label: "Раздел админа",
      items: [
        { href: "/admin/kp-management", label: "Управление КП", icon: Share2 },
        { href: "/admin/user-activity", label: "Активность", icon: Activity },
      ],
    })

  // — Справка —
  sections.push({
    id: "help",
    label: "Справка",
    items: [{ href: "/admin/help", label: "Справка", icon: BookOpen }],
  })

  return sections
}

function buildCrmSections(_a: AccessCtx): AdminNavSection[] {
  // Каждый CRM-раздел — один пункт. Соответственно, сайдбар для любого CRM-
  // раздела схлопывается (см. поведение в AdminLayout).
  return [
    { id: "deals", label: "Сделки", items: [{ href: "/admin/deals", label: "Сделки", icon: Briefcase }] },
    { id: "tasks", label: "Задачи", items: [{ href: "/admin/tasks", label: "Задачи", icon: ListTodo }] },
    { id: "chat", label: "Чат", items: [{ href: "/admin/chat", label: "Чат", icon: MessageSquare }] },
  ]
}

export function buildAdminSections(mode: AdminMode, access: AccessCtx): AdminNavSection[] {
  return mode === "crm" ? buildCrmSections(access) : buildShopSections(access)
}

/** Нормализация пути: убираем trailing slash. */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/"
}

/**
 * Совпадает ли путь c href пункта. Точное совпадение или подпуть.
 * /admin — специальный случай: только точное совпадение, иначе бы
 * матчил все /admin/*.
 */
function pathMatches(norm: string, href: string): boolean {
  if (href === "/") return false
  if (norm === href) return true
  if (href !== "/admin" && norm.startsWith(href + "/")) return true
  return false
}

/**
 * Ищет раздел, к которому относится текущий путь. Возвращает null если
 * не нашёл (пусть UI выберет дефолтный или ничего не покажет).
 */
export function findSectionForPath(
  sections: AdminNavSection[],
  pathname: string,
): AdminNavSection | null {
  const norm = normalizePath(pathname)
  for (const section of sections) {
    for (const item of section.items) {
      if (pathMatches(norm, item.href)) return section
      if (item.children?.some((c) => pathMatches(norm, c.href))) return section
    }
  }
  return null
}
