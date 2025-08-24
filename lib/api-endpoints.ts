// Centralized API endpoints configuration
export const API_ENDPOINTS = {
  // Authentication endpoints
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
    PROFILE: "/auth/profile",
  },

  // Profile endpoints
  PROFILE: {
    GET: "/api/profile",
    UPDATE: "/api/profile",
  },

  // Categories endpoints
  CATEGORIES: {
    LIST: "/categories/",
    GET: (id: number) => `/categories/${id}`,
    CREATE: "/categories/with-image",
    UPDATE: (id: number) => `/categories/${id}`,
    DELETE: (id: number) => `/categories/${id}`,
    REORDER: "/categories/reorder",
    UPLOAD_IMAGE: (id: number) => `/upload/category/${id}`,
    DELETE_IMAGE: (id: number) => `/upload/category/${id}/image`,
  },

  // Products endpoints
  PRODUCTS: {
    LIST: "/products/",
    GET: (slug: string) => `/products/${slug}`,
    CREATE_DRAFT: "/products/draft",
    DELETE_DRAFT: (id: number) => `/products/draft/${id}`,
    FINALIZE: (id: number) => `/products/${id}/finalize`,
    UPDATE: (id: number) => `/products/${id}`,
    DELETE: (id: number) => `/products/${id}`,
  },

  // Product characteristics endpoints
  CHARACTERISTICS: {
    LIST: (productId: number) => `/characteristics/${productId}`,
    CREATE: (productId: number) => `/characteristics/${productId}`,
    DELETE: (id: number) => `/characteristics/${id}`,
    REORDER: (productId: number) => `/characteristics/reorder/${productId}`,
  },

  // Media endpoints
  MEDIA: {
    LIST: (productId: number) => `/upload/media/${productId}`,
    CREATE: (productId: number) => `/upload/media/${productId}`,
    DELETE: (id: number) => `/upload/media/${id}`,
    REORDER: (productId: number) => `/upload/media/reorder/${productId}`,
  },

  // Documents endpoints
  DOCUMENTS: {
    LIST: (productId: number) => `/upload/documents/${productId}`,
    UPLOAD: "/upload/documents/upload",
    DELETE: (id: number) => `/upload/documents/${id}`,
  },

  // Drivers endpoints
  DRIVERS: {
    LIST: (productId: number) => `/upload/drivers/${productId}`,
    UPLOAD: "/upload/drivers/upload",
    DELETE: (id: number) => `/upload/drivers/${id}`,
  },

  // Upload endpoints
  UPLOAD: {
    PRODUCT: "/upload/upload_product",
  },

  // Meta endpoints (brands and statuses)
  META: {
    BRANDS: {
      LIST: "/meta/brands",
      UPDATE: (id: number) => `/meta/brands/${id}`,
      DELETE: (id: number) => `/meta/brands/${id}`,
      UPLOAD_IMAGE: (id: number) => `/meta/brands/upload/${id}`,
    },
    STATUSES: {
      LIST: "/meta/statuses",
      UPDATE: (id: number) => `/meta/statuses/${id}`,
      DELETE: (id: number) => `/meta/statuses/${id}`,
    },
  },

  // Users endpoints
  USERS: {
    CLIENTS: {
      LIST: "/api/clients",
      CREATE: "/api/clients",
      UPDATE: (id: number) => `/api/clients/${id}`,
      DELETE: (id: number) => `/api/clients/${id}`,
    },
    SYSTEM_USERS: {
      LIST: "/api/system-users",
      CREATE: "/api/system-users",
      UPDATE: (id: number) => `/api/system-users/${id}`,
      DELETE: (id: number) => `/api/system-users/${id}`,
    },
  },

  // Admin endpoints
  ADMIN: {
    BANNERS: {
      LIST: "/api/admin/banners",
      CREATE: "/api/admin/banners",
      UPDATE: (id: number) => `/api/admin/banners/${id}`,
      DELETE: (id: number) => `/api/admin/banners/${id}`,
    },
    SMALL_BANNERS: {
      LIST: "/api/admin/small-banners",
      CREATE: "/api/admin/small-banners",
      UPDATE: (id: number) => `/api/admin/small-banners/${id}`,
      DELETE: (id: number) => `/api/admin/small-banners/${id}`,
    },
    BENEFITS: {
      LIST: "/api/admin/benefits",
      CREATE: "/api/admin/benefits",
      UPDATE: (id: number) => `/api/admin/benefits/${id}`,
      DELETE: (id: number) => `/api/admin/benefits/${id}`,
      REORDER: "/api/admin/benefits/reorder",
    },
    PRODUCT_AVAILABILITY_STATUSES: {
      LIST: "/api/admin/product-availability-statuses",
      CREATE: "/api/admin/product-availability-statuses",
      UPDATE: (id: number) => `/api/admin/product-availability-statuses/${id}`,
      DELETE: (id: number) => `/api/admin/product-availability-statuses/${id}`,
      REORDER: "/api/admin/product-availability-statuses/reorder",
    },
  },

  // Homepage Blocks
  HOMEPAGE_BLOCKS: {
    GET_ALL: "/api/admin/homepage-blocks",
    CREATE: "/api/admin/homepage-blocks",
    UPDATE: (id: number) => `/api/admin/homepage-blocks/${id}`,
    DELETE: (id: number) => `/api/admin/homepage-blocks/${id}`,
    TOGGLE: (id: number) => `/api/admin/homepage-blocks/${id}/toggle`,
    REORDER: "/api/admin/homepage-blocks/reorder",
    REORDER_ITEMS: (id: number) => `/api/admin/homepage-blocks/${id}/items/reorder`,
  },

  // Footer settings
  FOOTER: {
    GET: "/api/footer-settings",
    UPDATE: "/api/footer-settings",
  },
} as const

// Helper function to get endpoint with parameters
export const getEndpoint = (endpoint: string | ((param: any) => string), param?: any): string => {
  if (typeof endpoint === "function") {
    return endpoint(param)
  }
  return endpoint
}
