import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

/**
 * Cliente Neon para ambiente de homologação.
 * Não é usado pela aplicação publicada até homologação e autorização.
 * Nunca passe DATABASE_URL ou credenciais PostgreSQL para o frontend.
 */
export function criarClienteNeon() {
  const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
  const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

  if (!authUrl || !dataApiUrl) {
    throw new Error('Configure VITE_NEON_AUTH_URL e VITE_NEON_DATA_API_URL para habilitar a homologação Neon');
  }

  return createClient({
    auth: {
      url: authUrl,
      adapter: SupabaseAuthAdapter(),
      allowAnonymous: false,
    },
    dataApi: {
      url: dataApiUrl,
    },
  });
}
