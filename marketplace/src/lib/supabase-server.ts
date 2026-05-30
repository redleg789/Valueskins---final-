import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vmmnihicgqtaestbdrkw.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(`Missing Supabase credentials: url=${!!supabaseUrl}, key=${!!supabaseKey}`);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
