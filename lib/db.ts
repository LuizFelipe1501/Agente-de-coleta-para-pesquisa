import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!cliente) {
    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) throw new Error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    cliente = createClient(url, chave, { auth: { persistSession: false } });
  }
  return cliente;
}

export function checa<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
