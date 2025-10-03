// Centralized API address configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000"

// Helper function to construct full API URLs
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint
  return `${API_BASE_URL}/${cleanEndpoint}`
}

// Common headers for API requests
export const getCommonHeaders = (includeAuth = false, token?: string) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (includeAuth && token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}
