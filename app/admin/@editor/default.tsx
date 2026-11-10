// Default для параллельного слота `@editor`. Пусто — ничего не рисуем,
// когда overlay-маршрут не активен. Файл обязателен для корректной
// работы параллельных маршрутов Next.js.
export default function EditorDefault() {
  return null
}
