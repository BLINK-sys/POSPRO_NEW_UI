import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { unstable_cache } from "next/cache"
import { getApiUrl } from "@/lib/api-address"

const BACKEND_ENDPOINT = "/api/ai-consultant/access"

// Анонимный путь кэшируется по тегу 'ai-access' (инвалидируется в админ-action
// настройки доступа). Авторизованный путь не кэшируется — для него ответ
// зависит от роли + whitelist'ов; делать per-user кэш-ключи не имеет смысла.
const fetchGuestAccess = unstable_cache(
  async () => {
    const response = await fetch(getApiUrl(BACKEND_ENDPOINT), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
    return { data: await response.json(), status: response.status }
  },
  ["ai-consultant-access-guest"],
  { tags: ["ai-access"], revalidate: 3600 }
)

// Public endpoint — works with or without JWT. Forwards the auth cookie
// when present so Flask can resolve the user; without it the response is
// computed for a guest viewer.
export async function GET() {
  const token = cookies().get("jwt-token")?.value
  try {
    if (token) {
      // Авторизованный — свежий ответ, ответ зависит от роли/whitelist'ов
      const response = await fetch(getApiUrl(BACKEND_ENDPOINT), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    }
    // Гость — из кэша
    const { data, status } = await fetchGuestAccess()
    return NextResponse.json(data, { status })
  } catch (error) {
    console.error("Error proxying AI consultant access check:", error)
    // Fail closed — if Flask is unreachable, deny rather than show the
    // button. Better to hide the feature than leak it on infra glitch.
    return NextResponse.json({ has_access: false, kind: "guest" }, { status: 200 })
  }
}
