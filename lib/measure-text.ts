/**
 * Меряет ширину текста через canvas — быстро, без DOM-ноды.
 * font — CSS-строка вида "500 12px system-ui, sans-serif" (тот же формат,
 * что принимает `ctx.font`). На сервере возвращает 0 (SSR-safe).
 */
export function measureMaxTextWidth(texts: string[], font: string): number {
  if (typeof document === "undefined" || texts.length === 0) return 0
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return 0
  ctx.font = font
  let max = 0
  for (const t of texts) {
    const w = ctx.measureText(t).width
    if (w > max) max = w
  }
  return Math.ceil(max)
}
