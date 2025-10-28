// frontend/src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// @ts-ignore (我们先忽略 TS 检查，因为 VITE_SUPABASE_URL 可能是 undefined)
export const supabase = createClient(supabaseUrl, supabaseKey);