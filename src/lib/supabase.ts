import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.error(
    '[Supabase] Variáveis de ambiente ausentes. ' +
    'Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabasePublishableKey || ''
);