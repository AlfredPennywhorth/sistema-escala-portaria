import { spawnSync } from 'node:child_process';

const requiredBranch = 'chore/neon-migration-prep-20261115';
const previewBranch = 'feat/neon-operacional-copilot';
const branch = process.env.CF_PAGES_BRANCH;
if (process.env.CF_PAGES !== '1') {
  console.error('[Homologação] Este comando só pode ser executado no Cloudflare Pages.');
  process.exit(1);
}
if (branch !== requiredBranch && branch !== previewBranch) {
  console.error('[Homologação] Branch não autorizada.');
  process.exit(1);
}

// O preview não pode publicar no hostname canônico. CF_PAGES_URL é a URL
// imutável do deployment fornecida pelo Cloudflare, não um alias de branch.
if (branch === previewBranch && !/^https:\/\/[a-f0-9]+\.rodizio-portaria-neon-hml\.pages\.dev\/?$/.test(process.env.CF_PAGES_URL || '')) {
  console.error('[Homologação] Preview exige URL de deployment isolado do projeto HML.');
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
