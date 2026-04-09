import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Singleton pattern: satu instance untuk seluruh lifetime aplikasi.
// Mencegah error "Lock auth-token was released because another request stole it"
// yang terjadi ketika ada lebih dari satu client mengakses token yang sama di localStorage.
let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (_client) return _client;

  _client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Storage key unik agar tidak konflik jika buka beberapa app Supabase
      storageKey: "ryuiicharge-auth",
    },
  });

  return _client;
}

export const supabase = getSupabaseClient();

export type { SupabaseClient } from "@supabase/supabase-js";
