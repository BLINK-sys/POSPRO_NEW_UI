/**
 * Нормализация имени товара для отображения (H1, title, OG, карточки).
 *
 * Правила — по требованию внешнего SEO-аудита:
 *   - бренды, модели, артикулы (всё что с цифрами, латиница, смешанный
 *     регистр) НЕ трогаем;
 *   - русские слова, целиком набранные капсом («ЛАРЬ», «МОРОЗИЛЬНЫЙ»),
 *     приводим к нормальному регистру;
 *   - русские слова в Title Case («С», «Мороз», «Шкафом»), если они
 *     стоят не в начале строки — приводим к lowercase. Это типичный
 *     результат автоматической капитализации в источниках данных
 *     («Стол С Мороз.шкафом» → «Стол с мороз.шкафом»);
 *   - первое слово в строке остаётся с заглавной (или становится
 *     Capitalized, если было капсом);
 *   - разделители `.`, `-`, `/` обрабатываются как границы слов —
 *     «Мороз.шкафом» режется на 2 токена и каждый обрабатывается
 *     отдельно.
 *
 * Латинские капс-слова (UNOX, SONY, PSF) — не трогаются никогда:
 * в русскоязычном магазине это почти всегда бренды/модели.
 */

const CYR_UPPER_RE = /[А-ЯЁ]/
const CYR_LOWER_RE = /[а-яё]/

function isAllCyrillicLetters(s: string): boolean {
  if (!s) return false
  for (const ch of s) {
    if (!CYR_UPPER_RE.test(ch) && !CYR_LOWER_RE.test(ch)) return false
  }
  return true
}

function isAllUpperCyrillic(s: string): boolean {
  if (!isAllCyrillicLetters(s)) return false
  return !CYR_LOWER_RE.test(s)
}

function isTitleCaseCyrillic(s: string): boolean {
  // Первая — заглавная кириллица, остальные (если есть) — строчные кириллицы.
  if (s.length < 2) return false
  if (!CYR_UPPER_RE.test(s[0])) return false
  for (let i = 1; i < s.length; i++) {
    if (!CYR_LOWER_RE.test(s[i])) return false
  }
  return true
}

function titleCaseWord(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1).toLowerCase()
}

/** Обрабатывает один «большой» токен (без пробелов внутри): разбивает
 *  по `.-/:` на подтокены, применяет правило к каждому и собирает обратно
 *  с теми же разделителями.
 *  Флаг `isFirst` — является ли этот токен первым словом целой строки. */
function processToken(token: string, isFirst: boolean): string {
  // Если в токене есть цифра — это артикул/модель, ничего не трогаем.
  if (/\d/.test(token)) return token

  const parts = token.split(/([.\-/:])/)
  let seenFirstLetter = false

  return parts
    .map((part) => {
      if (!part) return part
      if (/^[.\-/:]+$/.test(part)) return part

      // Полностью lowercase кириллица — оставляем.
      if (isAllCyrillicLetters(part) && !CYR_UPPER_RE.test(part)) {
        seenFirstLetter = true
        return part
      }

      // Полностью uppercase кириллица — Title/lower в зависимости от позиции.
      if (isAllUpperCyrillic(part)) {
        if (isFirst && !seenFirstLetter) {
          seenFirstLetter = true
          return titleCaseWord(part)
        }
        seenFirstLetter = true
        return part.toLowerCase()
      }

      // Title Case кириллица («Стол», «Мороз») — тоже в lower, если не первое.
      if (isTitleCaseCyrillic(part)) {
        if (isFirst && !seenFirstLetter) {
          seenFirstLetter = true
          return part
        }
        seenFirstLetter = true
        return part.toLowerCase()
      }

      // Всё остальное (латиница, смешанный регистр, спецсимволы) — не трогаем.
      seenFirstLetter = true
      return part
    })
    .join("")
}

/**
 * Применить правила нормализации ко всей строке имени товара.
 */
export function smartProductName(name: string): string {
  if (!name) return name
  const tokens = name.split(/(\s+)/) // сохраняем пробелы
  let firstWordHandled = false
  return tokens
    .map((tok) => {
      if (!tok.trim()) return tok // чистые пробелы
      const isFirst = !firstWordHandled
      firstWordHandled = true
      return processToken(tok, isFirst)
    })
    .join("")
}
