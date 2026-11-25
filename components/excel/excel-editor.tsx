"use client"

/**
 * Встроенный Excel-редактор.
 *
 * Фичи:
 *   • Открывает xlsx/xls/xlsm/ods/csv через SheetJS, сохраняет через
 *     xlsx-js-style (тот же API + запись стилей).
 *   • Сетка «бесконечная»: всегда минимум MIN_ROWS × MIN_COLS плюс
 *     запас за пределами реальных данных — руками «+ Строку» не надо.
 *   • Resize ширины колонки и высоты строки — drag на границе header'а.
 *     Double-click на границе = auto-fit по содержимому. Кнопки в
 *     toolbar применяют auto-fit ко ВСЕМ колонкам / строкам.
 *   • Заливка выделенной ячейки — палитра пресетов + «свой» цвет; «нет
 *     заливки» = сброс.
 *   • Несколько листов — табы снизу, активный переключается.
 *   • Горизонтальный и вертикальный скролл внутри своей области,
 *     sticky header-ряд (A/B/C) и header-колонка (1/2/3).
 *
 * Ограничения намеренно простые (юзер: «небольшие правки»):
 *   • редактируем только значения (text/число);
 *   • формулы — отображаем результат, сохраняем как было (Excel/LO
 *     пересчитают при открытии);
 *   • ничего кроме заливки из форматирования не трогаем.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
// `xlsx-js-style` — drop-in форк SheetJS с поддержкой записи стилей.
// Использовать и для чтения, и для записи — одна библиотека, меньше
// расхождений.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as XLSX from "xlsx-js-style"
import { unzipSync, strFromU8 } from "fflate"
import {
  Loader2, Save, X, Download, FileSpreadsheet, AlertCircle,
  Paintbrush, MoveHorizontal, MoveVertical, ArrowLeft,
  Search, ChevronUp, ChevronDown, Snowflake,
  Bold, Italic, Underline, Type, WrapText,
  AlignLeft, AlignCenter, AlignRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  Hash, Combine, Shuffle, MessageSquare, Trash2, Plus, History,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
  ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent,
} from "@/components/ui/context-menu"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// -----------------------------------------------------------------------------
// Константы
// -----------------------------------------------------------------------------

const MIN_ROWS = 100
const MIN_COLS = 26
const EXTRA_ROWS = 20
const EXTRA_COLS = 5
const DEFAULT_WIDTH = 100
const DEFAULT_HEIGHT = 28
const MIN_WIDTH = 40
const MIN_HEIGHT = 18
const ROW_HEADER_WIDTH = 42
// Отступы input'а в ячейке (px-1.5 с обеих сторон) + запас на бордер.
const CELL_PAD = 14
// Шрифт — совпадает с CSS input'а в ячейке. Нужен для точного
// измерения ширины текста через canvas.
const CELL_FONT = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
// Fallback-эвристика для случаев когда canvas недоступен (SSR).
const CHAR_WIDTH_FALLBACK = 8

// Пресеты заливки — классика Excel highlight'ов.
const FILL_PRESETS = [
  "#FEF3C7", "#FDE68A", "#FCA5A5", "#FECACA",
  "#FBCFE8", "#DDD6FE", "#BFDBFE", "#A5F3FC",
  "#A7F3D0", "#BBF7D0", "#D9F99D", "#FEF08A",
  "#E5E7EB", "#D1D5DB", "#9CA3AF", "#FFFFFF",
]

// -----------------------------------------------------------------------------
// Типы
// -----------------------------------------------------------------------------

interface CellFont {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string   // hex "#RRGGBB"
  name?: string
  sz?: number
}
interface CellAlign {
  h?: "left" | "center" | "right"
  v?: "top" | "middle" | "bottom"
  wrap?: boolean
}

interface Cell {
  value: string
  fill?: string // hex "#RRGGBB"
  font?: CellFont
  align?: CellAlign
  /** Excel number format («0.00», «0%», «#,##0 ₸», «d.m.yyyy» и т.п.).
   *  Применяется при отображении через SSF.format, сохраняется в xlsx
   *  как `cell.z`. Если undefined — показываем raw-значение. */
  numFmt?: string
  /** Заметка/комментарий к ячейке (как у Excel comment).
   *  Красный треугольник в углу + hover-tooltip. */
  comment?: string
}

/** Пресеты форматов чисел — показываются в выпадашке toolbar'а.
 *  Каждый с коротким человеческим названием + сам format-string. */
const NUMFMT_PRESETS: Array<{ name: string; fmt: string }> = [
  { name: "Общий",            fmt: "" },
  { name: "Число",            fmt: "0" },
  { name: "Число (2 знака)",  fmt: "0.00" },
  { name: "Тысячи",           fmt: "#,##0" },
  { name: "Тысячи (2)",       fmt: "#,##0.00" },
  { name: "Процент",          fmt: "0%" },
  { name: "Процент (2)",      fmt: "0.00%" },
  { name: "Тенге",            fmt: "#,##0 \"₸\"" },
  { name: "Рубли",            fmt: "#,##0 \"₽\"" },
  { name: "Доллар",           fmt: "$#,##0.00" },
  { name: "Дата",             fmt: "dd.mm.yyyy" },
  { name: "Время",            fmt: "h:mm:ss" },
  { name: "Дата + время",     fmt: "dd.mm.yyyy h:mm" },
]

const FONT_OPTIONS = [
  "", "Arial", "Calibri", "Helvetica", "Times New Roman",
  "Courier New", "Georgia", "Verdana", "Tahoma", "Comic Sans MS",
] as const
const SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

interface SheetData {
  name: string
  /** Хранилище ячеек. Ключ "r,c". Пустые ячейки отсутствуют. */
  cells: Map<string, Cell>
  /** Максимально занятые значения — для рендера грид + save. */
  maxRow: number
  maxCol: number
  /** Ширина/высота по колонкам/строкам. Отсутствие ключа = default. */
  colWidths: Record<number, number>
  rowHeights: Record<number, number>
  /** Объединённые ячейки (SheetJS `!merges`). Границы включительные. */
  merges: Array<{ sr: number; sc: number; er: number; ec: number }>
  /** Пользовательские правила условного форматирования — живут только в
   *  текущей сессии редактора, в xlsx не сохраняются (overlay-only). */
  rules: ConditionalRule[]
}

/** Правило условного форматирования: диапазон + операция + значение +
 *  стиль. Применяется при рендере поверх базового cell-fill/color. */
interface ConditionalRule {
  id: string
  range: SelectionRange
  op: "<" | "<=" | "=" | "!=" | ">=" | ">"
  value: string
  fill?: string
  textColor?: string
}

/**
 * Диапазон выделения. Границы инклюзивны, направление — любое (при
 * нормализации сортируем). Одна ячейка = r1===r2 && c1===c2.
 * Вся строка = c1=0, c2=cols-1. Весь столбец = r1=0, r2=rows-1.
 * Весь лист = покрывает всё.
 */
interface SelectionRange {
  r1: number
  c1: number
  r2: number
  c2: number
}

function normalizeRange(r: SelectionRange) {
  return {
    minR: Math.min(r.r1, r.r2),
    maxR: Math.max(r.r1, r.r2),
    minC: Math.min(r.c1, r.c2),
    maxC: Math.max(r.c1, r.c2),
  }
}

function inRange(r: SelectionRange, row: number, col: number): boolean {
  const n = normalizeRange(r)
  return row >= n.minR && row <= n.maxR && col >= n.minC && col <= n.maxC
}

/** Короткое текстовое описание диапазона для панели статуса: "A1:C5" или "B2". */
function describeRange(r: SelectionRange): string {
  const n = normalizeRange(r)
  const a = `${colLabel(n.minC)}${n.minR + 1}`
  if (n.minR === n.maxR && n.minC === n.maxC) return a
  const b = `${colLabel(n.maxC)}${n.maxR + 1}`
  return `${a}:${b}`
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function detectBookType(fileName: string): XLSX.BookType {
  const ext = fileName.toLowerCase().split(".").pop() || ""
  if (ext === "csv") return "csv"
  if (ext === "xls") return "xls"
  if (ext === "xlsm") return "xlsm"
  if (ext === "ods") return "ods"
  return "xlsx"
}

/**
 * Декодирует байты CSV в строку, выбирая кодировку по содержимому.
 * У нас приходят csv от разных источников — Google Sheets (UTF-8 с BOM),
 * выгрузки из Б24 / 1С (cp1251), пользовательский экспорт (utf-8 без BOM).
 * SheetJS без подсказки читает csv как UTF-8 → cp1251-файлы становятся
 * «ÐºÐ¾Ð¿Ð¸Ñ€Ð°Ð¹Ñ‚».
 *
 * Логика:
 *   - UTF-8 BOM (ef bb bf)  → срезаем BOM, декодируем UTF-8;
 *   - UTF-16 LE/BE BOM      → декодируем соответствующим кодеком;
 *   - иначе                 → пробуем strict UTF-8; если бросает — cp1251.
 *     Эвристика strict работает, потому что файлы в cp1251 почти всегда
 *     содержат байты, недопустимые в последовательностях UTF-8.
 */
function decodeCsvBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.slice(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.slice(2))
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    // Фоллбэк — Windows-1251: самая частая локальная кодировка для русского.
    return new TextDecoder("windows-1251").decode(bytes)
  }
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`
}

/** Накладывает временный preview поверх ячейки (для live-preview в
 *  dropdown'ах шрифта/размера). Не мутирует исходную ячейку. */
function applyPreview(
  c: Cell | undefined,
  preview: { range: SelectionRange; font?: Partial<CellFont>; align?: Partial<CellAlign> } | null,
  r: number, col: number,
): Cell | undefined {
  if (!preview) return c
  if (!inRange(preview.range, r, col)) return c
  return {
    value: c?.value ?? "",
    fill: c?.fill,
    font: preview.font ? { ...(c?.font || {}), ...preview.font } : c?.font,
    align: preview.align ? { ...(c?.align || {}), ...preview.align } : c?.align,
  }
}

/** Найти merge, содержащий (r,c). Если r,c верхняя-левая — вернуть его.
 *  Иначе вернуть `{inside: true, merge}` чтобы вызывающий пропустил рендер. */
function findMergeAt(
  merges: Array<{ sr: number; sc: number; er: number; ec: number }>,
  r: number, c: number,
): { kind: "topLeft" | "inside"; m: { sr: number; sc: number; er: number; ec: number } } | null {
  for (const m of merges) {
    if (r < m.sr || r > m.er || c < m.sc || c > m.ec) continue
    if (r === m.sr && c === m.sc) return { kind: "topLeft", m }
    return { kind: "inside", m }
  }
  return null
}

/** Применить правила условного форматирования поверх базовой ячейки.
 *  Возвращает ПАТЧИ для fill/color, которые перекрывают базу. */
function applyRules(
  rules: ConditionalRule[],
  r: number, c: number,
  value: string,
): { fill?: string; color?: string } {
  const out: { fill?: string; color?: string } = {}
  for (const rule of rules) {
    if (!inRange(rule.range, r, c)) continue
    if (!matchRule(value, rule)) continue
    if (rule.fill) out.fill = rule.fill
    if (rule.textColor) out.color = rule.textColor
  }
  return out
}

function matchRule(value: string, rule: ConditionalRule): boolean {
  const lhsNum = Number(value)
  const rhsNum = Number(rule.value)
  const bothNumbers = !Number.isNaN(lhsNum) && !Number.isNaN(rhsNum)
  if (bothNumbers) {
    switch (rule.op) {
      case "<":  return lhsNum < rhsNum
      case "<=": return lhsNum <= rhsNum
      case "=":  return lhsNum === rhsNum
      case "!=": return lhsNum !== rhsNum
      case ">=": return lhsNum >= rhsNum
      case ">":  return lhsNum > rhsNum
    }
  }
  // Строковое сравнение (только = и !=).
  if (rule.op === "=") return value === rule.value
  if (rule.op === "!=") return value !== rule.value
  return false
}

/** CSS-стили ячейки для view-/edit-режима: font + alignment + wrap. */
function buildCellStyle(c: Cell | undefined): React.CSSProperties {
  if (!c) return {}
  const s: React.CSSProperties = {}
  if (c.font) {
    if (c.font.bold) s.fontWeight = "bold"
    if (c.font.italic) s.fontStyle = "italic"
    if (c.font.underline) s.textDecoration = "underline"
    if (c.font.color) s.color = c.font.color
    if (c.font.name) s.fontFamily = c.font.name
    if (c.font.sz) s.fontSize = `${c.font.sz}px`
  }
  if (c.align) {
    if (c.align.h) s.textAlign = c.align.h
    if (c.align.v) {
      // Flex-контейнер (см. className ячейки) — используем align-items.
      s.alignItems = c.align.v === "top" ? "flex-start"
        : c.align.v === "bottom" ? "flex-end"
        : "center"
    } else {
      s.alignItems = "center"
    }
    if (!c.align.h) {
      // Default: left для текста, right для чисел — упрощение, left.
      s.justifyContent = "flex-start"
    } else {
      s.justifyContent = c.align.h === "right" ? "flex-end"
        : c.align.h === "center" ? "center"
        : "flex-start"
    }
  } else {
    s.alignItems = "center"
    s.justifyContent = "flex-start"
  }
  return s
}

function cellToString(v: unknown): string {
  if (v == null) return ""
  if (v instanceof Date) {
    const h = v.getHours() + v.getMinutes() + v.getSeconds()
    return h === 0 ? v.toISOString().slice(0, 10) : v.toISOString()
  }
  return String(v)
}

function parseCellValue(s: string): string | number {
  if (s === "") return ""
  const trimmed = s.trim()
  if (trimmed === "") return s
  const n = Number(trimmed)
  if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(trimmed)) return n
  return s
}

/** A, B, …, Z, AA, AB, …, AZ, BA, …, ZZ, AAA, … */
function colLabel(i: number): string {
  let n = i
  let s = ""
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

// Один общий canvas для измерения. Шрифт берём РЕАЛЬНЫЙ из computed-
// style любого input'а в сетке — иначе canvas меряет по «14px sans-serif»,
// а браузер отображает другим шрифтом с другими метриками, и auto-fit
// получается то коротким, то длинным. setMeasureFont() вызывается из
// SheetTable после mount, когда DOM-input уже есть.
let _measureCtx: CanvasRenderingContext2D | null = null
let _measureFont = CELL_FONT

function setMeasureFont(font: string) {
  _measureFont = font
  if (_measureCtx) _measureCtx.font = font
}

function measureTextWidth(text: string): number {
  if (!text) return 0
  if (typeof document === "undefined") {
    return text.length * CHAR_WIDTH_FALLBACK
  }
  if (!_measureCtx) {
    const canvas = document.createElement("canvas")
    _measureCtx = canvas.getContext("2d")
    if (_measureCtx) _measureCtx.font = _measureFont
  }
  if (!_measureCtx) return text.length * CHAR_WIDTH_FALLBACK
  _measureCtx.font = _measureFont
  return _measureCtx.measureText(text).width
}

/** Точная ширина контента ячейки с учётом переносов строк. */
function estimateWidth(text: string): number {
  if (!text) return DEFAULT_WIDTH
  const lines = String(text).split("\n")
  const longestPx = lines.reduce(
    (m, l) => Math.max(m, measureTextWidth(l)),
    0,
  )
  return Math.max(MIN_WIDTH, Math.ceil(longestPx) + CELL_PAD)
}

/** Высота для многострочного текста (1 строка ≈ 18px). */
function estimateHeight(text: string): number {
  if (!text) return DEFAULT_HEIGHT
  const lines = String(text).split("\n").length
  return Math.max(MIN_HEIGHT, lines * 18 + 10)
}

// -----------------------------------------------------------------------------
// Load / Save
// -----------------------------------------------------------------------------

/**
 * xlsx-js-style v1.2.0 корректно сохраняет стили в styles.xml при WRITE,
 * и корректно парсит styles.xml в `wb.Styles` при READ — но при переносе
 * в `cell.s` теряет всё кроме `fill` (font/alignment просто не попадают
 * на ячейку). В итоге после save+reopen шрифты/выравнивание пропадают.
 *
 * Чиним в обход: распаковываем xlsx руками через fflate, достаём
 * индекс стиля `s="N"` из sheet.xml для каждой ячейки и применяем
 * к ней font/fill/alignment/numFmt из `wb.Styles.CellXf[N]`.
 */
function applyStylesFromZip(
  buf: ArrayBuffer,
  wb: XLSX.WorkBook,
  sheets: SheetData[],
): void {
  const styles: any = (wb as any).Styles
  const cellXfs: any[] = styles?.CellXf
  if (!Array.isArray(cellXfs) || !cellXfs.length) return
  const fonts: any[] = styles?.Fonts || []
  const fills: any[] = styles?.Fills || []
  const numFmts: Record<string, string> = {}
  if (Array.isArray(styles?.NumberFmt)) {
    for (const nf of styles.NumberFmt) {
      if (nf && typeof nf.numFmtId !== "undefined" && typeof nf.formatCode === "string") {
        numFmts[String(nf.numFmtId)] = nf.formatCode
      }
    }
  }
  // Встроенные форматы Excel (минимально необходимый набор).
  const BUILTIN_NUMFMTS: Record<string, string> = {
    "0": "General",
    "1": "0",
    "2": "0.00",
    "3": "#,##0",
    "4": "#,##0.00",
    "9": "0%",
    "10": "0.00%",
    "11": "0.00E+00",
    "14": "m/d/yyyy",
    "22": "m/d/yyyy h:mm",
    "37": "#,##0_);(#,##0)",
    "39": "#,##0.00_);(#,##0.00)",
  }

  let un: Record<string, Uint8Array>
  try {
    un = unzipSync(new Uint8Array(buf))
  } catch {
    return
  }

  const wbXmlBytes = un["xl/workbook.xml"]
  const relsXmlBytes = un["xl/_rels/workbook.xml.rels"]
  if (!wbXmlBytes || !relsXmlBytes) return
  const wbXml = strFromU8(wbXmlBytes)
  const relsXml = strFromU8(relsXmlBytes)

  const relsMap = new Map<string, string>()
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) {
    relsMap.set(m[1], m[2])
  }

  const sheetTargets = new Map<string, string>()
  for (const m of wbXml.matchAll(/<sheet\b[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
    const target = relsMap.get(m[2])
    if (!target) continue
    const normalized = target.startsWith("/")
      ? target.slice(1)
      : target.startsWith("xl/") ? target : `xl/${target}`
    sheetTargets.set(m[1], normalized)
  }

  const defaultFontName = fonts[0]?.name
  const defaultFontSz = typeof fonts[0]?.sz === "number" ? fonts[0].sz : undefined

  for (const sheet of sheets) {
    const target = sheetTargets.get(sheet.name)
    if (!target) continue
    const sheetBytes = un[target]
    if (!sheetBytes) continue
    const sheetXml = strFromU8(sheetBytes)
    // Ищем ячейки с атрибутом s="N". Паттерн покрывает и
    // self-closing (`<c r="A1" s="3"/>`), и с содержимым.
    for (const m of sheetXml.matchAll(/<c\b([^>]*?)>/g)) {
      const attrs = m[1]
      const refMatch = attrs.match(/\br="([A-Z]+\d+)"/)
      const sMatch = attrs.match(/\bs="(\d+)"/)
      if (!refMatch || !sMatch) continue
      const addr = refMatch[1]
      const sIdx = parseInt(sMatch[1], 10)
      const xf = cellXfs[sIdx]
      if (!xf) continue

      const rc = XLSX.utils.decode_cell(addr)
      const key = cellKey(rc.r, rc.c)
      let cell = sheet.cells.get(key)
      if (!cell) {
        cell = { value: "" }
        sheet.cells.set(key, cell)
        if (rc.r > sheet.maxRow) sheet.maxRow = rc.r
        if (rc.c > sheet.maxCol) sheet.maxCol = rc.c
      }

      // Font: применяем только отличающееся от дефолта (чтобы
      // не захламлять ячейку "font:{}").
      const font = fonts[xf.fontId]
      if (font) {
        const f: CellFont = {}
        if (font.bold) f.bold = true
        if (font.italic) f.italic = true
        if (font.underline) f.underline = true
        if (font.color?.rgb) {
          const hex = normalizeHex(font.color.rgb)
          if (hex) f.color = hex
        }
        if (font.name && font.name !== defaultFontName) f.name = font.name
        if (typeof font.sz === "number" && font.sz !== defaultFontSz) f.sz = font.sz
        if (Object.keys(f).length) cell.font = f
      }

      // Fill: только для patternType === "solid" с fgColor.
      const fill = fills[xf.fillId]
      if (fill && fill.patternType === "solid") {
        const rgb = fill.fgColor?.rgb || fill.bgColor?.rgb
        if (rgb) {
          const hex = normalizeHex(rgb)
          if (hex) cell.fill = hex
        }
      }

      // Alignment.
      if (xf.alignment) {
        const a = xf.alignment
        const out: CellAlign = {}
        if (a.horizontal && ["left", "center", "right"].includes(a.horizontal)) {
          out.h = a.horizontal
        }
        if (a.vertical === "top") out.v = "top"
        else if (a.vertical === "center") out.v = "middle"
        else if (a.vertical === "bottom") out.v = "bottom"
        if (a.wrapText) out.wrap = true
        if (Object.keys(out).length) cell.align = out
      }

      // numFmt — если не cell.numFmt уже стоит и xf ссылается
      // на нестандартный формат.
      if (!cell.numFmt) {
        const nfId = String(xf.numFmtId ?? "")
        const code = numFmts[nfId] || BUILTIN_NUMFMTS[nfId]
        if (code && code !== "General") cell.numFmt = code
      }
    }
  }
}

function parseWorkbook(wb: XLSX.WorkBook): SheetData[] {
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const cells = new Map<string, Cell>()
    let maxRow = 0
    let maxCol = 0
    if (ws && ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]!)
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c })
          const cell = ws[addr] as XLSX.CellObject | undefined
          if (!cell) continue
          const value = cellToString(cell.w ?? cell.v)
          const fill = extractFill(cell)
          const font = extractFont(cell)
          const align = extractAlign(cell)
          const numFmt = (cell as any).z || undefined
          const comment = extractComment(cell)
          if (value === "" && !fill && !font && !align && !numFmt && !comment) continue
          cells.set(cellKey(r, c), { value, fill, font, align, numFmt, comment })
          if (r > maxRow) maxRow = r
          if (c > maxCol) maxCol = c
        }
      }
    }
    // Ширины колонок — SheetJS хранит в !cols как объекты { wpx, wch, width }.
    const colWidths: Record<number, number> = {}
    const cols = (ws && (ws as any)["!cols"]) as Array<any> | undefined
    if (Array.isArray(cols)) {
      cols.forEach((col, i) => {
        if (!col) return
        if (typeof col.wpx === "number") colWidths[i] = col.wpx
        else if (typeof col.wch === "number") colWidths[i] = col.wch * CHAR_WIDTH + CELL_PAD
      })
    }
    const rowHeights: Record<number, number> = {}
    const rows = (ws && (ws as any)["!rows"]) as Array<any> | undefined
    if (Array.isArray(rows)) {
      rows.forEach((row, i) => {
        if (!row) return
        if (typeof row.hpx === "number") rowHeights[i] = row.hpx
      })
    }
    // Merges — SheetJS формат {s:{r,c}, e:{r,c}} → наш.
    const merges: SheetData["merges"] = []
    const srcMerges = (ws && (ws as any)["!merges"]) as Array<any> | undefined
    if (Array.isArray(srcMerges)) {
      for (const m of srcMerges) {
        if (!m?.s || !m?.e) continue
        merges.push({ sr: m.s.r, sc: m.s.c, er: m.e.r, ec: m.e.c })
      }
    }
    return { name, cells, maxRow, maxCol, colWidths, rowHeights, merges, rules: [] }
  })
}

/** Форматирует значение ячейки по SheetJS-формату (SSF). Если формат
 *  не задан или строка не число — возвращаем raw. */
function formatCellValue(value: string, numFmt?: string): string {
  if (!numFmt || numFmt === "General" || numFmt === "@") return value
  const num = Number(value)
  if (Number.isNaN(num)) return value
  try {
    // xlsx-js-style экспортирует SSF (same as sheetjs).
    const SSF = (XLSX as any).SSF
    if (SSF?.format) return SSF.format(numFmt, num)
  } catch { /* fall through */ }
  return value
}

/** Вытащить текст comment'а из SheetJS: `cell.c` — массив заметок. */
function extractComment(cell: XLSX.CellObject): string | undefined {
  const comments = (cell as any).c
  if (!Array.isArray(comments) || !comments.length) return undefined
  const texts = comments.map((n: any) => n?.t).filter(Boolean)
  return texts.join("\n") || undefined
}

function extractFill(cell: XLSX.CellObject): string | undefined {
  const s = (cell as any).s
  if (!s) return undefined
  // xlsx-js-style на READ раскладывает fill двумя разными способами:
  // (а) вложенно — s.fill.fgColor.rgb (как мы сами пишем на SAVE),
  // (б) плоско — s.patternType / s.fgColor прямо на s (так приходит
  //     после roundtrip через его же XLSX.write → XLSX.read).
  // Проверяем оба варианта.
  const rgb =
    s.fill?.fgColor?.rgb || s.fill?.bgColor?.rgb ||
    (s.patternType === "solid" ? (s.fgColor?.rgb || s.bgColor?.rgb) : undefined)
  if (!rgb) return undefined
  return normalizeHex(rgb)
}

function normalizeHex(rgb: string): string | undefined {
  const clean = String(rgb).replace(/^#/, "").toUpperCase()
  if (clean.length === 8) return "#" + clean.slice(2) // ARGB → RGB
  if (clean.length === 6) return "#" + clean
  return undefined
}

function extractFont(cell: XLSX.CellObject): CellFont | undefined {
  const s = (cell as any).s
  const f = s?.font
  if (!f) return undefined
  const out: CellFont = {}
  if (f.bold) out.bold = true
  if (f.italic) out.italic = true
  if (f.underline) out.underline = true
  if (f.color?.rgb) out.color = normalizeHex(f.color.rgb)
  if (f.name) out.name = f.name
  if (typeof f.sz === "number") out.sz = f.sz
  return Object.keys(out).length ? out : undefined
}

function extractAlign(cell: XLSX.CellObject): CellAlign | undefined {
  const s = (cell as any).s
  const a = s?.alignment
  if (!a) return undefined
  const out: CellAlign = {}
  if (a.horizontal && ["left", "center", "right"].includes(a.horizontal)) out.h = a.horizontal
  if (a.vertical) {
    // SheetJS vertical: top/center/bottom.
    if (a.vertical === "top") out.v = "top"
    else if (a.vertical === "center") out.v = "middle"
    else if (a.vertical === "bottom") out.v = "bottom"
  }
  if (a.wrapText) out.wrap = true
  return Object.keys(out).length ? out : undefined
}

function buildWorksheet(sheet: SheetData): XLSX.WorkSheet {
  // Собираем AOA до фактических размеров (maxRow × maxCol).
  const rows = Math.max(sheet.maxRow + 1, 1)
  const cols = Math.max(sheet.maxCol + 1, 1)
  const aoa: any[][] = Array.from({ length: rows }, () => Array(cols).fill(""))
  for (const [key, c] of sheet.cells) {
    const [r, cc] = key.split(",").map(Number)
    if (r < rows && cc < cols) aoa[r][cc] = parseCellValue(c.value)
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // xlsx-js-style ожидает ЦВЕТА в ARGB (8 hex-символов с FF-префиксом
  // для alpha=1). Если передать 6-символьный RGB — стиль сохраняется
  // в файл, но Excel/LibreOffice (и наш же XLSX.read на следующем
  // открытии) его просто игнорируют. Поэтому нормализуем.
  const toArgb = (hex: string): string => {
    const clean = hex.replace(/^#/, "").toUpperCase()
    if (clean.length === 8) return clean
    if (clean.length === 6) return "FF" + clean
    return clean
  }
  // Применяем стили (fill + font + alignment).
  for (const [key, c] of sheet.cells) {
    if (!c.fill && !c.font && !c.align) continue
    const [r, cc] = key.split(",").map(Number)
    const addr = XLSX.utils.encode_cell({ r, c: cc })
    const prev = (ws[addr] as any) || { t: "s", v: "" }
    const style: any = { ...(prev.s || {}) }
    if (c.fill) {
      const rgb = toArgb(c.fill)
      style.fill = {
        patternType: "solid",
        fgColor: { rgb },
        bgColor: { rgb },
      }
    }
    if (c.font) {
      const f: any = { ...(style.font || {}) }
      if (c.font.bold) f.bold = true
      if (c.font.italic) f.italic = true
      if (c.font.underline) f.underline = true
      if (c.font.color) f.color = { rgb: toArgb(c.font.color) }
      if (c.font.name) f.name = c.font.name
      if (c.font.sz) f.sz = c.font.sz
      style.font = f
    }
    if (c.align) {
      const a: any = { ...(style.alignment || {}) }
      if (c.align.h) a.horizontal = c.align.h
      if (c.align.v) a.vertical = c.align.v === "middle" ? "center" : c.align.v
      if (c.align.wrap) a.wrapText = true
      style.alignment = a
    }
    const next: any = { ...prev, s: style }
    if (c.numFmt) next.z = c.numFmt
    if (c.comment) {
      // SheetJS хранит комменты как массив {a,t}. Один автор ок.
      next.c = [{ a: "PosPro Editor", t: c.comment }]
    }
    ws[addr] = next
  }
  // В конце — numFmt без стилей (для ячеек где style не менялся).
  for (const [key, c] of sheet.cells) {
    if (!c.numFmt && !c.comment) continue
    if (c.fill || c.font || c.align) continue  // уже обработали выше
    const [r, cc] = key.split(",").map(Number)
    const addr = XLSX.utils.encode_cell({ r, c: cc })
    const prev = (ws[addr] as any) || { t: "s", v: "" }
    const next: any = { ...prev }
    if (c.numFmt) next.z = c.numFmt
    if (c.comment) next.c = [{ a: "PosPro Editor", t: c.comment }]
    ws[addr] = next
  }
  // Merges.
  if (sheet.merges.length) {
    (ws as any)["!merges"] = sheet.merges.map((m) => ({
      s: { r: m.sr, c: m.sc },
      e: { r: m.er, c: m.ec },
    }))
  }
  // Ширины колонок.
  const maxC = Math.max(
    sheet.maxCol,
    ...Object.keys(sheet.colWidths).map(Number),
  )
  if (Object.keys(sheet.colWidths).length) {
    const cols2: Array<{ wpx?: number }> = []
    for (let i = 0; i <= maxC; i++) {
      cols2.push(sheet.colWidths[i] != null ? { wpx: sheet.colWidths[i] } : {})
    }
    ;(ws as any)["!cols"] = cols2
  }
  const maxR = Math.max(
    sheet.maxRow,
    ...Object.keys(sheet.rowHeights).map(Number),
  )
  if (Object.keys(sheet.rowHeights).length) {
    const rows2: Array<{ hpx?: number }> = []
    for (let i = 0; i <= maxR; i++) {
      rows2.push(sheet.rowHeights[i] != null ? { hpx: sheet.rowHeights[i] } : {})
    }
    ;(ws as any)["!rows"] = rows2
  }
  return ws
}

// =============================================================================
// Главный компонент
// =============================================================================

export default function ExcelEditor({ attachmentId }: { attachmentId: number }) {
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("Файл")
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selection, setSelection] = useState<SelectionRange | null>(null)
  // Edit-state поднят в parent, чтобы keyboard-shortcut'ы (F2 / начал
  // печатать) могли управлять им не только из таблицы.
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null)
  const [editValue, setEditValue] = useState("")
  // Какая ячейка сейчас под курсором — для popover-tooltip'а комментария.
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null)
  // Зафиксированное выделение на момент открытия ПКМ-меню. Используется
  // в onCellContextAction как источник правды: между открытием меню и
  // кликом по пункту `selection` может сброситься (React/Radix race),
  // а здесь оно не меняется.
  const contextSelectionRef = useRef<SelectionRange | null>(null)
  // Ref на scroll-контейнер таблицы — нужен в parent'е для
  // scroll-into-view при навигации стрелками.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Заморозка первой строки / первого столбца. Сохраняется per-sheet?
  // Пока — global, одно значение на файл. Если нужно — легко сделать
  // per-sheet в Map.
  const [frozenRow, setFrozenRow] = useState(false)
  const [frozenCol, setFrozenCol] = useState(false)

  // Zoom через Ctrl+scroll. Применяется CSS `zoom` на table —
  // Chrome/Edge/Safari поддерживают, Firefox игнорирует (минорный).
  const [zoom, setZoom] = useState(1)

  // Поиск (Ctrl+F). searchOpen управляется hotkey'ем и кнопкой «✕».
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchMatchIdx, setSearchMatchIdx] = useState(0)

  // Confirm-dialog при попытке выйти с несохранёнными правками.
  // Вместо нативного confirm() — AlertDialog с тремя вариантами.
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  // Диалог правил условного форматирования.
  const [rulesOpen, setRulesOpen] = useState(false)
  // Диалог редактирования комментария к ячейке. Содержит координаты и
  // текущий текст (черновик, применяется только по «Сохранить»).
  const [commentDialog, setCommentDialog] = useState<
    { r: number; c: number; text: string } | null
  >(null)

  // Live-preview при hover на пункте выпадашки шрифта/размера: временно
  // применяет font/align к ячейкам в range БЕЗ записи в sheet.cells —
  // просто overlay при рендере. Сброс (null) на onMouseLeave / click.
  const [previewStyle, setPreviewStyle] = useState<{
    range: SelectionRange
    font?: Partial<CellFont>
    align?: Partial<CellAlign>
  } | null>(null)

  const workbookRef = useRef<XLSX.WorkBook | null>(null)
  // История для Undo/Redo per-sheet: ключ — индекс листа, значение —
  // два стека snapshot'ов самого SheetData до изменения.
  // Лимит 30 — больше не держим в памяти, старое вытесняется.
  const historyRef = useRef<Map<number, { undo: SheetData[]; redo: SheetData[] }>>(new Map())
  const HISTORY_LIMIT = 30

  // Имя файла из sessionStorage (его кладёт CrmDocumentsCard).
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = sessionStorage.getItem(`excel-editor:${attachmentId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as { fileName?: string }
      if (parsed.fileName) setFileName(parsed.fileName)
    } catch { /* noop */ }
  }, [attachmentId])

  // Загрузка файла с диска. Используется и на mount, и при restore
  // версии из истории — просто перечитывает текущее содержимое.
  const reloadFromDisk = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/attachments/${attachmentId}/raw`,
        { cache: "no-store" },
      )
      if (!res.ok) {
        const text = await res.text()
        let msg = `HTTP ${res.status}`
        try { msg = JSON.parse(text).error || msg } catch { /* oops */ }
        throw new Error(msg)
      }
      const buf = await res.arrayBuffer()
      // CSV идёт через свой декодер — SheetJS без подсказки ломает кириллицу
      // в cp1251-файлах (см. decodeCsvBytes). xlsx/ods/xls — бинарный
      // read из массива, с ними decode не нужен.
      // Опираться на fileName нельзя: имя подтягивается из sessionStorage
      // позже этого fetch'а, поэтому детектим по сигнатуре байт.
      // xlsx/ods — ZIP (PK\x03\x04), xls — OLE (D0 CF 11 E0), всё
      // остальное считаем текстом → csv.
      const sig = new Uint8Array(buf.slice(0, 4))
      const isZip = sig[0] === 0x50 && sig[1] === 0x4b
      const isOle = sig[0] === 0xd0 && sig[1] === 0xcf && sig[2] === 0x11 && sig[3] === 0xe0
      const isCsv = !isZip && !isOle
      const wb = isCsv
        ? XLSX.read(decodeCsvBytes(buf), { type: "string", cellDates: true })
        : XLSX.read(buf, { type: "array", cellDates: true, cellStyles: true })
      workbookRef.current = wb
      const parsed = parseWorkbook(wb)
      // Восстанавливаем font/fill/alignment/numFmt из styles.xml в обход
      // бага xlsx-js-style (см. applyStylesFromZip). Для csv стилей
      // в файле нет — пропускаем.
      if (!isCsv) {
        try {
          applyStylesFromZip(buf, wb, parsed)
        } catch (e) {
          console.warn("[excel] applyStylesFromZip failed:", e)
        }
      }
      setSheets(parsed)
      setActiveIdx(0)
      setSelection(null)
      setDirty(false)
      // История — отдельный стэк per-sheet; на reload очищаем.
      historyRef.current.clear()
    } catch (e: any) {
      setError(e?.message || "Не удалось открыть файл")
    } finally {
      setLoading(false)
    }
  }, [attachmentId])

  useEffect(() => { reloadFromDisk() }, [reloadFromDisk])

  // Предупреждение при закрытии вкладки с несохранёнными правками.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // -------- Mutations --------

  const mutateActive = useCallback((fn: (sh: SheetData) => SheetData) => {
    setSheets((prev) => {
      const before = prev[activeIdx]
      const next = [...prev]
      next[activeIdx] = fn(before)
      // В историю — snapshot ДО изменения. Redo-стек чистим (любая
      // новая правка «ломает» future).
      const h = historyRef.current.get(activeIdx) ?? { undo: [], redo: [] }
      h.undo.push(before)
      if (h.undo.length > HISTORY_LIMIT) h.undo.shift()
      h.redo.length = 0
      historyRef.current.set(activeIdx, h)
      return next
    })
    setDirty(true)
  }, [activeIdx])

  const undo = useCallback(() => {
    const h = historyRef.current.get(activeIdx)
    if (!h || !h.undo.length) return
    const prev = h.undo.pop()!
    setSheets((s) => {
      const current = s[activeIdx]
      h.redo.push(current)
      const n = [...s]
      n[activeIdx] = prev
      return n
    })
    setDirty(true)
  }, [activeIdx])

  const redo = useCallback(() => {
    const h = historyRef.current.get(activeIdx)
    if (!h || !h.redo.length) return
    const next = h.redo.pop()!
    setSheets((s) => {
      const current = s[activeIdx]
      h.undo.push(current)
      const n = [...s]
      n[activeIdx] = next
      return n
    })
    setDirty(true)
  }, [activeIdx])

  const updateCell = useCallback((row: number, col: number, value: string) => {
    mutateActive((sh) => {
      const cells = new Map(sh.cells)
      const key = cellKey(row, col)
      const existing = cells.get(key)
      if (value === "" && !existing?.fill) {
        cells.delete(key)
      } else {
        cells.set(key, { value, fill: existing?.fill })
      }
      return {
        ...sh,
        cells,
        maxRow: Math.max(sh.maxRow, row),
        maxCol: Math.max(sh.maxCol, col),
      }
    })
  }, [mutateActive])

  // Очистить значения выделенного диапазона. Fill остаётся (если был).
  const clearSelectionValues = useCallback((range: SelectionRange) => {
    mutateActive((sh) => {
      const cells = new Map(sh.cells)
      const n = normalizeRange(range)
      for (let r = n.minR; r <= n.maxR; r++) {
        for (let c = n.minC; c <= n.maxC; c++) {
          const key = cellKey(r, c)
          const existing = cells.get(key)
          if (!existing) continue
          if (existing.fill) {
            cells.set(key, { value: "", fill: existing.fill })
          } else {
            cells.delete(key)
          }
        }
      }
      return { ...sh, cells }
    })
  }, [mutateActive])

  // Buffer на уровне компонента — вдруг clipboard-API недоступен
  // (http-контекст, браузер blocked). Будет работать внутри одного окна.
  const internalClipboardRef = useRef<string>("")

  const copySelection = useCallback(async () => {
    if (!selection) return
    const sheet = sheets[activeIdx]
    if (!sheet) return
    const n = normalizeRange(selection)
    const lines: string[] = []
    for (let r = n.minR; r <= n.maxR; r++) {
      const row: string[] = []
      for (let c = n.minC; c <= n.maxC; c++) {
        row.push(sheet.cells.get(cellKey(r, c))?.value ?? "")
      }
      lines.push(row.join("\t"))
    }
    const tsv = lines.join("\n")
    internalClipboardRef.current = tsv
    try { await navigator.clipboard.writeText(tsv) } catch { /* noop */ }
  }, [selection, sheets, activeIdx])

  const cutSelection = useCallback(async () => {
    if (!selection) return
    await copySelection()
    clearSelectionValues(selection)
  }, [selection, copySelection, clearSelectionValues])

  const pasteFromClipboard = useCallback(async () => {
    if (!selection) return
    let text = internalClipboardRef.current
    try {
      const fromOs = await navigator.clipboard.readText()
      if (fromOs) text = fromOs
    } catch { /* используем internal */ }
    if (!text) return
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
    if (lines.length && lines[lines.length - 1] === "") lines.pop()
    if (lines.length === 0) return
    const n = normalizeRange(selection)
    let lastR = n.minR
    let lastC = n.minC
    mutateActive((sh) => {
      const cells = new Map(sh.cells)
      let maxRow = sh.maxRow
      let maxCol = sh.maxCol
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split("\t")
        for (let j = 0; j < parts.length; j++) {
          const rr = n.minR + i
          const cc = n.minC + j
          const existing = cells.get(cellKey(rr, cc)) ?? { value: "" }
          const value = parts[j]
          if (value === "" && !existing.fill) {
            cells.delete(cellKey(rr, cc))
          } else {
            cells.set(cellKey(rr, cc), { ...existing, value })
            if (rr > maxRow) maxRow = rr
            if (cc > maxCol) maxCol = cc
          }
          if (rr > lastR) lastR = rr
          if (cc > lastC) lastC = cc
        }
      }
      return { ...sh, cells, maxRow, maxCol }
    })
    // Расширяем выделение до вставленного.
    setSelection({ r1: n.minR, c1: n.minC, r2: lastR, c2: lastC })
  }, [selection, mutateActive])

  // -------- Keyboard: навигация + hotkeys + «печать = edit» --------

  // Параметры сетки (нужны для границ навигации) — продублируем здесь,
  // чтобы не пробрасывать через лишние props. Берём максимум между
  // данными и минимумом сетки (совпадает с логикой SheetTable).
  const activeSheetForNav = sheets[activeIdx]
  const rowsForNav = activeSheetForNav
    ? Math.max(activeSheetForNav.maxRow + 1 + EXTRA_ROWS, MIN_ROWS)
    : MIN_ROWS
  const colsForNav = activeSheetForNav
    ? Math.max(activeSheetForNav.maxCol + 1 + EXTRA_COLS, MIN_COLS)
    : MIN_COLS

  const moveSelection = useCallback((dr: number, dc: number, extend: boolean) => {
    setSelection((prev) => {
      const base = prev ?? { r1: 0, c1: 0, r2: 0, c2: 0 }
      const r2 = Math.max(0, Math.min(rowsForNav - 1, base.r2 + dr))
      const c2 = Math.max(0, Math.min(colsForNav - 1, base.c2 + dc))
      if (extend) return { r1: base.r1, c1: base.c1, r2, c2 }
      return { r1: r2, c1: c2, r2, c2 }
    })
  }, [rowsForNav, colsForNav])

  // setRangeStyle и toggleFontFlag объявляем ДО keyboard-useEffect'а,
  // потому что handler использует toggleFontFlag для Ctrl+B/I/U.
  const setRangeStyle = useCallback((
    range: SelectionRange,
    patch: { font?: Partial<CellFont>; align?: Partial<CellAlign> },
  ) => {
    mutateActive((sh) => {
      const cells = new Map(sh.cells)
      const n = normalizeRange(range)
      let maxRow = sh.maxRow
      let maxCol = sh.maxCol
      for (let r = n.minR; r <= n.maxR; r++) {
        for (let c = n.minC; c <= n.maxC; c++) {
          const key = cellKey(r, c)
          const existing = cells.get(key) ?? { value: "" }
          let font = existing.font
          let align = existing.align
          if (patch.font) {
            font = { ...(font || {}), ...patch.font }
            for (const k of Object.keys(font)) {
              if ((font as any)[k] === undefined || (font as any)[k] === false) {
                delete (font as any)[k]
              }
            }
            if (Object.keys(font).length === 0) font = undefined
          }
          if (patch.align) {
            align = { ...(align || {}), ...patch.align }
            for (const k of Object.keys(align)) {
              if ((align as any)[k] === undefined || (align as any)[k] === false) {
                delete (align as any)[k]
              }
            }
            if (Object.keys(align).length === 0) align = undefined
          }
          cells.set(key, { ...existing, font, align })
          if (r > maxRow) maxRow = r
          if (c > maxCol) maxCol = c
        }
      }
      return { ...sh, cells, maxRow, maxCol }
    })
  }, [mutateActive])

  const toggleFontFlag = useCallback((
    range: SelectionRange,
    key: "bold" | "italic" | "underline",
  ) => {
    const sh = sheets[activeIdx]
    if (!sh) return
    const n = normalizeRange(range)
    const firstCell = sh.cells.get(cellKey(n.minR, n.minC))
    const currentlyOn = !!firstCell?.font?.[key]
    setRangeStyle(range, { font: { [key]: !currentlyOn } as Partial<CellFont> })
  }, [sheets, activeIdx, setRangeStyle])

  useEffect(() => {
    if (loading) return
    const handler = (e: KeyboardEvent) => {
      // Если фокус внутри редактируемого input ячейки — не вмешиваемся
      // (дадим input обрабатывать клавиши нативно, он сам слушает
      // Enter/Escape).
      if (editing) return
      // И если фокус в toolbar/header'е/popover'е — не трогаем, чтобы
      // не захватить нормальные Tab/Enter для управления UI.
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"
                     || target.isContentEditable)) {
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+F — открыть / сфокусировать панель поиска.
      if (ctrl && (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А")) {
        e.preventDefault()
        setSearchOpen(true)
        // Небольшая задержка — дождаться монтирования input'а панели.
        setTimeout(() => {
          const el = document.querySelector<HTMLInputElement>("[data-excel-search]")
          el?.focus()
          el?.select()
        }, 30)
        return
      }

      // Undo / Redo
      if (ctrl && !e.shiftKey && (e.key === "z" || e.key === "Z" || e.key === "я" || e.key === "Я")) {
        e.preventDefault(); undo(); return
      }
      if (ctrl && (e.key === "y" || e.key === "Y" || e.key === "н" || e.key === "Н"
                   || (e.shiftKey && (e.key === "z" || e.key === "Z" || e.key === "я" || e.key === "Я")))) {
        e.preventDefault(); redo(); return
      }

      // Форматирование — Ctrl+B / Ctrl+I / Ctrl+U.
      if (ctrl && !e.shiftKey && (e.key === "b" || e.key === "B" || e.key === "и" || e.key === "И")) {
        if (selection) { e.preventDefault(); toggleFontFlag(selection, "bold"); return }
      }
      if (ctrl && !e.shiftKey && (e.key === "i" || e.key === "I" || e.key === "ш" || e.key === "Ш")) {
        if (selection) { e.preventDefault(); toggleFontFlag(selection, "italic"); return }
      }
      if (ctrl && !e.shiftKey && (e.key === "u" || e.key === "U" || e.key === "г" || e.key === "Г")) {
        if (selection) { e.preventDefault(); toggleFontFlag(selection, "underline"); return }
      }

      // Copy / Cut / Paste — работают с selection как диапазоном.
      if (ctrl && (e.key === "c" || e.key === "C" || e.key === "с" || e.key === "С")) {
        e.preventDefault(); copySelection(); return
      }
      if (ctrl && (e.key === "x" || e.key === "X" || e.key === "ч" || e.key === "Ч")) {
        e.preventDefault(); cutSelection(); return
      }
      if (ctrl && (e.key === "v" || e.key === "V" || e.key === "м" || e.key === "М")) {
        e.preventDefault(); pasteFromClipboard(); return
      }

      // Дальше — работа с ячейкой, нужен selection.
      if (!selection) return

      // Delete / Backspace — очистить выделенный диапазон.
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); clearSelectionValues(selection); return
      }

      // F2 — редактировать активную (r2,c2).
      if (e.key === "F2") {
        e.preventDefault()
        const r = selection.r2, c = selection.c2
        setEditValue(activeSheetForNav?.cells.get(cellKey(r, c))?.value ?? "")
        setEditing({ r, c })
        return
      }

      // Навигация стрелками / Tab / Enter. Shift расширяет выделение.
      if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1, 0, e.shiftKey); return }
      if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1, 0, e.shiftKey); return }
      if (e.key === "ArrowLeft") { e.preventDefault(); moveSelection(0, -1, e.shiftKey); return }
      if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(0, 1, e.shiftKey); return }
      if (e.key === "Enter") { e.preventDefault(); moveSelection(e.shiftKey ? -1 : 1, 0, false); return }
      if (e.key === "Tab") { e.preventDefault(); moveSelection(0, e.shiftKey ? -1 : 1, false); return }

      // Ctrl+Home — в начало листа; Ctrl+End — в последнюю занятую.
      if (ctrl && e.key === "Home") {
        e.preventDefault()
        setSelection({ r1: 0, c1: 0, r2: 0, c2: 0 })
        return
      }
      if (ctrl && e.key === "End") {
        e.preventDefault()
        const r = activeSheetForNav?.maxRow ?? 0
        const c = activeSheetForNav?.maxCol ?? 0
        setSelection({ r1: r, c1: c, r2: r, c2: c })
        return
      }

      // Начал печатать на выделенной ячейке → открываем edit с новым
      // значением (Excel-style замещение).
      if (!ctrl && !e.altKey && e.key.length === 1) {
        e.preventDefault()
        const r = selection.r2, c = selection.c2
        setEditValue(e.key)
        setEditing({ r, c })
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [
    loading, editing, selection, activeSheetForNav, moveSelection,
    undo, redo, copySelection, cutSelection, pasteFromClipboard,
    clearSelectionValues, toggleFontFlag,
  ])

  // Актуальные row/col heights/widths для scroll-into-view — через ref,
  // чтобы эффект НЕ пересрабатывал при любой правке листа (заливка,
  // bold и т.п.). Иначе после правки эффект летит скроллить к r2 —
  // а для выделения целой колонки r2=LAST_ROW, и сетка уезжает в низ.
  const sheetRefForScroll = useRef(activeSheetForNav)
  useEffect(() => { sheetRefForScroll.current = activeSheetForNav }, [activeSheetForNav])
  const navDimsRef = useRef({ rowsForNav, colsForNav })
  useEffect(() => { navDimsRef.current = { rowsForNav, colsForNav } }, [rowsForNav, colsForNav])

  // Scroll-into-view: срабатывает ТОЛЬКО когда поменялся сам selection.
  //  - при выделении всего столбца (клик по букве) не скроллим по Y;
  //  - при выделении всей строки — не скроллим по X;
  //  - при выделении всего листа — не скроллим вовсе.
  useEffect(() => {
    if (!selection) return
    const el = scrollContainerRef.current
    const sh = sheetRefForScroll.current
    const { rowsForNav: rN, colsForNav: cN } = navDimsRef.current
    if (!el || !sh) return
    const n = normalizeRange(selection)
    const fullCols = n.minR === 0 && n.maxR >= rN - 1
    const fullRows = n.minC === 0 && n.maxC >= cN - 1
    if (fullCols && fullRows) return
    const heightOf = (r: number) => sh.rowHeights[r] ?? DEFAULT_HEIGHT
    const widthOf = (c: number) => sh.colWidths[c] ?? DEFAULT_WIDTH
    if (!fullCols) {
      let y = 0
      for (let i = 0; i < selection.r2; i++) y += heightOf(i)
      const h = heightOf(selection.r2)
      const headerH = 24
      if (y < el.scrollTop) el.scrollTop = y
      else if (y + h > el.scrollTop + el.clientHeight - headerH) {
        el.scrollTop = y + h - el.clientHeight + headerH
      }
    }
    if (!fullRows) {
      let x = ROW_HEADER_WIDTH
      for (let i = 0; i < selection.c2; i++) x += widthOf(i)
      const w = widthOf(selection.c2)
      if (x < el.scrollLeft + ROW_HEADER_WIDTH) el.scrollLeft = x - ROW_HEADER_WIDTH
      else if (x + w > el.scrollLeft + el.clientWidth) {
        el.scrollLeft = x + w - el.clientWidth
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  // -------- Поиск --------

  // Список всех matches (r, c) в активном листе по текущему query.
  // Пересчитывается при открытой панели.
  const searchMatches = useMemo(() => {
    if (!searchOpen || !searchQuery || !sheets[activeIdx]) return []
    const q = searchQuery.toLowerCase()
    const sh = sheets[activeIdx]
    const arr: Array<{ r: number; c: number }> = []
    for (const [key, cell] of sh.cells) {
      if (!cell.value) continue
      if (cell.value.toLowerCase().includes(q)) {
        const [r, c] = key.split(",").map(Number)
        arr.push({ r, c })
      }
    }
    arr.sort((a, b) => a.r - b.r || a.c - b.c)
    return arr
  }, [searchOpen, searchQuery, sheets, activeIdx])

  // Прыгнуть на match #idx — выделить + scroll-into-view.
  const jumpToMatch = useCallback((idx: number) => {
    if (!searchMatches.length) return
    const m = searchMatches[((idx % searchMatches.length) + searchMatches.length) % searchMatches.length]
    setSelection({ r1: m.r, c1: m.c, r2: m.r, c2: m.c })
  }, [searchMatches])

  // При смене query сбрасываем индекс и прыгаем на первый match.
  useEffect(() => {
    if (!searchOpen) return
    setSearchMatchIdx(0)
    if (searchMatches.length > 0) {
      const first = searchMatches[0]
      setSelection({ r1: first.r, c1: first.c, r2: first.r, c2: first.c })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOpen])

  // -------- Insert / Delete rows / cols --------

  const insertRows = useCallback((atRow: number, count = 1) => {
    mutateActive((sh) => {
      const cells = new Map<string, Cell>()
      for (const [key, c] of sh.cells) {
        const [r, cc] = key.split(",").map(Number)
        const newR = r >= atRow ? r + count : r
        cells.set(`${newR},${cc}`, c)
      }
      const rowHeights: Record<number, number> = {}
      for (const [k, v] of Object.entries(sh.rowHeights)) {
        const r = Number(k)
        rowHeights[r >= atRow ? r + count : r] = v
      }
      return { ...sh, cells, rowHeights, maxRow: sh.maxRow + count }
    })
  }, [mutateActive])

  const deleteRows = useCallback((atRow: number, count = 1) => {
    mutateActive((sh) => {
      const cells = new Map<string, Cell>()
      for (const [key, c] of sh.cells) {
        const [r, cc] = key.split(",").map(Number)
        if (r >= atRow && r < atRow + count) continue
        const newR = r >= atRow + count ? r - count : r
        cells.set(`${newR},${cc}`, c)
      }
      const rowHeights: Record<number, number> = {}
      for (const [k, v] of Object.entries(sh.rowHeights)) {
        const r = Number(k)
        if (r >= atRow && r < atRow + count) continue
        rowHeights[r >= atRow + count ? r - count : r] = v
      }
      return {
        ...sh, cells, rowHeights,
        maxRow: Math.max(0, sh.maxRow - count),
      }
    })
  }, [mutateActive])

  const insertCols = useCallback((atCol: number, count = 1) => {
    mutateActive((sh) => {
      const cells = new Map<string, Cell>()
      for (const [key, c] of sh.cells) {
        const [r, cc] = key.split(",").map(Number)
        const newC = cc >= atCol ? cc + count : cc
        cells.set(`${r},${newC}`, c)
      }
      const colWidths: Record<number, number> = {}
      for (const [k, v] of Object.entries(sh.colWidths)) {
        const c = Number(k)
        colWidths[c >= atCol ? c + count : c] = v
      }
      return { ...sh, cells, colWidths, maxCol: sh.maxCol + count }
    })
  }, [mutateActive])

  const deleteCols = useCallback((atCol: number, count = 1) => {
    mutateActive((sh) => {
      const cells = new Map<string, Cell>()
      for (const [key, c] of sh.cells) {
        const [r, cc] = key.split(",").map(Number)
        if (cc >= atCol && cc < atCol + count) continue
        const newC = cc >= atCol + count ? cc - count : cc
        cells.set(`${r},${newC}`, c)
      }
      const colWidths: Record<number, number> = {}
      for (const [k, v] of Object.entries(sh.colWidths)) {
        const c = Number(k)
        if (c >= atCol && c < atCol + count) continue
        colWidths[c >= atCol + count ? c - count : c] = v
      }
      return {
        ...sh, cells, colWidths,
        maxCol: Math.max(0, sh.maxCol - count),
      }
    })
  }, [mutateActive])

  // Применяет патч font/align ко всем ячейкам диапазона. Для font/align
  // передаются ЧАСТИЧНЫЕ объекты — поля, которые НЕ перезаписываются,
  // сохраняются. Передать поле = undefined → удалить его.
  const setRangeNumFmt = useCallback((range: SelectionRange, numFmt: string | undefined) => {
    mutateActive((sh) => {
      const cells = new Map(sh.cells)
      const n = normalizeRange(range)
      let maxRow = sh.maxRow
      let maxCol = sh.maxCol
      for (let r = n.minR; r <= n.maxR; r++) {
        for (let c = n.minC; c <= n.maxC; c++) {
          const key = cellKey(r, c)
          const existing = cells.get(key) ?? { value: "" }
          cells.set(key, { ...existing, numFmt: numFmt || undefined })
          if (r > maxRow) maxRow = r
          if (c > maxCol) maxCol = c
        }
      }
      return { ...sh, cells, maxRow, maxCol }
    })
  }, [mutateActive])

  const setCellComment = useCallback((row: number, col: number, comment: string | undefined) => {
    mutateActive((sh) => {
      const cells = new Map(sh.cells)
      const key = cellKey(row, col)
      const existing = cells.get(key) ?? { value: "" }
      cells.set(key, { ...existing, comment: comment || undefined })
      return {
        ...sh, cells,
        maxRow: Math.max(sh.maxRow, row),
        maxCol: Math.max(sh.maxCol, col),
      }
    })
  }, [mutateActive])

  const mergeSelection = useCallback((range: SelectionRange) => {
    mutateActive((sh) => {
      const n = normalizeRange(range)
      if (n.minR === n.maxR && n.minC === n.maxC) return sh // нечего мерджить
      // Убираем все пересекающиеся merges (Excel так делает).
      const merges = sh.merges.filter((m) =>
        m.er < n.minR || m.sr > n.maxR || m.ec < n.minC || m.sc > n.maxC,
      )
      merges.push({ sr: n.minR, sc: n.minC, er: n.maxR, ec: n.maxC })
      return { ...sh, merges }
    })
  }, [mutateActive])

  const unmergeSelection = useCallback((range: SelectionRange) => {
    mutateActive((sh) => {
      const n = normalizeRange(range)
      const merges = sh.merges.filter((m) =>
        m.er < n.minR || m.sr > n.maxR || m.ec < n.minC || m.sc > n.maxC,
      )
      return { ...sh, merges }
    })
  }, [mutateActive])

  const addRule = useCallback((rule: ConditionalRule) => {
    mutateActive((sh) => ({ ...sh, rules: [...sh.rules, rule] }))
  }, [mutateActive])

  const removeRule = useCallback((id: string) => {
    mutateActive((sh) => ({ ...sh, rules: sh.rules.filter((r) => r.id !== id) }))
  }, [mutateActive])

  const setRangeFill = useCallback((range: SelectionRange, fill?: string) => {
    mutateActive((sh) => {
      const cells = new Map(sh.cells)
      const n = normalizeRange(range)
      let maxRow = sh.maxRow
      let maxCol = sh.maxCol
      for (let r = n.minR; r <= n.maxR; r++) {
        for (let c = n.minC; c <= n.maxC; c++) {
          const key = cellKey(r, c)
          const existing = cells.get(key) ?? { value: "" }
          if (!fill && !existing.value) {
            cells.delete(key)
          } else {
            cells.set(key, { ...existing, fill })
            if (r > maxRow) maxRow = r
            if (c > maxCol) maxCol = c
          }
        }
      }
      return { ...sh, cells, maxRow, maxCol }
    })
  }, [mutateActive])

  const setColWidth = useCallback((col: number, width: number) => {
    mutateActive((sh) => ({
      ...sh,
      colWidths: { ...sh.colWidths, [col]: Math.max(MIN_WIDTH, Math.round(width)) },
    }))
  }, [mutateActive])

  const setRowHeight = useCallback((row: number, height: number) => {
    mutateActive((sh) => ({
      ...sh,
      rowHeights: { ...sh.rowHeights, [row]: Math.max(MIN_HEIGHT, Math.round(height)) },
    }))
  }, [mutateActive])

  // Auto-fit одного столбца: max(estimateWidth(value)) по колонке.
  const autoFitCol = useCallback((col: number) => {
    mutateActive((sh) => {
      let w = DEFAULT_WIDTH
      for (const [key, c] of sh.cells) {
        const [, cc] = key.split(",").map(Number)
        if (cc === col) w = Math.max(w, estimateWidth(c.value))
      }
      return { ...sh, colWidths: { ...sh.colWidths, [col]: w } }
    })
  }, [mutateActive])

  const autoFitRow = useCallback((row: number) => {
    mutateActive((sh) => {
      let h = DEFAULT_HEIGHT
      for (const [key, c] of sh.cells) {
        const [r] = key.split(",").map(Number)
        if (r === row) h = Math.max(h, estimateHeight(c.value))
      }
      return { ...sh, rowHeights: { ...sh.rowHeights, [row]: h } }
    })
  }, [mutateActive])

  const autoFitAllCols = useCallback(() => {
    mutateActive((sh) => {
      const colWidths: Record<number, number> = {}
      const widths: Record<number, number> = {}
      for (const [key, c] of sh.cells) {
        const [, cc] = key.split(",").map(Number)
        widths[cc] = Math.max(widths[cc] ?? DEFAULT_WIDTH, estimateWidth(c.value))
      }
      for (const [k, v] of Object.entries(widths)) colWidths[Number(k)] = v
      return { ...sh, colWidths }
    })
  }, [mutateActive])

  const autoFitAllRows = useCallback(() => {
    mutateActive((sh) => {
      const rowHeights: Record<number, number> = {}
      const heights: Record<number, number> = {}
      for (const [key, c] of sh.cells) {
        const [r] = key.split(",").map(Number)
        heights[r] = Math.max(heights[r] ?? DEFAULT_HEIGHT, estimateHeight(c.value))
      }
      for (const [k, v] of Object.entries(heights)) rowHeights[Number(k)] = v
      return { ...sh, rowHeights }
    })
  }, [mutateActive])

  const handleSave = async (): Promise<boolean> => {
    if (!workbookRef.current) return false
    setSaving(true)
    try {
      const wb = workbookRef.current
      for (const sh of sheets) wb.Sheets[sh.name] = buildWorksheet(sh)
      const bookType = detectBookType(fileName)
      const out = XLSX.write(wb, { bookType, type: "array", cellStyles: true })
      const blob = new Blob([out], {
        type:
          bookType === "csv" ? "text/csv"
          : bookType === "xls" ? "application/vnd.ms-excel"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const res = await fetch(
        `/api/admin/attachments/${attachmentId}/raw`,
        {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": blob.type },
          cache: "no-store",
        },
      )
      if (!res.ok) {
        const text = await res.text()
        let msg = `HTTP ${res.status}`
        try { msg = JSON.parse(text).error || msg } catch { /* noop */ }
        throw new Error(msg)
      }
      setDirty(false)
      toast({ title: "Сохранено" })
      return true
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Не удалось сохранить",
        description: e?.message,
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  // Фактический выход — без проверок. Вызывается ПОСЛЕ confirm'а или
  // когда правок не было.
  const performExit = useCallback(() => {
    // Возвращаемся на предыдущую страницу (обычно — карточка задачи/
    // сделки). Если юзер открыл редактор напрямую по URL — тогда
    // ведём на список задач как дефолт.
    if (window.history.length > 1) router.back()
    else router.push("/admin/tasks")
  }, [router])

  const handleClose = () => {
    if (dirty) {
      setExitConfirmOpen(true)
      return
    }
    performExit()
  }

  // Сохранить + выйти (кнопка в confirm-диалоге). Не уходим, если
  // save не удался — тост с ошибкой уже показан, dirty остаётся true.
  const handleSaveAndExit = async () => {
    setExitConfirmOpen(false)
    const ok = await handleSave()
    if (ok) performExit()
  }

  // -------- Render --------

  const rootCls = "fixed inset-0 z-[100] bg-white flex flex-col"
  const stateCls = "fixed inset-0 z-[100] bg-gray-50 flex items-center justify-center p-6"

  if (loading) {
    return (
      <div className={stateCls}>
        <div className="text-center text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          Открываем файл…
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className={stateCls}>
        <div className="max-w-md text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="text-lg font-semibold">Не удалось открыть файл</div>
          <div className="text-sm text-gray-500">{error}</div>
          <Button variant="outline" onClick={handleClose}>Закрыть</Button>
        </div>
      </div>
    )
  }

  const activeSheet = sheets[activeIdx]

  return (
    <div
      className={rootCls}
      // Отключаем нативное браузерное меню ПКМ на всём редакторе —
      // Radix ContextMenu сам preventDefault() там, где он прицеплен
      // (ячейки/header'ы), а в свободных зонах (toolbar, табы) меню
      // просто не нужно.
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="h-12 px-3 border-b border-gray-200 flex items-center gap-3 shrink-0 bg-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-8 rounded-full px-2.5"
          title="Вернуться назад"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Назад
        </Button>
        <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="text-sm font-semibold truncate flex-1 min-w-0" title={fileName}>
          {fileName}
          {dirty && <span className="ml-2 text-xs text-gray-400 font-normal">• изменено</span>}
        </div>
        <VersionHistoryButton
          attachmentId={attachmentId}
          onRestored={reloadFromDisk}
        />
        <Button
          variant="outline" size="sm"
          onClick={() => {
            const wb = workbookRef.current
            if (!wb) return
            for (const sh of sheets) wb.Sheets[sh.name] = buildWorksheet(sh)
            XLSX.writeFile(wb, fileName, { bookType: detectBookType(fileName) })
          }}
          className="h-8 rounded-lg"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Скачать копию
        </Button>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="h-8 rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 disabled:opacity-60"
        >
          {saving ? (<><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Сохраняю…</>)
                   : (<><Save className="h-3.5 w-3.5 mr-1.5" /> Сохранить</>)}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 rounded-full" title="Закрыть">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="h-9 px-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2 shrink-0 overflow-x-auto">
        <FillPicker
          disabled={!selection}
          currentFill={(() => {
            if (!selection) return undefined
            const n = normalizeRange(selection)
            return activeSheet?.cells.get(cellKey(n.minR, n.minC))?.fill
          })()}
          onPick={(color) => {
            if (selection) setRangeFill(selection, color)
          }}
          onClear={() => {
            if (selection) setRangeFill(selection, undefined)
          }}
        />
        <FormatBar
          activeCell={(() => {
            if (!selection || !activeSheet) return undefined
            const n = normalizeRange(selection)
            return activeSheet.cells.get(cellKey(n.minR, n.minC))
          })()}
          disabled={!selection}
          onToggleFlag={(flag) => { if (selection) toggleFontFlag(selection, flag) }}
          onSetTextColor={(color) => { if (selection) setRangeStyle(selection, { font: { color } }) }}
          onSetAlignH={(h) => { if (selection) setRangeStyle(selection, { align: { h } }) }}
          onSetAlignV={(v) => { if (selection) setRangeStyle(selection, { align: { v } }) }}
          onToggleWrap={() => {
            if (!selection || !activeSheet) return
            const n = normalizeRange(selection)
            const cur = !!activeSheet.cells.get(cellKey(n.minR, n.minC))?.align?.wrap
            setRangeStyle(selection, { align: { wrap: !cur } })
          }}
          onSetFontName={(name) => {
            if (selection) setRangeStyle(selection, { font: { name: name || undefined } })
          }}
          onSetFontSize={(sz) => {
            if (selection) setRangeStyle(selection, { font: { sz: sz || undefined } })
          }}
          onPreviewFont={(patch) => {
            if (!selection) return
            if (patch === null) setPreviewStyle(null)
            else setPreviewStyle({ range: selection, font: patch })
          }}
        />
        <div className="w-px h-5 bg-gray-300" />
        <NumFmtPicker
          disabled={!selection}
          currentFmt={(() => {
            if (!selection || !activeSheet) return undefined
            const n = normalizeRange(selection)
            return activeSheet.cells.get(cellKey(n.minR, n.minC))?.numFmt
          })()}
          onPick={(fmt) => { if (selection) setRangeNumFmt(selection, fmt) }}
        />
        <IconBtn
          disabled={!selection}
          onClick={() => {
            if (!selection || !activeSheet) return
            const n = normalizeRange(selection)
            const existingMerge = activeSheet.merges.find((m) =>
              n.minR >= m.sr && n.maxR <= m.er && n.minC >= m.sc && n.maxC <= m.ec,
            )
            if (existingMerge) unmergeSelection(selection)
            else mergeSelection(selection)
          }}
          title="Объединить / разъединить ячейки"
        >
          <Combine className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          disabled={!selection}
          onClick={() => {
            if (!selection) return
            const n = normalizeRange(selection)
            if (n.minR !== n.maxR || n.minC !== n.maxC) {
              toast({ variant: "destructive", title: "Выделите одну ячейку" })
              return
            }
            const cur = activeSheet?.cells.get(cellKey(n.minR, n.minC))?.comment ?? ""
            setCommentDialog({ r: n.minR, c: n.minC, text: cur })
          }}
          title="Комментарий"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          onClick={() => setRulesOpen(true)}
          title="Условное форматирование"
          badge={activeSheet && activeSheet.rules.length > 0 ? activeSheet.rules.length : undefined}
        >
          <Shuffle className="h-3.5 w-3.5" />
        </IconBtn>
        <div className="w-px h-5 bg-gray-300" />
        <IconBtn onClick={autoFitAllCols} title="Авто-ширина всех столбцов">
          <MoveHorizontal className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={autoFitAllRows} title="Авто-высота всех строк">
          <MoveVertical className="h-3.5 w-3.5" />
        </IconBtn>
        <div className="w-px h-5 bg-gray-300" />
        <IconBtn
          active={frozenRow}
          onClick={() => setFrozenRow((v) => !v)}
          title="Закрепить верхнюю строку"
        >
          <Snowflake className="h-3.5 w-3.5" />
          <span className="text-[9px] -ml-0.5">↑</span>
        </IconBtn>
        <IconBtn
          active={frozenCol}
          onClick={() => setFrozenCol((v) => !v)}
          title="Закрепить первый столбец"
        >
          <Snowflake className="h-3.5 w-3.5" />
          <span className="text-[9px] -ml-0.5">←</span>
        </IconBtn>
        <div className="w-px h-5 bg-gray-300" />
        <IconBtn onClick={() => setSearchOpen((v) => !v)} title="Поиск (Ctrl+F)">
          <Search className="h-3.5 w-3.5" />
        </IconBtn>

        <span className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-gray-500 tabular-nums w-10 text-right">
            {Math.round(zoom * 100)}%
          </span>
          {selection && (
            <span className="text-[11px] text-gray-500 tabular-nums">
              {describeRange(selection)}
            </span>
          )}
        </span>
      </div>

      {/* Панель поиска */}
      {searchOpen && (
        <div className="h-9 px-3 border-b border-gray-200 bg-yellow-50/60 flex items-center gap-2 shrink-0">
          <Search className="h-3.5 w-3.5 text-gray-500" />
          <input
            data-excel-search
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const next = searchMatchIdx + (e.shiftKey ? -1 : 1)
                setSearchMatchIdx(next)
                jumpToMatch(next)
              } else if (e.key === "Escape") {
                e.preventDefault()
                setSearchOpen(false)
              }
            }}
            placeholder="Что искать…"
            className="h-7 px-2 text-sm rounded border border-gray-300 w-56 focus:outline-none focus:border-brand-yellow"
          />
          <span className="text-[11px] text-gray-500 tabular-nums">
            {searchMatches.length === 0
              ? "ничего не найдено"
              : `${((searchMatchIdx % searchMatches.length) + searchMatches.length) % searchMatches.length + 1} из ${searchMatches.length}`}
          </span>
          <button
            type="button"
            onClick={() => { const n = searchMatchIdx - 1; setSearchMatchIdx(n); jumpToMatch(n) }}
            className="h-7 w-7 rounded border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center"
            title="Предыдущее (Shift+Enter)"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { const n = searchMatchIdx + 1; setSearchMatchIdx(n); jumpToMatch(n) }}
            className="h-7 w-7 rounded border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center"
            title="Следующее (Enter)"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setSearchQuery("") }}
            className="h-7 w-7 ml-auto rounded-full hover:bg-gray-200 flex items-center justify-center"
            title="Закрыть (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Scrollable grid — overflow живёт внутри SheetTable (нужен ref
          на scroll-контейнер для виртуализации). */}
      <div className="flex-1 min-h-0 bg-white">
        {activeSheet && (
          <SheetTable
            sheet={activeSheet}
            selection={selection}
            onSelectionChange={setSelection}
            onChange={updateCell}
            onColResize={setColWidth}
            onRowResize={setRowHeight}
            onAutoFitCol={autoFitCol}
            onAutoFitRow={autoFitRow}
            editing={editing}
            setEditing={setEditing}
            editValue={editValue}
            setEditValue={setEditValue}
            scrollRef={scrollContainerRef}
            frozenRow={frozenRow}
            frozenCol={frozenCol}
            zoom={zoom}
            onZoomChange={setZoom}
            searchMatches={searchOpen ? searchMatches : []}
            onInsertRow={insertRows}
            onDeleteRows={deleteRows}
            onInsertCol={insertCols}
            onDeleteCols={deleteCols}
            previewStyle={previewStyle}
            hoveredCell={hoveredCell}
            onHoverCell={setHoveredCell}
            onCellContextMenuOpen={(r, c) => {
              // Если ПКМ попал в существующее выделение — фиксируем ВСЁ
              // выделение; иначе фиксируем только эту ячейку и переносим
              // selection туда же.
              if (selection && inRange(selection, r, c)) {
                contextSelectionRef.current = selection
              } else {
                const one: SelectionRange = { r1: r, c1: c, r2: r, c2: c }
                contextSelectionRef.current = one
                setSelection(one)
              }
            }}
            onCellContextAction={(action, r, c) => {
              // ContextMenu на ячейке: единая точка обработки. Правка —
              // всегда в контексте выделения, зафиксированного в момент
              // открытия меню (`contextSelectionRef`). Между ПКМ и кликом
              // по пункту `selection` state может сброситься (Radix или
              // batching), поэтому ref — единственный надёжный источник.
              const singleRange: SelectionRange = { r1: r, c1: c, r2: r, c2: c }
              const target = contextSelectionRef.current ?? selection ?? singleRange
              switch (action.type) {
                case "bold": toggleFontFlag(target, "bold"); break
                case "italic": toggleFontFlag(target, "italic"); break
                case "underline": toggleFontFlag(target, "underline"); break
                case "align-h": setRangeStyle(target, { align: { h: action.value } }); break
                case "align-v": setRangeStyle(target, { align: { v: action.value } }); break
                case "fill": setRangeFill(target, action.color); break
                case "text-color": setRangeStyle(target, { font: { color: action.color } }); break
                case "clear-fill": setRangeFill(target, undefined); break
                case "clear-text-color": setRangeStyle(target, { font: { color: undefined } }); break
                case "clear-values": clearSelectionValues(target); break
                case "copy": copySelection(); break
                case "cut": cutSelection(); break
                case "paste": pasteFromClipboard(); break
                case "comment": {
                  const cur = activeSheet?.cells.get(cellKey(r, c))?.comment ?? ""
                  setCommentDialog({ r, c, text: cur })
                  break
                }
                case "comment-delete": setCellComment(r, c, undefined); break
              }
            }}
          />
        )}
      </div>

      {/* Sheet tabs */}
      <div className="h-9 px-2 border-t border-gray-200 bg-gray-50 flex items-center gap-1 overflow-x-auto shrink-0">
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => { setActiveIdx(i); setSelection(null) }}
            className={cn(
              "h-7 px-3 text-xs rounded-t-md shrink-0 border-t border-x border-gray-200 bg-white hover:bg-gray-50",
              i === activeIdx ? "font-semibold text-black bg-white"
                              : "text-gray-600 bg-gray-50/80",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Диалог редактирования комментария к ячейке. */}
      <AlertDialog
        open={!!commentDialog}
        onOpenChange={(v) => { if (!v) setCommentDialog(null) }}
      >
        <AlertDialogContent className="z-[130]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Комментарий к {commentDialog ? `${colLabel(commentDialog.c)}${commentDialog.r + 1}` : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Пусто = удалить комментарий. Красный треугольник на ячейке —
              признак что комментарий есть; наведение показывает его.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={commentDialog?.text ?? ""}
            onChange={(e) =>
              setCommentDialog((p) => p ? { ...p, text: e.target.value } : null)
            }
            autoFocus
            rows={5}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:border-brand-yellow resize-y"
            placeholder="Текст комментария…"
          />
          <AlertDialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
            <AlertDialogCancel className="m-0">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!commentDialog) return
                setCellComment(
                  commentDialog.r, commentDialog.c,
                  commentDialog.text.trim() || undefined,
                )
                setCommentDialog(null)
              }}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              Сохранить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Правила условного форматирования (живут только в сессии). */}
      <RulesDialog
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        rules={activeSheet?.rules ?? []}
        selection={selection}
        onAdd={addRule}
        onRemove={removeRule}
      />

      {/* Confirm-dialog при выходе с несохранёнными изменениями.
          Три варианта: сохранить + выйти / выйти без сохранения / отмена. */}
      <AlertDialog
        open={exitConfirmOpen}
        onOpenChange={(v) => { if (!v) setExitConfirmOpen(false) }}
      >
        <AlertDialogContent className="z-[130]">
          <AlertDialogHeader>
            <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              В файле «{fileName}» есть правки, которые ещё не сохранены.
              Что сделать?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
            <AlertDialogCancel className="m-0">Отмена</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => { setExitConfirmOpen(false); performExit() }}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Выйти без сохранения
            </Button>
            <AlertDialogAction
              onClick={handleSaveAndExit}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              Сохранить и выйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// =============================================================================
// SheetTable — сетка
// =============================================================================

/** Все действия контекстного меню на ячейке. Единый handler в parent
 *  знает про selection — применяет к selected range или к (r,c). */
type CellContextAction =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "align-h"; value: "left" | "center" | "right" }
  | { type: "align-v"; value: "top" | "middle" | "bottom" }
  | { type: "fill"; color: string }
  | { type: "text-color"; color: string }
  | { type: "clear-fill" }
  | { type: "clear-text-color" }
  | { type: "clear-values" }
  | { type: "copy" }
  | { type: "cut" }
  | { type: "paste" }
  | { type: "comment" }
  | { type: "comment-delete" }

function SheetTable({
  sheet, selection, onSelectionChange, onChange, onColResize, onRowResize,
  onAutoFitCol, onAutoFitRow,
  editing, setEditing, editValue, setEditValue, scrollRef,
  frozenRow, frozenCol, zoom, onZoomChange,
  searchMatches,
  onInsertRow, onDeleteRows, onInsertCol, onDeleteCols,
  previewStyle,
  hoveredCell, onHoverCell, onCellContextMenuOpen, onCellContextAction,
}: {
  sheet: SheetData
  selection: SelectionRange | null
  onSelectionChange: (s: SelectionRange | null) => void
  onChange: (row: number, col: number, value: string) => void
  onColResize: (col: number, width: number) => void
  onRowResize: (row: number, height: number) => void
  onAutoFitCol: (col: number) => void
  onAutoFitRow: (row: number) => void
  editing: { r: number; c: number } | null
  setEditing: (v: { r: number; c: number } | null) => void
  editValue: string
  setEditValue: (v: string) => void
  scrollRef: React.MutableRefObject<HTMLDivElement | null>
  frozenRow: boolean
  frozenCol: boolean
  zoom: number
  onZoomChange: (z: number | ((p: number) => number)) => void
  searchMatches: Array<{ r: number; c: number }>
  onInsertRow: (at: number, count?: number) => void
  onDeleteRows: (at: number, count?: number) => void
  onInsertCol: (at: number, count?: number) => void
  onDeleteCols: (at: number, count?: number) => void
  previewStyle: {
    range: SelectionRange
    font?: Partial<CellFont>
    align?: Partial<CellAlign>
  } | null
  hoveredCell: { r: number; c: number } | null
  onHoverCell: (v: { r: number; c: number } | null) => void
  onCellContextMenuOpen: (r: number, c: number) => void
  onCellContextAction: (action: CellContextAction, r: number, c: number) => void
}) {
  const tableRef = useRef<HTMLTableElement>(null)

  // Виртуализация: держим scrollTop и viewport height, рендерим только
  // видимые ряды + небольшой overscan. Иначе 100+ строк × 26 столбцов =
  // пара тысяч DOM-узлов → initial-render и drag-selection тупят.
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewportH(el.clientHeight)
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener("scroll", onScroll, { passive: true })
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    // Ctrl+scroll — изменить zoom.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      onZoomChange((z) => {
        const step = e.deltaY > 0 ? -0.1 : 0.1
        return Math.max(0.5, Math.min(2.5, Math.round((z + step) * 10) / 10))
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("wheel", onWheel)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Один раз после mount берём реальный font ячейки для canvas-измерений.
  useEffect(() => {
    const el = tableRef.current?.querySelector("[data-cell-view]") as HTMLElement | null
    if (!el) return
    const cs = window.getComputedStyle(el)
    setMeasureFont(`${cs.fontSize} ${cs.fontFamily}`)
  }, [])

  // Сколько строк/столбцов рендерим: больше чем в данных + запас.
  // Zoom уменьшает элементы → в viewport помещается больше ячеек, значит
  // надо дотягивать сетку дальше, иначе на zoom 0.5 она обрезается
  // посередине экрана. При zoom < 1 множитель 1/zoom расширяет базовый
  // минимум пропорционально.
  const zoomStretch = Math.max(1, 1 / Math.max(0.3, zoom))
  const rowsRendered = Math.max(
    sheet.maxRow + 1 + EXTRA_ROWS,
    Math.round(MIN_ROWS * zoomStretch),
  )
  const colsRendered = Math.max(
    sheet.maxCol + 1 + EXTRA_COLS,
    Math.round(MIN_COLS * zoomStretch),
  )

  const LAST_ROW = rowsRendered - 1
  const LAST_COL = colsRendered - 1

  const beginEdit = (r: number, c: number) => {
    const cur = sheet.cells.get(cellKey(r, c))?.value ?? ""
    setEditValue(cur)
    setEditing({ r, c })
  }
  // Как в Excel: Enter → сохранить + вниз; Shift+Enter → вверх;
  // Tab → сохранить + вправо; Shift+Tab → влево; blur → только
  // сохранить (без движения).
  const commitEdit = (move?: "up" | "down" | "left" | "right") => {
    if (!editing) return
    const { r, c } = editing
    onChange(r, c, editValue)
    setEditing(null)
    if (!move) return
    const dr = move === "down" ? 1 : move === "up" ? -1 : 0
    const dc = move === "right" ? 1 : move === "left" ? -1 : 0
    const nr = Math.max(0, Math.min(LAST_ROW, r + dr))
    const nc = Math.max(0, Math.min(LAST_COL, c + dc))
    onSelectionChange({ r1: nr, c1: nc, r2: nr, c2: nc })
  }
  const cancelEdit = () => setEditing(null)

  // Drag-selection: при mousedown на ячейке запоминаем «якорь», на move
  // по чужим ячейкам расширяем диапазон. Shift+click — то же через клик
  // (end = clicked, start = anchor).
  const dragAnchor = useRef<{ r: number; c: number } | null>(null)
  // RAF-троттл: при быстром движении мыши onMouseEnter прилетает на
  // каждую ячейку по пути, но setState на каждом вызове рендерит всю
  // таблицу — выделение отстаёт от курсора. Копим последнюю позицию
  // и делаем ОДИН setSelection на кадр, последняя позиция побеждает.
  const extendRafRef = useRef<number | null>(null)
  const extendPendingRef = useRef<{ r: number; c: number } | null>(null)

  const flushExtend = useCallback(() => {
    extendRafRef.current = null
    const p = extendPendingRef.current
    const a = dragAnchor.current
    if (!p || !a) return
    extendPendingRef.current = null
    onSelectionChange({ r1: a.r, c1: a.c, r2: p.r, c2: p.c })
  }, [onSelectionChange])

  const cancelExtend = useCallback(() => {
    if (extendRafRef.current != null) {
      cancelAnimationFrame(extendRafRef.current)
      extendRafRef.current = null
    }
    extendPendingRef.current = null
  }, [])

  const beginSelectCell = (r: number, c: number, e: React.MouseEvent) => {
    // ПКМ (button === 2): если клик внутри существующего выделения —
    // не трогаем selection (ContextMenu применится ко всему диапазону).
    // Если вне — перемещаем выделение на одну эту ячейку, как в Excel.
    if (e.button === 2) {
      if (selection && inRange(selection, r, c)) return
      onSelectionChange({ r1: r, c1: c, r2: r, c2: c })
      return
    }
    cancelExtend()
    if (e.shiftKey && selection) {
      // Расширяем от уже существующего начала к точке клика.
      onSelectionChange({ r1: selection.r1, c1: selection.c1, r2: r, c2: c })
      return
    }
    dragAnchor.current = { r, c }
    onSelectionChange({ r1: r, c1: c, r2: r, c2: c })
  }

  const extendSelectCell = (r: number, c: number) => {
    const a = dragAnchor.current
    if (!a) return
    // Дропаем no-op (та же ячейка, что в прошлый раз запросили) —
    // чтобы не плодить rAF для одного и того же состояния.
    const prev = extendPendingRef.current
    if (prev && prev.r === r && prev.c === c) return
    extendPendingRef.current = { r, c }
    if (extendRafRef.current == null) {
      extendRafRef.current = requestAnimationFrame(flushExtend)
    }
  }

  const endSelectCell = () => {
    // Применяем последнюю pending-позицию СРАЗУ, чтобы отпуск кнопки
    // не оставил устаревший selection на один кадр.
    if (extendPendingRef.current && dragAnchor.current) {
      const p = extendPendingRef.current
      const a = dragAnchor.current
      onSelectionChange({ r1: a.r, c1: a.c, r2: p.r, c2: p.c })
    }
    cancelExtend()
    dragAnchor.current = null
  }

  const selectCol = (c: number, e: React.MouseEvent) => {
    if (e.shiftKey && selection) {
      onSelectionChange({ r1: 0, c1: selection.c1, r2: LAST_ROW, c2: c })
      return
    }
    onSelectionChange({ r1: 0, c1: c, r2: LAST_ROW, c2: c })
  }
  const selectRow = (r: number, e: React.MouseEvent) => {
    if (e.shiftKey && selection) {
      onSelectionChange({ r1: selection.r1, c1: 0, r2: r, c2: LAST_COL })
      return
    }
    onSelectionChange({ r1: r, c1: 0, r2: r, c2: LAST_COL })
  }
  const selectAll = () => {
    onSelectionChange({ r1: 0, c1: 0, r2: LAST_ROW, c2: LAST_COL })
  }

  const columns = useMemo(
    () => Array.from({ length: colsRendered }, (_, i) => i),
    [colsRendered],
  )
  const widthOf = (c: number) => sheet.colWidths[c] ?? DEFAULT_WIDTH
  const heightOf = (r: number) => sheet.rowHeights[r] ?? DEFAULT_HEIGHT

  // Cumulative Y-offsets: yOffsets[r] = где начинается ряд r в px от
  // верха таблицы (не считая thead). yOffsets[rowsRendered] = total.
  const yOffsets = useMemo(() => {
    const arr = new Array<number>(rowsRendered + 1)
    arr[0] = 0
    for (let i = 0; i < rowsRendered; i++) {
      arr[i + 1] = arr[i] + heightOf(i)
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsRendered, sheet.rowHeights])

  const OVERSCAN = 8
  // Найти индекс первого ряда, у которого yOffsets[i+1] > scrollTop.
  const { startRow, endRow } = useMemo(() => {
    // scrollTop и viewportH приходят в CSS-пикселях. yOffsets — в
    // координатах таблицы ДО zoom'а. При zoom != 1 надо перевести
    // viewport'ные значения в таблично-координатные (разделить на zoom).
    const z = Math.max(0.1, zoom)
    const topT = scrollTop / z
    const viewT = viewportH / z
    let s = 0
    while (s < rowsRendered && yOffsets[s + 1] <= topT) s++
    let e = s
    const bottom = topT + viewT
    while (e < rowsRendered - 1 && yOffsets[e + 1] < bottom) e++
    return {
      startRow: Math.max(0, s - OVERSCAN),
      endRow: Math.min(rowsRendered - 1, e + OVERSCAN),
    }
  }, [scrollTop, viewportH, yOffsets, rowsRendered, zoom])

  const topSpacer = yOffsets[startRow]
  const bottomSpacer = yOffsets[rowsRendered] - yOffsets[endRow + 1]

  const visibleRows = useMemo(() => {
    const arr: number[] = []
    for (let i = startRow; i <= endRow; i++) arr.push(i)
    return arr
  }, [startRow, endRow])

  // Общая ширина таблицы = сумма колонок + row-header. Нужно явно
  // задать, иначе table (в flex-overflow-контейнере) схлопывается до
  // ширины родителя — колонки растягиваются, горизонтальный скролл
  // пропадает, resize начинает «отставать от курсора».
  const totalWidth = ROW_HEADER_WIDTH +
    columns.reduce((sum, c) => sum + widthOf(c), 0)

  return (
    <div ref={scrollRef} className="h-full w-full overflow-auto">
    <table
      ref={tableRef}
      className="border-collapse text-sm select-none"
      // CSS `zoom` масштабирует таблицу и её скроллируемую высоту /
      // ширину вместе с ней (в отличие от transform: scale, который
      // размер overflow не меняет). Поддерживается Chrome/Edge/Safari,
      // Firefox игнорирует (минорная CRM-аудитория — ок).
      style={{
        borderSpacing: 0, tableLayout: "fixed", width: totalWidth,
        zoom,
      }}
    >
      <colgroup>
        <col style={{ width: ROW_HEADER_WIDTH }} />
        {columns.map((c) => (
          <col key={c} style={{ width: widthOf(c) }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-20 bg-gray-100">
        <tr style={{ height: 24 }}>
          {/* Угловая ячейка — клик = выделить весь лист. */}
          <th
            className="sticky left-0 z-30 bg-gray-100 border border-gray-300 cursor-pointer hover:bg-gray-200"
            onClick={selectAll}
            title="Выделить весь лист"
          />
          {columns.map((c) => {
            const n = selection ? normalizeRange(selection) : null
            const colHit = !!(n && c >= n.minC && c <= n.maxC)
            return (
              <ColHeaderCell
                key={c}
                ci={c}
                colHit={colHit}
                widthOf={widthOf(c)}
                isSticky={frozenCol && c === 0}
                onSelectCol={selectCol}
                onColResize={onColResize}
                onAutoFitCol={onAutoFitCol}
                onInsertBefore={() => onInsertCol(c, 1)}
                onInsertAfter={() => onInsertCol(c + 1, 1)}
                onDelete={() => {
                  const s = selection ? normalizeRange(selection) : null
                  if (s && c >= s.minC && c <= s.maxC && s.minR === 0) {
                    onDeleteCols(s.minC, s.maxC - s.minC + 1)
                  } else {
                    onDeleteCols(c, 1)
                  }
                }}
              />
            )
          })}
        </tr>
        {/* Заморозка верхней строки — отрисовываем row 0 прямо в thead.
            Становится sticky вместе с header'ом. В tbody row 0 из
            visibleRows отфильтровывается, чтобы не рисовать дважды. */}
        {frozenRow && (() => {
          const ri = 0
          const n = selection ? normalizeRange(selection) : null
          const rowHit = n && ri >= n.minR && ri <= n.maxR
          return (
            <tr style={{ height: heightOf(ri) }}>
              <RowHeaderCell
                ri={ri}
                rowHit={!!rowHit}
                heightOf={heightOf(ri)}
                onSelectRow={selectRow}
                onRowResize={onRowResize}
                onAutoFitRow={onAutoFitRow}
                onInsertAbove={() => onInsertRow(ri, 1)}
                onInsertBelow={() => onInsertRow(ri + 1, 1)}
                onDelete={() => onDeleteRows(ri, 1)}
              />
              {columns.map((ci) => {
                const c = sheet.cells.get(cellKey(ri, ci))
                const isInSel = selection ? inRange(selection, ri, ci) : false
                const baseBg = c?.fill
                const stickyLeft = frozenCol && ci === 0
                const cellStyle = buildCellStyle(c)
                return (
                  <td
                    key={ci}
                    className={cn(
                      "border border-gray-300 p-0 align-middle",
                      isInSel && "outline outline-2 outline-brand-yellow outline-offset-[-2px]",
                      stickyLeft && "sticky z-[15]",
                    )}
                    style={{
                      height: heightOf(ri),
                      backgroundColor: isInSel && !baseBg
                        ? "rgba(250,204,21,0.18)"
                        : (baseBg || "#f3f4f6"),
                      ...(stickyLeft ? { left: ROW_HEADER_WIDTH } : {}),
                    }}
                    onMouseDown={(e) => beginSelectCell(ri, ci, e)}
                    onMouseEnter={(e) => {
                      if (e.buttons === 1) extendSelectCell(ri, ci)
                    }}
                    onMouseUp={endSelectCell}
                    onDoubleClick={() => beginEdit(ri, ci)}
                  >
                    <div
                      className={cn(
                        "w-full h-full px-1.5 text-sm overflow-hidden cursor-cell flex",
                        c?.align?.wrap ? "whitespace-pre-wrap break-words" : "whitespace-nowrap",
                      )}
                      style={{ height: heightOf(ri), ...cellStyle }}
                    >
                      {c?.value ?? ""}
                    </div>
                  </td>
                )
              })}
            </tr>
          )
        })()}
      </thead>
      <tbody>
        {/* Верхний spacer — чтобы scrollbar видел полный размер
            содержимого и не схлопывался. Отрисовывается ПУСТО: один
            <td>, colSpan через все колонки. */}
        {topSpacer > 0 && (
          <tr style={{ height: topSpacer }} aria-hidden>
            <td colSpan={columns.length + 1} style={{ height: topSpacer, padding: 0, border: 0 }} />
          </tr>
        )}
        {visibleRows.filter((ri) => !frozenRow || ri !== 0).map((ri) => {
          const n = selection ? normalizeRange(selection) : null
          const rowHit = n && ri >= n.minR && ri <= n.maxR
          return (
            <tr key={ri} style={{ height: heightOf(ri) }}>
              <RowHeaderCell
                ri={ri}
                rowHit={!!rowHit}
                heightOf={heightOf(ri)}
                onSelectRow={selectRow}
                onRowResize={onRowResize}
                onAutoFitRow={onAutoFitRow}
                onInsertAbove={() => onInsertRow(ri, 1)}
                onInsertBelow={() => onInsertRow(ri + 1, 1)}
                onDelete={() => {
                  // Если выделен диапазон строк, целиком включающий ri —
                  // удаляем всё выделение. Иначе одну эту строку.
                  const s = selection ? normalizeRange(selection) : null
                  if (s && ri >= s.minR && ri <= s.maxR && s.minC === 0) {
                    onDeleteRows(s.minR, s.maxR - s.minR + 1)
                  } else {
                    onDeleteRows(ri, 1)
                  }
                }}
              />
              {columns.map((ci) => {
                const mergeInfo = findMergeAt(sheet.merges, ri, ci)
                // Если ячейка внутри merge (не TL) — не рендерим td.
                if (mergeInfo?.kind === "inside") return null
                const c = sheet.cells.get(cellKey(ri, ci))
                const isInSel = selection ? inRange(selection, ri, ci) : false
                const isEditing = editing?.r === ri && editing?.c === ci
                const isSearchHit = searchMatches.some((m) => m.r === ri && m.c === ci)
                const stickyLeft = frozenCol && ci === 0
                const previewCell = applyPreview(c, previewStyle, ri, ci)
                const cellStyle = buildCellStyle(previewCell)
                const ruleStyle = applyRules(sheet.rules, ri, ci, c?.value ?? "")
                const baseBg = ruleStyle.fill || c?.fill
                const displayValue = formatCellValue(c?.value ?? "", c?.numFmt)
                const span = mergeInfo?.kind === "topLeft" ? {
                  rowSpan: mergeInfo.m.er - mergeInfo.m.sr + 1,
                  colSpan: mergeInfo.m.ec - mergeInfo.m.sc + 1,
                } : {}
                const finalStyle = {
                  ...cellStyle,
                  ...(ruleStyle.color ? { color: ruleStyle.color } : {}),
                }
                return (
                  <td
                    key={ci}
                    {...span}
                    className={cn(
                      "relative border border-gray-300 p-0 align-middle",
                      isInSel && "outline outline-2 outline-brand-yellow outline-offset-[-2px]",
                      isSearchHit && !isInSel && "outline outline-2 outline-orange-400 outline-offset-[-2px]",
                      stickyLeft && "sticky z-[9]",
                    )}
                    style={{
                      height: heightOf(ri),
                      backgroundColor: isInSel && !baseBg
                        ? "rgba(250,204,21,0.18)"
                        : stickyLeft
                          ? (baseBg || "#ffffff")
                          : baseBg,
                      ...(stickyLeft ? { left: ROW_HEADER_WIDTH } : {}),
                    }}
                    onMouseDown={(e) => {
                      if (isEditing) return
                      beginSelectCell(ri, ci, e)
                    }}
                    onMouseEnter={(e) => {
                      if (e.buttons === 1 && !isEditing) extendSelectCell(ri, ci)
                      onHoverCell({ r: ri, c: ci })
                    }}
                    onMouseLeave={() => {
                      // Сбрасываем только если это именно наша ячейка —
                      // чтобы не стирать hover от соседней (race).
                      onHoverCell(null)
                    }}
                    onMouseUp={endSelectCell}
                    onDoubleClick={() => beginEdit(ri, ci)}
                  >
                    {/* Красный треугольничек — признак комментария. */}
                    {c?.comment && !isEditing && (
                      <div
                        aria-hidden
                        className="absolute top-0 right-0 pointer-events-none"
                        style={{
                          width: 0, height: 0,
                          borderTop: "6px solid #ef4444",
                          borderLeft: "6px solid transparent",
                        }}
                      />
                    )}
                    {/* Всплывашка с текстом комментария — справа от ячейки,
                        рендерим ТОЛЬКО когда мышь именно над этой ячейкой. */}
                    {c?.comment && hoveredCell?.r === ri && hoveredCell?.c === ci && !isEditing && (
                      <div
                        className="absolute top-0 left-full ml-1 z-30 min-w-[160px] max-w-[320px] text-xs bg-yellow-50 border border-yellow-300 text-gray-800 rounded shadow-md px-2 py-1 whitespace-pre-wrap pointer-events-none"
                      >
                        {c.comment}
                      </div>
                    )}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          className="w-full h-full"
                          // onContextMenu НА этом div: Radix composе'ит
                          // с своим handler'ом, мой выполняется первым
                          // и фиксирует selection в ref родителя.
                          onContextMenu={() => onCellContextMenuOpen(ri, ci)}
                        >
                          {isEditing ? (
                            <textarea
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
                                  e.preventDefault()
                                  commitEdit("down")
                                } else if (e.key === "Tab") {
                                  e.preventDefault()
                                  commitEdit(e.shiftKey ? "left" : "right")
                                } else if (e.key === "Escape") {
                                  e.preventDefault(); cancelEdit()
                                }
                              }}
                              className="w-full h-full px-1.5 text-sm bg-white focus:outline-none resize-none"
                              style={{ height: heightOf(ri), ...cellStyle }}
                              rows={1}
                            />
                          ) : (
                            <div
                              data-cell-view
                              className={cn(
                                "w-full h-full px-1.5 text-sm overflow-hidden cursor-cell flex",
                                c?.align?.wrap ? "whitespace-pre-wrap break-words" : "whitespace-nowrap",
                              )}
                              style={{ height: heightOf(ri), ...finalStyle }}
                            >
                              {displayValue}
                            </div>
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <CellContextMenuContent
                        hasComment={!!c?.comment}
                        onAction={(a) => onCellContextAction(a, ri, ci)}
                      />
                    </ContextMenu>
                  </td>
                )
              })}
            </tr>
          )
        })}
        {bottomSpacer > 0 && (
          <tr style={{ height: bottomSpacer }} aria-hidden>
            <td colSpan={columns.length + 1} style={{ height: bottomSpacer, padding: 0, border: 0 }} />
          </tr>
        )}
      </tbody>
    </table>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Resize handles
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Header cells с ContextMenu для insert/delete row/col
// -----------------------------------------------------------------------------

/** Содержимое ContextMenu для ячеек: стандартные правки формата +
 *  копировать/вырезать/вставить + удалить содержимое + комментарий. */
function CellContextMenuContent({
  hasComment, onAction,
}: {
  hasComment: boolean
  onAction: (a: CellContextAction) => void
}) {
  const quickFills = ["#FEF3C7", "#FCA5A5", "#A7F3D0", "#BFDBFE", "#DDD6FE", "#E5E7EB"]
  const quickTextColors = ["#000000", "#EF4444", "#F97316", "#22C55E", "#3B82F6", "#8B5CF6"]
  return (
    <ContextMenuContent className="z-[120] w-56">
      <ContextMenuItem onClick={() => onAction({ type: "copy" })}>
        Копировать <span className="ml-auto text-[10px] text-gray-400">Ctrl+C</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onAction({ type: "cut" })}>
        Вырезать <span className="ml-auto text-[10px] text-gray-400">Ctrl+X</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onAction({ type: "paste" })}>
        Вставить <span className="ml-auto text-[10px] text-gray-400">Ctrl+V</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => onAction({ type: "bold" })}>
        <Bold className="h-3.5 w-3.5 mr-2" /> Жирный
        <span className="ml-auto text-[10px] text-gray-400">Ctrl+B</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onAction({ type: "italic" })}>
        <Italic className="h-3.5 w-3.5 mr-2" /> Курсив
        <span className="ml-auto text-[10px] text-gray-400">Ctrl+I</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onAction({ type: "underline" })}>
        <Underline className="h-3.5 w-3.5 mr-2" /> Подчёркнутый
        <span className="ml-auto text-[10px] text-gray-400">Ctrl+U</span>
      </ContextMenuItem>

      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Paintbrush className="h-3.5 w-3.5 mr-2" /> Заливка
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-44">
          <div className="grid grid-cols-6 gap-1 p-1.5">
            {quickFills.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onAction({ type: "fill", color })}
                className="h-6 w-6 rounded border border-black/5 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAction({ type: "clear-fill" })}>
            Убрать заливку
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Type className="h-3.5 w-3.5 mr-2" /> Цвет текста
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-44">
          <div className="grid grid-cols-6 gap-1 p-1.5">
            {quickTextColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onAction({ type: "text-color", color })}
                className="h-6 w-6 rounded border border-black/5 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAction({ type: "clear-text-color" })}>
            Сбросить цвет
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <AlignCenter className="h-3.5 w-3.5 mr-2" /> Выравнивание
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-44">
          <ContextMenuItem onClick={() => onAction({ type: "align-h", value: "left" })}>
            <AlignLeft className="h-3.5 w-3.5 mr-2" /> По левому
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAction({ type: "align-h", value: "center" })}>
            <AlignCenter className="h-3.5 w-3.5 mr-2" /> По центру
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAction({ type: "align-h", value: "right" })}>
            <AlignRight className="h-3.5 w-3.5 mr-2" /> По правому
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAction({ type: "align-v", value: "top" })}>
            <AlignVerticalJustifyStart className="h-3.5 w-3.5 mr-2" /> По верху
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAction({ type: "align-v", value: "middle" })}>
            <AlignVerticalJustifyCenter className="h-3.5 w-3.5 mr-2" /> По середине
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAction({ type: "align-v", value: "bottom" })}>
            <AlignVerticalJustifyEnd className="h-3.5 w-3.5 mr-2" /> По низу
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => onAction({ type: "comment" })}>
        <MessageSquare className="h-3.5 w-3.5 mr-2" />
        {hasComment ? "Изменить комментарий" : "Добавить комментарий"}
      </ContextMenuItem>
      {hasComment && (
        <ContextMenuItem
          onClick={() => onAction({ type: "comment-delete" })}
          className="text-red-600 focus:text-red-700"
        >
          Удалить комментарий
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onAction({ type: "clear-values" })}
        className="text-red-600 focus:text-red-700"
      >
        Очистить значение <span className="ml-auto text-[10px] text-gray-400">Del</span>
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

function RowHeaderCell({
  ri, rowHit, heightOf, onSelectRow, onRowResize, onAutoFitRow,
  onInsertAbove, onInsertBelow, onDelete,
}: {
  ri: number
  rowHit: boolean
  heightOf: number
  onSelectRow: (r: number, e: React.MouseEvent) => void
  onRowResize: (row: number, h: number) => void
  onAutoFitRow: (row: number) => void
  onInsertAbove: () => void
  onInsertBelow: () => void
  onDelete: () => void
}) {
  // ВАЖНО: ContextMenuTrigger не умеет оборачивать <td> — Radix клонирует
  // с onContextMenu, но React table-cells местами игнорируют bubbling.
  // Триггером делаем <div> ВНУТРИ <td>, растянутый по всей площади.
  return (
    <td
      className={cn(
        "relative sticky left-0 z-10 border border-gray-300 text-[11px] font-semibold text-center tabular-nums cursor-pointer select-none p-0",
        rowHit
          ? "bg-brand-yellow/40 text-black"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
      style={{ width: ROW_HEADER_WIDTH, height: heightOf }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ height: heightOf }}
            onClick={(e) => onSelectRow(ri, e)}
            title={`Строка ${ri + 1} — клик = выделить; ПКМ = меню`}
          >
            {ri + 1}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="z-[120]">
          <ContextMenuItem onClick={onInsertAbove}>Вставить строку выше</ContextMenuItem>
          <ContextMenuItem onClick={onInsertBelow}>Вставить строку ниже</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-red-600 focus:text-red-700">
            Удалить строку
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <RowResizeHandle
        onChange={(h) => onRowResize(ri, h)}
        onDoubleClick={() => onAutoFitRow(ri)}
      />
    </td>
  )
}

function ColHeaderCell({
  ci, colHit, widthOf, isSticky, onSelectCol, onColResize, onAutoFitCol,
  onInsertBefore, onInsertAfter, onDelete,
}: {
  ci: number
  colHit: boolean
  widthOf: number
  isSticky: boolean
  onSelectCol: (c: number, e: React.MouseEvent) => void
  onColResize: (col: number, w: number) => void
  onAutoFitCol: (col: number) => void
  onInsertBefore: () => void
  onInsertAfter: () => void
  onDelete: () => void
}) {
  return (
    <th
      className={cn(
        "relative border border-gray-300 text-[11px] font-semibold cursor-pointer select-none p-0",
        colHit
          ? "bg-brand-yellow/40 text-black"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
        isSticky && "sticky z-[31]",
      )}
      style={{ width: widthOf, ...(isSticky ? { left: ROW_HEADER_WIDTH } : {}) }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="w-full h-full flex items-center justify-center px-2"
            onClick={(e) => onSelectCol(ci, e)}
            title={`Столбец ${colLabel(ci)} — клик = выделить; ПКМ = меню`}
          >
            {colLabel(ci)}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="z-[120]">
          <ContextMenuItem onClick={onInsertBefore}>Вставить столбец слева</ContextMenuItem>
          <ContextMenuItem onClick={onInsertAfter}>Вставить столбец справа</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-red-600 focus:text-red-700">
            Удалить столбец
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ColResizeHandle
        onChange={(w) => onColResize(ci, w)}
        onDoubleClick={() => onAutoFitCol(ci)}
      />
    </th>
  )
}

function ColResizeHandle({
  onChange, onDoubleClick,
}: {
  onChange: (w: number) => void
  onDoubleClick: () => void
}) {
  const handle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Берём РЕАЛЬНУЮ ширину соседнего `<th>` из DOM — иначе при
    // растянутой таблице стартовая ширина расходится с prop'ом,
    // и курсор «отстаёт».
    const th = (e.currentTarget.closest("th") as HTMLElement | null)
    const startW = th ? th.getBoundingClientRect().width : 0
    const startX = e.clientX
    const onMove = (ev: MouseEvent) => {
      onChange(Math.max(MIN_WIDTH, startW + (ev.clientX - startX)))
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }
  return (
    <div
      onMouseDown={handle}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-yellow/50"
      title="Перетащите — изменить ширину; двойной клик — авто-ширина"
    />
  )
}

function RowResizeHandle({
  onChange, onDoubleClick,
}: {
  onChange: (h: number) => void
  onDoubleClick: () => void
}) {
  const handle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const tr = (e.currentTarget.closest("tr") as HTMLElement | null)
    const startH = tr ? tr.getBoundingClientRect().height : 0
    const startY = e.clientY
    const onMove = (ev: MouseEvent) => {
      onChange(Math.max(MIN_HEIGHT, startH + (ev.clientY - startY)))
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }
  return (
    <div
      onMouseDown={handle}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      className="absolute left-0 bottom-0 w-full h-1.5 cursor-row-resize hover:bg-brand-yellow/50"
      title="Перетащите — изменить высоту; двойной клик — авто-высота"
    />
  )
}

// -----------------------------------------------------------------------------
// FillPicker — палитра заливки выделенной ячейки
// -----------------------------------------------------------------------------

/** Квадратная кнопка-иконка (28×28) для компактного toolbar'а.
 *  Активное состояние — brand-yellow, disabled — приглушённо.
 *  badge — маленький счётчик (например, количество правил). */
function IconBtn({
  onClick, disabled, active, title, children, badge,
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title: string
  children: React.ReactNode
  badge?: number | string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "relative h-7 min-w-[28px] inline-flex items-center justify-center gap-0.5 rounded border text-xs shrink-0 transition-colors px-1.5",
        active
          ? "bg-brand-yellow border-brand-yellow text-black"
          : "bg-white border-gray-200 text-gray-700 hover:border-gray-400",
        disabled && "opacity-40 cursor-not-allowed hover:border-gray-200",
      )}
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-3.5 min-w-[14px] px-0.5 rounded-full bg-brand-yellow text-[9px] font-bold text-black border border-white">
          {badge}
        </span>
      )}
    </button>
  )
}

// -----------------------------------------------------------------------------
// FormatBar — B/I/U + цвет текста + выравнивание + wrap + шрифт/размер
// -----------------------------------------------------------------------------

function FormatBar({
  activeCell, disabled,
  onToggleFlag, onSetTextColor,
  onSetAlignH, onSetAlignV, onToggleWrap,
  onSetFontName, onSetFontSize, onPreviewFont,
}: {
  activeCell?: Cell
  disabled: boolean
  onToggleFlag: (flag: "bold" | "italic" | "underline") => void
  onSetTextColor: (color: string | undefined) => void
  onSetAlignH: (h: "left" | "center" | "right") => void
  onSetAlignV: (v: "top" | "middle" | "bottom") => void
  onToggleWrap: () => void
  onSetFontName: (name: string) => void
  onSetFontSize: (sz: number | undefined) => void
  /** Live-preview: patch=null — сбросить; иначе — временно применить
   *  к выделению на уровне рендера (без mutate в sheet.cells). */
  onPreviewFont: (patch: Partial<CellFont> | null) => void
}) {
  const f = activeCell?.font
  const a = activeCell?.align

  const toggleBtn = (
    active: boolean | undefined,
    onClick: () => void,
    icon: React.ReactNode,
    title: string,
  ) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded border text-xs transition-colors shrink-0",
        active
          ? "bg-brand-yellow border-brand-yellow text-black"
          : "bg-white border-gray-200 text-gray-700 hover:border-gray-400",
        disabled && "opacity-40 cursor-not-allowed hover:border-gray-200",
      )}
    >
      {icon}
    </button>
  )

  return (
    <>
      <div className="w-px h-5 bg-gray-300" />
      {toggleBtn(f?.bold, () => onToggleFlag("bold"), <Bold className="h-3.5 w-3.5" />, "Жирный (Ctrl+B)")}
      {toggleBtn(f?.italic, () => onToggleFlag("italic"), <Italic className="h-3.5 w-3.5" />, "Курсив (Ctrl+I)")}
      {toggleBtn(f?.underline, () => onToggleFlag("underline"), <Underline className="h-3.5 w-3.5" />, "Подчёркнутый (Ctrl+U)")}
      <TextColorPicker
        disabled={disabled}
        currentColor={f?.color}
        onPick={onSetTextColor}
        onClear={() => onSetTextColor(undefined)}
      />
      <div className="w-px h-5 bg-gray-300" />
      {toggleBtn(a?.h === "left", () => onSetAlignH("left"), <AlignLeft className="h-3.5 w-3.5" />, "По левому краю")}
      {toggleBtn(a?.h === "center", () => onSetAlignH("center"), <AlignCenter className="h-3.5 w-3.5" />, "По центру")}
      {toggleBtn(a?.h === "right", () => onSetAlignH("right"), <AlignRight className="h-3.5 w-3.5" />, "По правому краю")}
      {toggleBtn(a?.v === "top", () => onSetAlignV("top"), <AlignVerticalJustifyStart className="h-3.5 w-3.5" />, "По верху")}
      {toggleBtn(a?.v === "middle", () => onSetAlignV("middle"), <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />, "По середине")}
      {toggleBtn(a?.v === "bottom", () => onSetAlignV("bottom"), <AlignVerticalJustifyEnd className="h-3.5 w-3.5" />, "По низу")}
      {toggleBtn(a?.wrap, onToggleWrap, <WrapText className="h-3.5 w-3.5" />, "Перенос текста")}
      <div className="w-px h-5 bg-gray-300" />
      <FontNamePicker
        disabled={disabled}
        value={f?.name ?? ""}
        onPick={onSetFontName}
        onPreview={(name) => onPreviewFont(name === null ? null : { name: name || undefined })}
      />
      <FontSizePicker
        disabled={disabled}
        value={f?.sz}
        onPick={onSetFontSize}
        onPreview={(sz) => onPreviewFont(sz === null ? null : { sz })}
      />
    </>
  )
}

/** Dropdown с названиями шрифтов, каждая опция написана СВОИМ шрифтом,
 *  чтобы юзер видел как он выглядит ещё до выбора. */
function FontNamePicker({
  disabled, value, onPick, onPreview,
}: {
  disabled: boolean
  value: string
  onPick: (name: string) => void
  /** null — убрать превью; строка — временно применить шрифт. */
  onPreview: (name: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const current = value || "— шрифт —"
  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) onPreview(null) }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-7 inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 text-xs shrink-0 max-w-[140px]",
            "hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          title="Шрифт"
        >
          <span className="truncate" style={value ? { fontFamily: value } : undefined}>
            {current}
          </span>
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1 z-[110]"
        align="start"
        onMouseLeave={() => onPreview(null)}
      >
        <div className="max-h-[300px] overflow-y-auto">
          {FONT_OPTIONS.map((n) => {
            const active = (value || "") === n
            return (
              <button
                key={n || "default"}
                type="button"
                onClick={() => { onPreview(null); onPick(n); setOpen(false) }}
                onMouseEnter={() => onPreview(n)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-brand-yellow/20 focus:outline-none",
                  active && "bg-brand-yellow/30 font-semibold",
                )}
                style={n ? { fontFamily: n } : { color: "#9CA3AF", fontStyle: "italic" }}
              >
                {n || "— сбросить —"}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Dropdown с размерами шрифта — число слева, образец «Aa» справа в этом
 *  размере (ограничен 24px чтобы не растянуло поповер). */
function FontSizePicker({
  disabled, value, onPick, onPreview,
}: {
  disabled: boolean
  value: number | undefined
  onPick: (sz: number | undefined) => void
  /** null — убрать превью; число — временно применить размер. */
  onPreview: (sz: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) onPreview(null) }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-7 inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 text-xs shrink-0 w-16 justify-between",
            "hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          title="Размер"
        >
          <span className="tabular-nums">{value ?? "—"}</span>
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-40 p-1 z-[110]"
        align="start"
        onMouseLeave={() => onPreview(null)}
      >
        <div className="max-h-[280px] overflow-y-auto">
          <button
            type="button"
            onClick={() => { onPreview(null); onPick(undefined); setOpen(false) }}
            onMouseEnter={() => onPreview(null)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-brand-yellow/20 focus:outline-none italic text-gray-500",
              value === undefined && "bg-brand-yellow/30 font-semibold",
            )}
          >
            — сбросить —
          </button>
          {SIZE_OPTIONS.map((s) => {
            const active = value === s
            const previewSz = Math.min(s, 24)
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onPreview(null); onPick(s); setOpen(false) }}
                onMouseEnter={() => onPreview(s)}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1 rounded text-sm hover:bg-brand-yellow/20 focus:outline-none",
                  active && "bg-brand-yellow/30 font-semibold",
                )}
              >
                <span className="tabular-nums">{s}</span>
                <span className="text-gray-600 leading-none" style={{ fontSize: `${previewSz}px` }}>
                  Aa
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TextColorPicker({
  disabled, currentColor, onPick, onClear,
}: {
  disabled: boolean
  currentColor?: string
  onPick: (color: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const pick = (c: string) => { onPick(c); setOpen(false) }
  const clear = () => { onClear(); setOpen(false) }
  const presets = [
    "#000000", "#374151", "#6B7280", "#9CA3AF",
    "#EF4444", "#F97316", "#EAB308", "#22C55E",
    "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899",
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-7 inline-flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 text-xs shrink-0",
            "hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          title="Цвет текста"
        >
          <Type className="h-3.5 w-3.5" />
          <span
            className="h-1 w-3 rounded-sm border border-black/10"
            style={{ backgroundColor: currentColor || "#000000" }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3 z-[110]" align="start">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Цвет текста
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              className="h-7 w-full rounded border border-black/5 hover:scale-105 transition-transform"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentColor || "#000000"}
              onChange={(e) => pick(e.target.value.toUpperCase())}
              className="h-7 w-12 rounded cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={currentColor || ""}
              placeholder="#RRGGBB"
              onChange={(e) => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{6}$/.test(v)) pick(v.toUpperCase())
              }}
              className="flex-1 h-7 rounded border border-gray-200 px-2 text-xs font-mono uppercase focus:outline-none focus:border-gray-400"
              maxLength={7}
            />
          </div>
          <button
            type="button"
            onClick={clear}
            className="w-full text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded h-7"
          >
            Сбросить
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Dropdown с пресетами форматов чисел (Общий / Процент / Тенге / Дата / …).
 *  Current = пресет, формат которого совпадает с cell.numFmt. */
function NumFmtPicker({
  disabled, currentFmt, onPick,
}: {
  disabled: boolean
  currentFmt?: string
  onPick: (fmt: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [customFmt, setCustomFmt] = useState(currentFmt ?? "")
  const activeName =
    NUMFMT_PRESETS.find((p) => p.fmt === (currentFmt ?? ""))?.name
    ?? (currentFmt ? "Свой" : "Общий")
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-7 inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 text-xs shrink-0 max-w-[140px]",
            "hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          title="Формат числа"
        >
          <Hash className="h-3.5 w-3.5" />
          <span className="truncate">{activeName}</span>
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1 z-[110]" align="start">
        <div className="max-h-[280px] overflow-y-auto">
          {NUMFMT_PRESETS.map((p) => {
            const active = (currentFmt ?? "") === p.fmt
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => { onPick(p.fmt || undefined); setOpen(false) }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-brand-yellow/20 focus:outline-none",
                  active && "bg-brand-yellow/30 font-semibold",
                )}
              >
                <span>{p.name}</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {p.fmt || "—"}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 px-1 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Свой формат
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customFmt}
              onChange={(e) => setCustomFmt(e.target.value)}
              placeholder="например 0.00 или dd.mm"
              className="flex-1 h-7 rounded border border-gray-200 px-2 text-xs font-mono focus:outline-none focus:border-gray-400"
            />
            <Button
              size="sm"
              onClick={() => { onPick(customFmt || undefined); setOpen(false) }}
              className="h-7 rounded bg-brand-yellow text-black hover:bg-yellow-500"
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FillPicker({
  disabled, currentFill, onPick, onClear,
}: {
  disabled: boolean
  currentFill?: string
  onPick: (color: string) => void
  onClear: () => void
}) {
  // Controlled open — чтобы автозакрывать поповер после выбора цвета
  // (по умолчанию Radix держит его открытым до клика вне).
  const [open, setOpen] = useState(false)
  const pick = (c: string) => { onPick(c); setOpen(false) }
  const clear = () => { onClear(); setOpen(false) }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-7 px-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white text-xs",
            "hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          title={disabled ? "Выделите ячейку" : "Заливка выделенной ячейки"}
        >
          <Paintbrush className="h-3.5 w-3.5" />
          Заливка
          <span
            className="h-3 w-3 rounded-sm border border-black/10 ml-0.5"
            style={{ backgroundColor: currentFill || "transparent" }}
          />
        </button>
      </PopoverTrigger>
      {/* Редактор сам живёт на z-[100], а Radix Popover по дефолту z-50 →
          попапер оказывается ЗА редактором и не виден. Явно задираем. */}
      <PopoverContent className="w-56 p-3 z-[110]" align="start">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Палитра
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {FILL_PRESETS.map((c) => {
            const active = currentFill?.toUpperCase() === c.toUpperCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => pick(c)}
                className={cn(
                  "h-7 w-full rounded border border-black/5 hover:scale-105 transition-transform",
                  active && "ring-2 ring-brand-yellow ring-offset-1",
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentFill || "#ffffff"}
              onChange={(e) => pick(e.target.value.toUpperCase())}
              className="h-7 w-10 rounded cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={currentFill || ""}
              placeholder="#RRGGBB"
              onChange={(e) => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{6}$/.test(v)) pick(v.toUpperCase())
              }}
              className="flex-1 h-7 rounded border border-gray-200 px-2 text-xs font-mono uppercase focus:outline-none focus:border-gray-400"
              maxLength={7}
            />
          </div>
          <button
            type="button"
            onClick={clear}
            className="w-full text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded h-7"
          >
            Без заливки
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// -----------------------------------------------------------------------------
// VersionHistoryButton — dropdown со списком старых версий + restore
// -----------------------------------------------------------------------------

interface VersionRow {
  id: number
  file_size: number | null
  saved_by: number | null
  saved_by_name: string | null
  saved_at: string | null
}

function VersionHistoryButton({
  attachmentId, onRestored,
}: {
  attachmentId: number
  /** После успешного restore родитель должен перечитать файл. */
  onRestored: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [confirmRestore, setConfirmRestore] = useState<VersionRow | null>(null)

  // Подгружаем список только при открытии поповера — чтобы не бить
  // бэк при каждом mount редактора.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/attachments/${attachmentId}/versions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setVersions(d.versions || []) })
      .catch(() => { if (!cancelled) setVersions([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, attachmentId])

  const restore = async (v: VersionRow) => {
    try {
      const res = await fetch(
        `/api/admin/attachments/${attachmentId}/versions/${v.id}/restore`,
        { method: "POST", cache: "no-store" },
      )
      if (!res.ok) {
        const t = await res.text()
        let msg = `HTTP ${res.status}`
        try { msg = JSON.parse(t).error || msg } catch { /* noop */ }
        throw new Error(msg)
      }
      toast({ title: "Версия восстановлена" })
      setOpen(false)
      setConfirmRestore(null)
      onRestored()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Не удалось восстановить", description: e?.message })
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 rounded-lg" title="История версий">
            <History className="h-3.5 w-3.5 mr-1.5" />
            История
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 z-[110]" align="end">
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              История версий
            </div>
            <div className="text-[11px] text-gray-500 mt-1 leading-snug">
              Открытая сейчас — <b>текущая</b>, в списке её нет. Ниже —
              снимки <b>до каждой правки</b> (новые сверху). Клик = восстановить.
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : versions.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 italic">
                Правок ещё не было.
              </div>
            ) : versions.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setConfirmRestore(v)}
                className="w-full text-left px-2 py-2 rounded hover:bg-brand-yellow/20 focus:outline-none flex items-center gap-2"
              >
                <span className="h-6 w-6 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {versions.length - i}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {formatVersionDate(v.saved_at)}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="truncate flex-1">
                      {v.saved_by_name || "—"}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatBytes(v.file_size)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirm на восстановление версии. Предупреждаем, что текущий
          файл будет сохранён в новую версию — restore обратим. */}
      <AlertDialog
        open={!!confirmRestore}
        onOpenChange={(v) => { if (!v) setConfirmRestore(null) }}
      >
        <AlertDialogContent className="z-[140]">
          <AlertDialogHeader>
            <AlertDialogTitle>Восстановить версию?</AlertDialogTitle>
            <AlertDialogDescription>
              Файл будет заменён содержимым версии от{" "}
              <b>{formatVersionDate(confirmRestore?.saved_at)}</b>.
              Текущее содержимое <b>потеряется</b> — если это важно,
              сохрани его сначала как отдельный файл через «Скачать копию».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRestore && restore(confirmRestore)}
              className="bg-brand-yellow text-black hover:bg-yellow-500"
            >
              Восстановить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function formatVersionDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} КБ`
  return `${(kb / 1024).toFixed(1)} МБ`
}

// -----------------------------------------------------------------------------
// RulesDialog — управление правилами условного форматирования
// -----------------------------------------------------------------------------

function RulesDialog({
  open, onOpenChange, rules, selection, onAdd, onRemove,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  rules: ConditionalRule[]
  selection: SelectionRange | null
  onAdd: (r: ConditionalRule) => void
  onRemove: (id: string) => void
}) {
  const [op, setOp] = useState<ConditionalRule["op"]>(">")
  const [value, setValue] = useState("")
  const [fill, setFill] = useState<string>("#FEF3C7")
  const [textColor, setTextColor] = useState<string>("")

  const canAdd = !!selection && value.trim() !== ""

  const handleAdd = () => {
    if (!selection) return
    onAdd({
      id: Math.random().toString(36).slice(2),
      range: selection,
      op, value,
      fill: fill || undefined,
      textColor: textColor || undefined,
    })
    setValue("")
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[130] max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Условное форматирование</AlertDialogTitle>
          <AlertDialogDescription>
            Простые правила: когда значение ячейки удовлетворяет условию —
            применяем цвет. Правила живут только в редакторе и в xlsx
            не сохраняются (запечь можно через «Заливку» руками).
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Существующие правила */}
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {rules.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-3 text-center">
              Правил пока нет.
            </div>
          ) : rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-xs border border-gray-200 rounded px-2 py-1.5">
              <span className="tabular-nums text-gray-500 w-20 truncate">
                {describeRange(r.range)}
              </span>
              <span className="font-mono">{r.op}</span>
              <span className="font-mono text-gray-700 flex-1 truncate">{r.value}</span>
              {r.fill && (
                <span className="h-4 w-4 rounded border border-black/10" style={{ backgroundColor: r.fill }} />
              )}
              {r.textColor && (
                <span className="text-[10px] font-semibold" style={{ color: r.textColor }}>Aa</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="p-1 rounded hover:bg-red-50 text-red-500"
                title="Удалить"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Добавить правило */}
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Добавить
          </div>
          <div className="text-[11px] text-gray-500">
            Диапазон: <span className="font-mono">
              {selection ? describeRange(selection) : "выделите ячейки"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Если</span>
            <select
              value={op}
              onChange={(e) => setOp(e.target.value as ConditionalRule["op"])}
              className="h-7 rounded border border-gray-200 bg-white px-1 text-xs"
            >
              <option value="<">меньше</option>
              <option value="<=">≤</option>
              <option value="=">=</option>
              <option value="!=">≠</option>
              <option value=">=">≥</option>
              <option value=">">больше</option>
            </select>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="значение"
              className="h-7 rounded border border-gray-200 px-2 text-xs w-32 focus:outline-none focus:border-gray-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs">
              Заливка:
              <input
                type="color"
                value={fill || "#ffffff"}
                onChange={(e) => setFill(e.target.value.toUpperCase())}
                className="h-6 w-8 rounded border border-gray-200 cursor-pointer"
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs">
              Текст:
              <input
                type="color"
                value={textColor || "#000000"}
                onChange={(e) => setTextColor(e.target.value.toUpperCase())}
                className="h-6 w-8 rounded border border-gray-200 cursor-pointer"
              />
            </label>
          </div>
        </div>

        <AlertDialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <AlertDialogCancel className="m-0">Закрыть</AlertDialogCancel>
          <Button
            onClick={handleAdd}
            disabled={!canAdd}
            className="bg-brand-yellow text-black hover:bg-yellow-500 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Добавить
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
