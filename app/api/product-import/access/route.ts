import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

const BACKEND_ENDPOINT = "/api/product-import/access"

// Used by the admin product create form to decide whether to render the
// "Импорт из URL" button. Backend resolves the current system user from
// the JWT cookie and consults the ai_consultant_access table.
export async function GET() {
  const token = cookies().get("jwt-token")?.value
  try {
    const response = await fetch(getApiUrl(BACKEND_ENDPOINT), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying product-import access check:", error)
    return NextResponse.json({ has_access: false, kind: "guest" }, { status: 200 })
  }
}
