import { getApiUrl, getCommonHeaders } from "./api-address"

// Client-side API helper functions
export class ApiClient {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jwt-token")
    }
    return null
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken()
    const url = getApiUrl(endpoint)

    const defaultHeaders = getCommonHeaders(!!token, token || undefined)

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return response.json()
    }

    return response.text() as unknown as T
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: "GET" })
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // PATCH request
  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: "DELETE" })
  }

  // DELETE request with body
  async deleteWithBody<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // Upload file
  async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = this.getToken()
    const url = getApiUrl(endpoint)

    const headers: HeadersInit = {}

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }
}

// Export a singleton instance
export const apiClient = new ApiClient()

// Client-side functions for media management
export const mediaApi = {
  // Delete media file
  async deleteMedia(mediaId: number): Promise<void> {
    return apiClient.delete(`/upload/media/${mediaId}`)
  },

  // Get media for product
  async getMedia(productId: number): Promise<any[]> {
    return apiClient.get(`/upload/media/${productId}`)
  },

  // Add media by URL
  async addMediaByUrl(productId: number, url: string, mediaType: string): Promise<any> {
    return apiClient.post(`/upload/media/${productId}`, {
      url,
      media_type: mediaType
    })
  },

  // Reorder media
  async reorderMedia(productId: number, items: { id: number; order: number }[]): Promise<void> {
    return apiClient.post(`/upload/media/reorder/${productId}`, { items })
  },

  // Upload product file
  async uploadProductFile(formData: FormData): Promise<any> {
    return apiClient.uploadFile("/upload/upload_product", formData)
  }
}
