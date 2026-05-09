import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getApiUrl } from '@/lib/api-address'

// Кэшируем по тегу 'catalog-visibility' — инвалидируется в админ-action
// при тогле видимости разделов.
const fetchCatalogVisibility = unstable_cache(
  async () => {
    const response = await fetch(getApiUrl('/api/catalog-visibility'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return { data: await response.json(), status: response.status }
  },
  ['catalog-visibility-public'],
  { tags: ['catalog-visibility'], revalidate: 3600 }
)

export async function GET() {
  try {
    const { data, status } = await fetchCatalogVisibility()
    return NextResponse.json(data, { status })
  } catch (error) {
    console.error('Error fetching catalog visibility:', error)
    // Fallback: all visible
    return NextResponse.json({ success: true, visibility: { sidebar: true, main: true, slide: true } })
  }
}
