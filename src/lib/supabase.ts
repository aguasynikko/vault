import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabase = !!(url && anonKey)

if (!hasSupabase) {
  console.warn("Supabase env vars missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY")
}

export const supabase = hasSupabase ? createClient(url!, anonKey!) : (null as unknown as ReturnType<typeof createClient>)