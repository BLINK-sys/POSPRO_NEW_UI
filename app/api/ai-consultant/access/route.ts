import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

const BACKEND_ENDPOINT = "/api/ai-consultant/access"

// Public endpoint — works with or without JWT. Forwards the auth cookie
// when present so Flask can resolve the user; without it the response is
// computed for a guest viewer.
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
    console.error("Error proxying AI consultant access check:", error)
    // Fail closed — if Flask is unreachable, deny rather than show the
    // button. Better to hide the feature than leak it on infra glitch.
    return NextResponse.json({ has_access: false, kind: "guest" }, { status: 200 })
  }
}
