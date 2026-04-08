import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url === "undefined") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  return url.trim();
}

function getAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || key === "undefined") {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }
  return key.trim();
}

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(getUrl(), getAnonKey());
  }
  return _supabase;
}

export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(
    getUrl(),
    serviceKey ? serviceKey.trim() : getAnonKey()
  );
}
