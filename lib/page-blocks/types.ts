/**
 * Типы блоков для конструктора статических страниц (см. `PageBuilder`).
 * Контент страницы = JSON-массив `PageBlock[]`, сохраняется в поле
 * `StaticPage.content` как строка. Порядок в массиве = порядок на странице.
 *
 * Для добавления нового типа блока:
 *   1) добавить дискриминант в `PageBlock`
 *   2) дефолт в `defaultBlockData`
 *   3) редактор в `components/page-builder/blocks/<type>-block.tsx`
 *   4) рендер в `components/page-builder/renderer.tsx`
 *   5) пункт в `BLOCK_MENU` (add-menu)
 */

export type BlockAlign = "left" | "center" | "right"
export type ImageAlign = "left" | "center" | "right" | "none"
export type CalloutKind = "info" | "warning" | "success"

export interface HeadingBlock {
  id: string
  type: "heading"
  level: 1 | 2 | 3
  text: string
  align: BlockAlign
}

export interface ParagraphBlock {
  id: string
  type: "paragraph"
  // HTML разрешён (inline formatting через mini-редактор), но допустим и
  // plain text. На публичной стороне контент рендерится через
  // dangerouslySetInnerHTML — но только внутри параграфа, не всей страницы.
  html: string
  align: BlockAlign
}

export interface ImageBlock {
  id: string
  type: "image"
  src: string
  alt: string
  // Ширина в процентах от контейнера (10-100). Пресеты в UI + drag-ручка
  // на правом краю. % а не px — адаптивно на мобилках.
  widthPercent: number
  // Высота в пикселях. Если не задана — auto (сохраняет пропорцию).
  // Задаётся drag-ручкой на нижнем краю или угловой (свободный ресайз).
  heightPx?: number
  align: ImageAlign
}

export interface CalloutBlock {
  id: string
  type: "callout"
  kind: CalloutKind
  html: string
}

export interface DividerBlock {
  id: string
  type: "divider"
}

export interface YoutubeBlock {
  id: string
  type: "youtube"
  // URL любого формата (watch?v=…, youtu.be/…, embed/…) — нормализуется
  // при рендере в embed-URL.
  url: string
}

export interface ButtonBlock {
  id: string
  type: "button"
  text: string
  url: string
  variant: "primary" | "outline"
  align: BlockAlign
}

/**
 * Таблица. cells[row][col] = plain text (без inline-форматирования пока —
 * для тарифов доставки по регионам этого достаточно). hasHeader → первая
 * строка рендерится как <thead> с жирным фоном.
 */
export interface TableBlock {
  id: string
  type: "table"
  hasHeader: boolean
  rows: string[][]
}

/**
 * Колонки — 2 или 3 в ряд, в каждой свой массив блоков (nested).
 * Nested DnD между колонками пока не поддерживаем — добавление и
 * перестановка внутри колонки через кнопки/стрелки. Nested-блок не
 * может сам быть columns (запрещаем на уровне add-menu внутри колонки).
 */
export interface ColumnsBlock {
  id: string
  type: "columns"
  columnsCount: 2 | 3
  items: PageBlock[][]  // items[colIndex] = список блоков в этой колонке
  // Вертикальное выравнивание колонок относительно друг друга (grid align-items)
  verticalAlign?: "top" | "center" | "bottom"
}

/**
 * Legacy-обёртка: если в БД лежит старый HTML (из RichPageEditor до
 * миграции на PageBuilder), фронт загружает его как один блок html.
 * В редакторе он показывается как «сырой HTML» без возможности править
 * визуально — только удалить или заменить.
 */
export interface HtmlBlock {
  id: string
  type: "html"
  html: string
}

export type PageBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | CalloutBlock
  | DividerBlock
  | YoutubeBlock
  | ButtonBlock
  | TableBlock
  | ColumnsBlock
  | HtmlBlock

export type PageBlockType = PageBlock["type"]

/** Простой uid для новых блоков (не криптографический). */
export function newBlockId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function defaultBlockData(type: PageBlockType): PageBlock {
  const id = newBlockId()
  switch (type) {
    case "heading":   return { id, type, level: 2, text: "Новый заголовок", align: "left" }
    case "paragraph": return { id, type, html: "", align: "left" }
    case "image":     return { id, type, src: "", alt: "", widthPercent: 100, align: "none" }
    case "callout":   return { id, type, kind: "info", html: "Текст…" }
    case "divider":   return { id, type }
    case "youtube":   return { id, type, url: "" }
    case "button":    return { id, type, text: "Кнопка", url: "", variant: "primary", align: "left" }
    case "table":     return {
      id, type, hasHeader: true,
      // Стартовая таблица 3×3 с заголовками — юзер добавит/удалит по надобности.
      rows: [
        ["Колонка 1", "Колонка 2", "Колонка 3"],
        ["", "", ""],
        ["", "", ""],
      ],
    }
    case "columns":   return {
      id, type, columnsCount: 2,
      // Пустые колонки — юзер сам добавит блоки через «+ Добавить» внутри.
      items: [[], []],
      verticalAlign: "top",
    }
    case "html":      return { id, type, html: "" }
  }
}

/**
 * Парс контента страницы из БД в массив блоков.
 * - Пусто → []
 * - JSON-массив → как есть (проверяем что каждый элемент — объект с type)
 * - Иначе (старый HTML) → один блок html с этим содержимым (legacy)
 */
export function parsePageContent(raw: string | null | undefined): PageBlock[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((b) => b && typeof b === "object" && typeof b.type === "string")
          .map((b) => ({ ...b, id: b.id || newBlockId() })) as PageBlock[]
      }
    } catch {
      /* fallthrough — покажем как legacy html */
    }
  }
  return [{ id: newBlockId(), type: "html", html: raw }]
}

export function serializePageContent(blocks: PageBlock[]): string {
  return JSON.stringify(blocks)
}
