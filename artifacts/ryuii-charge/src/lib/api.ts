const SUPA_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://mbrvtkdmwnemvthzrvac.supabase.co";
const SUPA = `${SUPA_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const API = {
  checkNickname:     `${SUPA}/check-nickname`,
  checkout:          `${SUPA}/create-order`,
  repay:             `${SUPA}/repay`,
  adminTransactions: `${SUPA}/admin-transactions`,
};

/** Headers wajib untuk semua request ke Supabase Edge Functions */
export function edgeHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(ANON_KEY ? { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` } : {}),
    ...extra,
  };
}
