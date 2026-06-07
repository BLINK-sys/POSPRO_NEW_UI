/**
 * Форматирование текста шильдика статуса наличия.
 *
 * Обычный статус: возвращает `status_name`.
 * Статус с режимом «Поступление» (`is_arrival_status`): добавляет дату
 *   ожидаемого поступления = сегодня + `arrival_days`, формат `DD.MM.YYYY`.
 *
 * Дата считается **на клиенте при рендере** — т.е. она «живая» и
 * каждый день меняется без участия бэка. Бэк хранит только смещение
 * в днях.
 */

interface ArrivalStatusFields {
  status_name: string
  is_arrival_status?: boolean | null
  arrival_days?: number | null
}

export function formatAvailabilityStatusLabel(status: ArrivalStatusFields, now: Date = new Date()): string {
  if (!status.is_arrival_status) return status.status_name
  // Если режим включён, но days не задано — показываем без даты, чтобы
  // не было пугающего "Поступление - Invalid Date" или "сегодня".
  const days = status.arrival_days
  if (days === null || days === undefined || days < 0) return status.status_name
  const target = new Date(now)
  target.setDate(target.getDate() + days)
  const dd = String(target.getDate()).padStart(2, '0')
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  const yyyy = target.getFullYear()
  return `${status.status_name} - ${dd}.${mm}.${yyyy}`
}
