import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './env';

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

export function getSupabaseClient(): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey);
}
