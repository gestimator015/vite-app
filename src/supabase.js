import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl ? supabaseUrl.substring(0, 30) : 'MISSING')
console.log('Supabase Key:', supabaseAnonKey ? 'SET' : 'MISSING')
if (!supabaseUrl || !supabaseAnonKey) { console.error('Missing Supabase environment variables') }

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
