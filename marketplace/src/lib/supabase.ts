import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase env vars not set');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Backward-compat alias — only call from client components
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});

export interface InterestSignupRow {
  id?: number;
  instagram_handle: string;
  email: string;
  name: string;
  reason_for_interest: string;
  primary_profession: string;
  target_annual_income_usd: number;
  preferred_platforms: string[];
  has_existing_audience: boolean;
  estimated_follower_count: number;
  status?: 'pending' | 'contacted' | 'converted_user' | 'rejected';
  admin_notes?: string | null;
  contacted_at?: string | null;
  converted_user_id?: number | null;
  created_at?: string;
}
