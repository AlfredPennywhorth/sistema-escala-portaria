import { spawnSync } from 'node:child_process';

const requiredBranch = 'chore/neon-migration-prep-20261115';
if (process.env.CF_PAGES !== '1') {
  console.error('[Homologação] Este comando só pode ser executado no Cloudflare Pages.');
  process.exit(1);
}
if (process.env.CF_PAGES_BRANCH !== requiredBranch) {
  console.error('[Homologação] Branch incorreta. Esperada: ' + requiredBranch);
  process.exit(1);
}

const env = {
  ...process.env,
  VITE_NEON_HOMOLOGACAO_ENABLED: 'true',
  // O build padrão jamais habilita adaptadores de mutação, mesmo com variável herdada.
  VITE_NEON_SQL06_ENABLED: 'false',
  VITE_NEON_AUTH_URL: 'https://ep-purple-water-b6agr3hn.neonauth.c-2.sa-east-1.aws.neon.tech/rodizio_portas/auth',
  VITE_NEON_DATA_API_URL: 'https://ep-purple-water-b6agr3hn.apirest.c-2.sa-east-1.aws.neon.tech/rodizio_portas/rest/v1',
  // O app legado importa o cliente Supabase, embora o modo de homologação não o utilize.
  // Nunca permitir que a build de testes receba URLs/chaves Supabase reais.
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
};

console.log('[Homologação] Build exclusivamente Neon, branch validada, sem segredos.');
const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
