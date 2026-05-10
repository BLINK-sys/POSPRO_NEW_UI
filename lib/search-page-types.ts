// Типы для страницы поиска. Вынесены отдельно потому что:
// 1. "use server" файл (app/actions/search-page.ts) технически может
//    экспортировать interface'ы, но Next.js 14 предпочитает чтобы
//    серверные модули экспортировали только async-функции.
// 2. Route handler (app/api/public/search-page/route.ts) — серверный,
//    не должен ничего экспортировать кроме HTTP-методов.
// 3. Клиентским компонентам нужны те же типы.
// Один общий файл — все импортируют отсюда.

export interface SearchPageSettings {
  categories_enabled: boolean
  brands_enabled: boolean
}

export interface SearchPageCategoryItem {
  id: number
  name: string
  slug: string
  image_url: string | null
}

export interface SearchPageBrandItem {
  id: number
  name: string
  image_url: string | null
}

export interface SearchPagePublicData {
  settings: SearchPageSettings
  categories: SearchPageCategoryItem[]
  brands: SearchPageBrandItem[]
}
