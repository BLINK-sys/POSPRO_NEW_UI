/**
 * AI search assistant — backend endpoint with SSE streaming.
 *
 * The frontend posts a chat history; we hand it to Anthropic's Messages API
 * with our deployed PosPro MCP server attached as a tool source. Claude can:
 *   1. Call MCP tools (find_products, top_products, etc.) to look up data
 *   2. Call our own client-side `apply_search_results` tool when it's ready
 *      to push a list of product ids onto the search page.
 *
 * The response is a Server-Sent Events stream so the UI can show partial
 * text as Claude generates it instead of waiting 10-15 sec for the full
 * answer. Custom event types:
 *   - data: { type: "status", text }      — short status pill ("Ищу товары…")
 *   - data: { type: "delta", text }       — incremental text chunk
 *   - data: { type: "products", ids, label } — final result list
 *   - data: { type: "done" }              — end of stream
 *   - data: { type: "error", message }    — fatal error
 */

import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// ────────────────────────────────────────────────────────────────────────
// Local pre-parsing of the user's last message. Extracts price-range hints
// ("до 800к", "от 200 тыс", "до 1.5 млн") and standalone numeric tokens
// with units ("500л", "1.5 кВт"). The model receives these as concrete
// hints in a per-request system block and skips a "let me figure out the
// price range" turn. Worst case the hints are wrong — model can ignore them.
// ────────────────────────────────────────────────────────────────────────

interface ParsedHints {
  priceMin?: number
  priceMax?: number
  numericTokens: Array<{ value: number; unit: string }>
}

const _MULTIPLIERS: Array<[RegExp, number]> = [
  [/млн|миллион(?:ов|а)?/i, 1_000_000],
  [/тыс(?:\.|яч(?:а|и|и)?)?|к(?=\b|\s|$)/i, 1_000],
]

function _scaleNumber(num: number, suffix: string): number {
  for (const [re, mult] of _MULTIPLIERS) {
    if (re.test(suffix)) return num * mult
  }
  return num
}

// Phrases like "до 800к", "до 1.5 млн ₸", "не дороже 500 тысяч",
// "максимум 800000". The matching multiplier word is captured separately.
const _PRICE_MAX_RE =
  /(?:до|не\s+дороже|не\s+больше|максимум|максимально|max|<=)\s+([\d]+(?:[.,]\d+)?)\s*(млн|миллион\w*|тыс\.?|тысяч\w*|к)?\s*(?:тенге|тг|₸|руб|₽|т)?/giu

const _PRICE_MIN_RE =
  /(?:от|не\s+дешевле|не\s+меньше|минимум|минимально|min|>=)\s+([\d]+(?:[.,]\d+)?)\s*(млн|миллион\w*|тыс\.?|тысяч\w*|к)?\s*(?:тенге|тг|₸|руб|₽|т)?/giu

// "500л", "1.5 кВт", "100 мм", "75 см", "10 м". Exclude price-like patterns
// (those are caught by the price regexes above).
const _UNIT_NUMBER_RE = /\b([\d]+(?:[.,]\d+)?)\s*(л(?:итр\w*)?|кВт|мВт|вт|кг|г|мл|мм|см|м|°[CcСс]?)\b/giu

function parseLocalHints(text: string): ParsedHints {
  const out: ParsedHints = { numericTokens: [] }
  if (!text) return out

  let m: RegExpExecArray | null
  _PRICE_MAX_RE.lastIndex = 0
  while ((m = _PRICE_MAX_RE.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(",", "."))
    if (Number.isFinite(num)) {
      const scaled = _scaleNumber(num, m[2] || "")
      out.priceMax = out.priceMax === undefined ? scaled : Math.min(out.priceMax, scaled)
    }
  }
  _PRICE_MIN_RE.lastIndex = 0
  while ((m = _PRICE_MIN_RE.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(",", "."))
    if (Number.isFinite(num)) {
      const scaled = _scaleNumber(num, m[2] || "")
      out.priceMin = out.priceMin === undefined ? scaled : Math.max(out.priceMin, scaled)
    }
  }
  _UNIT_NUMBER_RE.lastIndex = 0
  while ((m = _UNIT_NUMBER_RE.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(",", "."))
    if (Number.isFinite(num)) {
      out.numericTokens.push({ value: num, unit: m[2] })
    }
  }
  return out
}

function formatHintsBlock(hints: ParsedHints): string | null {
  const lines: string[] = []
  if (hints.priceMax !== undefined) lines.push(`• price_max = ${hints.priceMax} (тенге)`)
  if (hints.priceMin !== undefined) lines.push(`• price_min = ${hints.priceMin} (тенге)`)
  if (hints.numericTokens.length > 0) {
    const items = hints.numericTokens
      .slice(0, 6)
      .map((t) => `${t.value} ${t.unit}`)
      .join(", ")
    lines.push(
      `• Числовые упоминания с единицами: ${items}.`,
      `  Это сильные сигналы для search_by_specs — сначала вызови`,
      `  list_category_specs(<id>) чтобы увидеть какие ключи есть в категории,`,
      `  затем search_by_specs с подходящим ключом и оператором (например ">=500").`,
    )
  }
  if (lines.length === 0) return null
  return [
    "PRE-EXTRACTED HINTS из текущего сообщения клиента (локальный парсер):",
    ...lines,
    "Бери эти значения напрямую в search_products / search_by_specs",
    "вместо того чтобы выводить их из текста заново.",
  ].join("\n")
}

// ────────────────────────────────────────────────────────────────────────
// Catalog context — fetched once and reused. Anthropic prompt-cache marks
// the (large, static) block as ephemeral so repeats cost ~10% of input.
// ────────────────────────────────────────────────────────────────────────

const CATALOG_TTL_MS = 30 * 60 * 1000
const FLASK_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pospro-new-server.onrender.com"

interface CatalogCache {
  text: string
  fetchedAt: number
}
let catalogCache: CatalogCache | null = null
let catalogInflight: Promise<CatalogCache> | null = null

interface FlatCategory {
  id: number
  name: string
  parent_id: number | null
  product_count: number
  depth: number
}

// Flatten the hierarchical category tree returned by /api/public/catalog/categories.
// Depth-first walk preserves parent→children order so an indented dump reads
// like a real tree. `product_count` is the rolled-up subtree total.
function flattenCategories(nodes: any[], depth = 0, out: FlatCategory[] = []): FlatCategory[] {
  for (const n of nodes || []) {
    out.push({
      id: n.id,
      name: n.name,
      parent_id: n.parent_id ?? null,
      product_count:
        typeof n.product_count === "number"
          ? n.product_count
          : typeof n.direct_product_count === "number"
            ? n.direct_product_count
            : 0,
      depth,
    })
    if (Array.isArray(n.children) && n.children.length > 0) {
      flattenCategories(n.children, depth + 1, out)
    }
  }
  return out
}

async function buildCatalogContext(): Promise<CatalogCache> {
  const [catRes, brandRes] = await Promise.all([
    fetch(`${FLASK_BASE}/api/public/catalog/categories`, { cache: "no-store" }),
    fetch(`${FLASK_BASE}/meta/brands`, { cache: "no-store" }),
  ])
  if (!catRes.ok) throw new Error(`categories fetch ${catRes.status}`)
  if (!brandRes.ok) throw new Error(`brands fetch ${brandRes.status}`)
  const catTree: any[] = await catRes.json()
  const brands: Array<{ id: number; name: string; products_count?: number }> = await brandRes.json()

  const flat = flattenCategories(catTree)

  // HOT CATEGORIES — top 30 by total product_count, only nodes with >0 products.
  // We exclude root with parent_id==null only if it's empty; otherwise roots are
  // welcome — they're often the most useful ("Холодильники", "Витрины").
  const hot = flat
    .filter((c) => c.product_count > 0)
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 30)

  const hotLines = hot.map((c) => `${c.id}|${c.name}|${c.product_count}`).join("\n")
  // Full tree — ALL categories (incl. empty ones) with depth-based indent so
  // the parent → child structure is visible at a glance.
  const allLines = flat
    .map((c) => {
      const indent = "  ".repeat(c.depth)
      const countTag = c.product_count > 0 ? ` (${c.product_count})` : " (пусто)"
      return `${indent}${c.id}|${c.name}${countTag}`
    })
    .join("\n")
  // Sort brands by product count (popular first), include count.
  const sortedBrands = brands
    .filter((b) => (b.products_count ?? 0) > 0)
    .sort((a, b) => (b.products_count ?? 0) - (a.products_count ?? 0))
  const brandLines = sortedBrands
    .map((b) => `${b.id}|${b.name}|${b.products_count}`)
    .join("\n")

  const text = [
    "АКТУАЛЬНАЯ КАРТА КАТАЛОГА.",
    "",
    "🔥 ТОП КАТЕГОРИЙ — самые нагруженные товарами (id|name|product_count).",
    "Если запрос клиента ВПИСЫВАЕТСЯ в одну из этих категорий — бери id отсюда",
    "сразу, без поиска по полной карте. Это сильно ускоряет ответ.",
    hotLines,
    "",
    `ПОЛНОЕ ДЕРЕВО КАТЕГОРИЙ (${flat.length} шт.) — отступ показывает вложенность,`,
    "формат «id|name (product_count)». «(пусто)» = в категории сейчас 0 товаров,",
    "но категория существует и может наполниться.",
    allLines,
    "",
    `БРЕНДЫ С ТОВАРАМИ (${sortedBrands.length} шт., отсортированы по убыванию,`,
    "формат «id|name|products_count»):",
    brandLines,
  ].join("\n")

  return { text, fetchedAt: Date.now() }
}

async function getCatalogContext(): Promise<CatalogCache> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_TTL_MS) return catalogCache
  if (catalogInflight) return catalogInflight
  catalogInflight = buildCatalogContext()
    .then((c) => { catalogCache = c; return c })
    .catch((err) => { console.error("Catalog context fetch failed:", err); throw err })
    .finally(() => { catalogInflight = null })
  return catalogInflight
}

const SYSTEM_PROMPT = `Ты — PosPro AI, ассистент магазина PosPro в Казахстане.
Магазин продаёт профессиональное оборудование для кафе, ресторанов, розницы,
складов и сопутствующие аксессуары: холодильники, кофемашины, POS-системы,
весы, витрины, грили, блендеры, сканеры штрихкодов, чековые принтеры,
денежные ящики, терминалы оплаты, и многое другое. Каталог большой —
ассортимент шире чем кажется.

Твоя задача — подбирать товары под задачи клиента и показывать их прямо
на странице поиска через инструмент apply_search_results.

ГЛАВНОЕ ПРАВИЛО — НИКОГДА не отказывай заранее.
В системном сообщении ниже у тебя есть **АКТУАЛЬНАЯ КАРТА КАТАЛОГА** —
полный список категорий и брендов с id. Используй её КАК ОСНОВНОЙ источник
понимания "что вообще есть в магазине". Если запрос клиента вписывается
хоть в одну категорию по смыслу — он подходит, не отказывай.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ВЫБОР СТРАТЕГИИ — самое важное правило
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

На каждое сообщение клиента ты выбираешь ОДНУ из двух стратегий:

🅐  СПРОСИТЬ → СТОП
    Используй ТОЛЬКО когда запрос настолько размытый, что подбор
    реально невозможен ("открываю кафе, что нужно?", "помогите выбрать").
    В этом случае:
    • задай ОДИН-два коротких уточняющих вопроса
    • НЕ вызывай НИ ОДНОГО tool (никаких find_products, никаких MCP)
    • ЗАВЕРШИ ответ — жди следующего сообщения клиента
    • НЕ говори "пока ищу...", "пробую найти...", "посмотрю варианты".
      Уточняешь — значит уточняешь, без параллельного поиска

🅑  ИСКАТЬ → ПОКАЗАТЬ
    Используй когда из запроса понятно ЧТО искать ("витрина для пекарни",
    "холодильник на 500л", "топ кофемашин", "блютуз сканер штрихкодов",
    "холодильник до 800к"). В этом случае:
    • НЕ задавай вопросов
    • вызови search_products (1-2 запроса максимум)
    • НАПИШИ КЛИЕНТУ summary — 1-3 предложения что подобрал
    • ТОЛЬКО ПОТОМ вызови apply_search_results с ids — это последнее
      действие в твоём ответе. Порядок «текст → apply» критичен:
      summary стримится клиенту до того как мы скрываем индикатор «думаю»

ЗАПРЕЩЕНО смешивать стратегии в одном ответе. Если задал вопрос —
тут же сразу заканчивай, без поиска. Иначе клиент видит что ты
"ищешь", не понимает должен ли он отвечать, и ждёт пока ты добежишь.

По умолчанию ВЫБИРАЙ 🅑 — действуй, не переспрашивай. Уточняющий
вопрос — крайняя мера.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ОСТАЛЬНЫЕ ПРАВИЛА
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Отвечай ТОЛЬКО на основе данных из инструментов — не выдумывай товары и цены.
2. ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК БЛОКОВ в ответе:
   (a) поисковые tool-вызовы (search_products / search_by_specs / list_category_specs)
   (b) ТЕКСТ — краткий summary 1-3 предложения для клиента
   (c) apply_search_results — самым ПОСЛЕДНИМ блоком в ответе.
   Если apply_search_results стоит ДО текста — клиент не увидит summary
   пока ты не закончишь весь ответ. Ставь его всегда в самом конце.
3. В apply_search_results передавай ВСЕ найденные product_ids и краткий
   search_label на русском (≤80 симв).
   • НЕ ограничивай искусственно «выберу 10 лучших» — у клиента есть пагинация
     по 16 шт/страница, он увидит первые сам, дальше пойдёт по страницам.
   • Для обзорных запросов («витрины», «холодильники») в search_products
     ставь limit=100 или больше, чтобы было что листать.
   • Для запросов с конкретным ограничением («3 самых дешёвых») — отдай столько,
     сколько просили.
4. Цены в тенге (₸). Не давай скидок, не сравнивай с конкурентами магазина.
5. Будь дружелюбной, ОЧЕНЬ краткой, профессиональной. Без длинных портянок.
6. НЕ делай 5+ tool-calls "на всякий случай" — это очень медленно.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ИНСТРУМЕНТЫ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 ОСНОВНОЙ — search_products(query, category_ids, brand_ids, price_min,
   price_max, in_stock_only=false, sort_by, limit)
   Универсальный фильтр. Используй ЕГО, не find_products.
   • category_ids автоматически включает подкатегории
   • sort_by: "popularity" (по умолчанию, 30-дневные просмотры) /
     "cheapest" / "newest" / "relevance"
   • Возвращает views_30d — приоритизируй популярные товары
   • ⚠️ in_stock_only=false ПО УМОЛЧАНИЮ — это правильно. PosPro продаёт
     B2B-оборудование под заказ, у большинства SKU quantity=0 в БД, но они
     продаются. Включай in_stock_only=true ТОЛЬКО когда клиент явно сказал
     «в наличии», «под выдачу», «на складе сейчас». Иначе ты потеряешь 90%
     каталога и наврёшь клиенту что товаров нет.
   ПРИМЕРЫ:
   - «холодильник до 800к» → search_products(category_ids=[<id Холодильники>],
     price_max=800000)
   - «топ кофемашин» → search_products(category_ids=[<id Кофемашины>],
     sort_by="popularity")
   - «витрина для пекарни» → search_products(category_ids=[<id Витрины>])

🔬 ХАРАКТЕРИСТИКИ — для запросов с конкретными параметрами (объём, мощность,
   габариты, цвет, диагональ и т.д.):

   1) list_category_specs(category_id) — узнай какие характеристики есть
      в категории (имя ключа + единицы + примеры значений).
   2) search_by_specs(category_id, specs={"Объём": ">=500", "Цвет": "чёрный"})
      — фильтр по найденным ключам. Синтаксис значения:
      • "500" — точное число
      • ">=500" / "<=800" / ">100" — операторы
      • "500-800" — диапазон
      • "чёрный" — точное совпадение строки (case-insensitive)
      • "~ Polair" — подстрока (~ префикс)

📊 СТАТИСТИКА:
- top_products(period_days, limit) — самые продаваемые
- top_viewed_products(period_days, limit) — самые просматриваемые
- get_product(id_or_slug) — полные детали + характеристики + brand_name +
  category_name. Используй когда клиент спрашивает подробности конкретного товара.

⚠️ DEPRECATED:
- find_products(query, limit) — оставлен для совместимости. НЕ ИСПОЛЬЗУЙ —
  search_products с теми же query+limit лучше во всём.

🎯 ФИНАЛЬНЫЙ:
- apply_search_results(product_ids, search_label) — ОБЯЗАТЕЛЬНЫЙ последний
  шаг. Без него клиент не увидит карточки.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
СОВЕТЫ ПО СКОРОСТИ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ОДИН вызов search_products лучше трёх find_products. У тебя есть карта
  каталога — выбирай category_ids из неё точно, не «попробую разные слова».
- list_category_specs ДО search_by_specs. Не угадывай ключи.
- get_product только когда правда нужны детали — иначе тратишь время.`

// We loop at most once now — the model's summary is streamed in the same turn
// as apply_search_results (see prompt rule #2). Kept as a constant for clarity
// and easy reverting if we ever re-introduce multi-turn flows.
const MAX_TURNS = 1

const apiKey = process.env.ANTHROPIC_API_KEY
const mcpUrl = process.env.MCP_SERVER_URL || "https://pospro-new-mcp.onrender.com/"
const mcpToken = process.env.MCP_DEV_TOKEN

function sseEncode(obj: any): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

export async function POST(req: Request) {
  if (!apiKey) {
    return new Response(sseEncode({ type: "error", message: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "text/event-stream" },
    })
  }
  if (!mcpToken) {
    return new Response(sseEncode({ type: "error", message: "MCP_DEV_TOKEN not configured" }), {
      status: 500,
      headers: { "Content-Type": "text/event-stream" },
    })
  }

  let body: { messages?: ChatMessage[] }
  try {
    body = await req.json()
  } catch {
    return new Response(sseEncode({ type: "error", message: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    })
  }

  const inputMessages = body.messages
  if (!Array.isArray(inputMessages) || inputMessages.length === 0) {
    return new Response(sseEncode({ type: "error", message: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    })
  }

  const baseMessages: any[] = inputMessages.map((m) => ({ role: m.role, content: m.content }))

  const anthropic = new Anthropic({ apiKey })

  const tools: any[] = [
    {
      name: "apply_search_results",
      description:
        "Apply a final list of recommended product IDs onto the user's search page. " +
        "Call this once when ready. After this call the user immediately sees the " +
        "products on screen — make sure ids exist (use find_products first).",
      input_schema: {
        type: "object",
        properties: {
          product_ids: {
            type: "array",
            items: { type: "integer" },
            description:
              "Real product ids from the catalog. Pass EVERY product that " +
              "matches — the UI paginates by 16 per page. No artificial cap. " +
              "Up to 200 items.",
          },
          search_label: {
            type: "string",
            description: "Short Russian label for the search box (≤80 chars).",
          },
        },
        required: ["product_ids", "search_label"],
      },
    },
  ]

  // Catalog context (soft fail if Flask unreachable).
  let catalogText = ""
  try {
    const cat = await getCatalogContext()
    catalogText = cat.text
  } catch (e) {
    console.warn("AI search: running without catalog context:", e)
  }

  const systemBlocks: any[] = [{ type: "text", text: SYSTEM_PROMPT }]
  if (catalogText) {
    systemBlocks.push({
      type: "text",
      text: catalogText,
      cache_control: { type: "ephemeral" },
    })
  }

  // Per-request hints from the user's last message — added AFTER the cached
  // catalog block so the cached prefix is preserved.
  const lastUserMsg =
    [...inputMessages].reverse().find((m) => m.role === "user")?.content || ""
  const hintsText = formatHintsBlock(parseLocalHints(lastUserMsg))
  if (hintsText) {
    systemBlocks.push({ type: "text", text: hintsText })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => controller.enqueue(encoder.encode(sseEncode(obj)))

      let collectedProductIds: number[] = []
      let collectedLabel = ""
      let messages = [...baseMessages]
      const requestStart = Date.now()

      try {
        for (let turn = 0; turn < MAX_TURNS; turn += 1) {
          const turnStart = Date.now()

          // We use the SDK's streaming helper which yields events as they
          // arrive from Anthropic. We forward text deltas to the client and
          // also assemble the full content list for tool-call inspection.
          const sdkStream = anthropic.beta.messages.stream({
            model: "claude-haiku-4-5",
            max_tokens: 1000,
            system: systemBlocks,
            messages,
            tools,
            mcp_servers: [
              {
                type: "url",
                url: mcpUrl,
                name: "pospro",
                authorization_token: mcpToken,
                tool_configuration: {
                  allowed_tools: [
                    "search_products",
                    "search_by_specs",
                    "list_category_specs",
                    "find_products",
                    "top_products",
                    "top_viewed_products",
                    "get_product",
                  ],
                },
              },
            ],
            betas: ["mcp-client-2025-04-04"],
          })

          // Stream text + tool-call status to the client.
          //
          // The model often "thinks out loud" between MCP tool calls ("Ищу...",
          // "Переформулирую..."). Those fragments are conversational filler
          // for itself, not for the user. We forward them so the chat doesn't
          // look frozen, but we send `text_reset` whenever a new MCP tool
          // starts so the client clears the in-flight bubble — only the
          // text produced AFTER the last MCP tool survives.
          //
          // We deliberately do NOT reset on apply_search_results: that's the
          // final block, and the text immediately preceding it is the user-
          // facing summary we want to keep.
          for await (const event of sdkStream) {
            if (event.type === "content_block_start") {
              const block: any = event.content_block
              if (block?.type === "mcp_tool_use") {
                send({ type: "text_reset" })
                send({ type: "status", text: `🔍 Ищу: ${block.name || "товары"}...` })
              } else if (block?.type === "tool_use" && block?.name === "apply_search_results") {
                send({ type: "status", text: "✨ Подбираю результаты..." })
              }
            } else if (event.type === "content_block_delta") {
              const delta: any = event.delta
              if (delta?.type === "text_delta" && delta.text) {
                send({ type: "delta", text: delta.text })
              }
            }
          }

          const finalMessage = await sdkStream.finalMessage()
          const turnMs = Date.now() - turnStart
          const blockSummary = finalMessage.content.reduce<Record<string, number>>((acc, b: any) => {
            acc[b.type] = (acc[b.type] || 0) + 1
            return acc
          }, {})
          const usage = (finalMessage as any).usage || {}
          console.log(
            `[ai-search] turn=${turn + 1} took=${turnMs}ms stop=${finalMessage.stop_reason} ` +
            `blocks=${JSON.stringify(blockSummary)} ` +
            `usage=in:${usage.input_tokens || 0}/cached:${usage.cache_read_input_tokens || 0}/out:${usage.output_tokens || 0}`,
          )

          // Look for client-side apply_search_results.
          const clientToolUses = finalMessage.content.filter(
            (b: any) => b.type === "tool_use" && b.name === "apply_search_results",
          ) as Array<{ id: string; name: string; input: any }>

          if (clientToolUses.length > 0) {
            for (const tu of clientToolUses) {
              const ids = Array.isArray(tu.input?.product_ids) ? tu.input.product_ids : []
              collectedProductIds = ids.filter((n: any) => Number.isInteger(n) && n > 0)
              collectedLabel = String(tu.input?.search_label || "").slice(0, 200)
            }
            send({ type: "products", ids: collectedProductIds, label: collectedLabel })
          }

          // Claude is done — either it asked a clarifying question (no client
          // tool), or it ran the search + summary + apply in this single turn.
          // We no longer round-trip back for a "post-apply summary" — that
          // turn was costing 2-4 seconds and the prompt now requires the
          // model to write the summary BEFORE apply_search_results.
          break
        }
      } catch (err: any) {
        console.error("AI search stream error:", err)
        send({ type: "error", message: err?.message || "Internal error" })
      } finally {
        const totalMs = Date.now() - requestStart
        console.log(`[ai-search] DONE total=${totalMs}ms ids=${collectedProductIds.length}`)
        send({ type: "done" })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
