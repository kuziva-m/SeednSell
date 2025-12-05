import { CONFIG } from "./config.js";

// We utilize the global 'supabase' object provided by the CDN script in HTML
// Ensure your HTML files include the Supabase CDN script before this module loads
const { createClient } = supabase;

export const sb = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);
