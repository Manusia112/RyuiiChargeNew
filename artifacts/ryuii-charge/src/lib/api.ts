import { supabase } from "./supabase";

const SUPA_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://mbrvtkdmwnemvthzrvac.supabase.co";
const SUPA = `${SUPA_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const API = {
  checkNickname:     `${SUPA}/check-nickname`,
  checkout:          `${SUPA}/create-order`,
  repay:             `${SUPA}/repay`,
  adminTransactions: `${SUPA}/admin-transactions`,
  manageTransaction: `${SUPA}/manage-transaction`,
};

/** Headers wajib untuk semua request ke Supabase Edge Functions */
export function edgeHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(ANON_KEY ? { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` } : {}),
    ...extra,
  };
}

/**
 * Headers untuk endpoint yang butuh identitas user (manage-transaction).
 * Mengirim `Authorization: Bearer <user_jwt>` agar edge function bisa
 * resolve user_id dari `auth.getUser(token)` lalu enforce ownership.
 */
export async function authedEdgeHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  let bearer: string | undefined;
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      bearer = data.session?.access_token ?? undefined;
    }
  } catch (err) {
    console.warn("[api] could not read auth session:", err);
  }
  return {
    "Content-Type": "application/json",
    ...(ANON_KEY ? { "apikey": ANON_KEY } : {}),
    ...(bearer ? { "Authorization": `Bearer ${bearer}` }
               : (ANON_KEY ? { "Authorization": `Bearer ${ANON_KEY}` } : {})),
    ...extra,
  };
}
