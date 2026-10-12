import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://vbbaasuardhevgudyrxi.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_LZO7dhUojnqVHY_k14Od7w_xIpaL0xC";

if (typeof window !== "undefined") {
  console.log("Supabase URL carregada:", !!SUPABASE_URL, SUPABASE_URL);
  console.log("Supabase Anon Key carregada:", !!SUPABASE_ANON_KEY);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
