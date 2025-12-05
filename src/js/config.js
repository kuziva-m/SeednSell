// src/js/config.js

export const CONFIG = {
  SUPABASE: {
    // Vite automatically loads variables from .env that start with VITE_
    URL: import.meta.env.VITE_SUPABASE_URL,
    ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  // The official company user ID for "Featured" listings
  COMPANY_USER_ID: "fb874327-31b0-4857-81e2-75f292bc21f6",

  // App-wide settings
  IMAGES: {
    // Default bucket name
    BUCKET: "product_images",
    // Max file size (5MB)
    MAX_SIZE_BYTES: 5 * 1024 * 1024,
    ALLOWED_TYPES: ["image/jpeg", "image/png"],
  },
};
