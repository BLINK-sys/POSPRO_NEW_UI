import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

const BACKEND_ENDPOINT = "/api/ai-consultant/settings-admin-access"

// Used by the admin sidebar (decide whether to render the AI Settings
// menu item) and by /admin/ai-consultant page (gate access). Owner is
// always allowed; other system users only if the owner opted them in.
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
    console.error("Error proxying settings-admin-access check:", error)
    return NextResponse.json(
      { has_access: false, is_owner: false, kind: "guest" },
      { status: 200 },
    )
  }
}
