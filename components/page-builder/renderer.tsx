import { cn } from "@/lib/utils"
import type { PageBlock } from "@/lib/page-blocks/types"

/**
 * Публичный рендерер массива блоков в HTML. Используется на страницах
 * /pay-delivery, /about, /help (см. `components/static-page-view.tsx`).
 *
 * Pure — никакого state и hooks. Каждый блок → соответствующая разметка.
 */

const alignCls = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const

const imgAlignCls = {
  left: "float-left mr-4 mb-2 clear-none",
  right: "float-right ml-4 mb-2 clear-none",
  center: "mx-auto block clear-both",
  none: "block clear-both",
} as const

const calloutCls = {
  info: "bg-blue-50 border-blue-600 text-blue-900",
  warning: "bg-amber-50 border-amber-600 text-amber-900",
  success: "bg-green-50 border-green-700 text-green-900",
} as const

/**
 * Нормализует YouTube-URL любого формата в embed-URL.
 * Возвращает null если url не похож на YouTube.
 */
function ytEmbed(url: string): string | null {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  if (!m) return null
  return `https://www.youtube.com/embed/${m[1]}`
}

export function BlocksRenderer({ blocks }: { blocks: PageBlock[] }) {
  if (!blocks.length) return null

  return (
    <div className="space-y-4">
      {blocks.map((b) => {
        switch (b.type) {
          case "heading": {
            const cls = cn("font-bold text-gray-900", alignCls[b.align], {
              "text-3xl md:text-4xl mt-6 mb-2": b.level === 1,
              "text-2xl md:text-3xl mt-5 mb-2": b.level === 2,
              "text-xl md:text-2xl mt-4 mb-1.5": b.level === 3,
            })
            if (b.level === 1) return <h1 key={b.id} className={cls}>{b.text}</h1>
            if (b.level === 2) return <h2 key={b.id} className={cls}>{b.text}</h2>
            return <h3 key={b.id} className={cls}>{b.text}</h3>
          }
          case "paragraph": {
            const html = b.html?.trim() || "<br/>"
            return (
              <div
                key={b.id}
                className={cn("prose max-w-none", alignCls[b.align], "text-gray-800 leading-relaxed")}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          }
          case "image": {
            if (!b.src) return <div key={b.id} className="text-xs text-gray-400 italic">[картинка не задана]</div>
            const w = Math.max(10, Math.min(100, b.widthPercent || 100))
            const style: React.CSSProperties = { width: `${w}%`, maxWidth: "100%" }
            if (b.heightPx) {
              style.height = `${b.heightPx}px`
              // Юзер явно указал высоту — рендерим точно как задано (fill),
              // без cover/центрирования (иначе картинка распределяется от
              // центра и «растёт вверх» при увеличении высоты).
              style.objectFit = "fill"
              style.objectPosition = "top"
            } else {
              style.height = "auto"
            }
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={b.id}
                src={b.src}
                alt={b.alt}
                className={cn("rounded-lg", imgAlignCls[b.align])}
                style={style}
              />
            )
          }
          case "callout": {
            return (
              <div
                key={b.id}
                className={cn("border-l-4 rounded-lg px-4 py-3", calloutCls[b.kind])}
                dangerouslySetInnerHTML={{ __html: b.html || "" }}
              />
            )
          }
          case "divider":
            return <hr key={b.id} className="my-6 border-gray-200 clear-both" />
          case "youtube": {
            const embed = ytEmbed(b.url)
            if (!embed) return <div key={b.id} className="text-xs text-gray-400 italic">[неверный YouTube-URL]</div>
            return (
              <div key={b.id} className="my-4 mx-auto max-w-2xl aspect-video">
                <iframe
                  src={embed}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            )
          }
          case "button": {
            const btnCls = b.variant === "primary"
              ? "inline-block px-5 py-2.5 rounded-lg bg-brand-yellow text-black font-medium hover:bg-yellow-500 transition-colors shadow-sm"
              : "inline-block px-5 py-2.5 rounded-lg border-2 border-brand-yellow text-black font-medium hover:bg-yellow-50 transition-colors"
            return (
              <div key={b.id} className={cn(alignCls[b.align], "my-3 clear-both")}>
                <a href={b.url || "#"} className={btnCls}>{b.text || "Кнопка"}</a>
              </div>
            )
          }
          case "table": {
            if (!b.rows.length) return null
            const [head, ...body] = b.hasHeader ? [b.rows[0], ...b.rows.slice(1)] : [null, ...b.rows]
            return (
              <div key={b.id} className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  {b.hasHeader && head && (
                    <thead className="bg-gray-100">
                      <tr>
                        {head.map((c, i) => (
                          <th key={i} className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-900">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {body.map((row, ri) => (
                      <tr key={ri} className="odd:bg-white even:bg-gray-50/50">
                        {row.map((c, ci) => (
                          <td key={ci} className="border border-gray-300 px-3 py-2 align-top text-gray-800">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          case "columns": {
            const gridCls = b.columnsCount === 3
              ? "grid-cols-1 md:grid-cols-3"
              : "grid-cols-1 md:grid-cols-2"
            const valignCls = b.verticalAlign === "center"
              ? "items-center"
              : b.verticalAlign === "bottom" ? "items-end" : "items-start"
            return (
              <div key={b.id} className={cn("grid gap-4 my-4", gridCls, valignCls)}>
                {b.items.map((col, i) => (
                  <div key={i} className="min-w-0">
                    <BlocksRenderer blocks={col} />
                  </div>
                ))}
              </div>
            )
          }
          case "html":
            return (
              <div
                key={b.id}
                className="prose max-w-none public-page"
                dangerouslySetInnerHTML={{ __html: b.html || "" }}
              />
            )
        }
      })}
    </div>
  )
}
