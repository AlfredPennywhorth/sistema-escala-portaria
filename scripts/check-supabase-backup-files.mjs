// Verificacao local OFFLINE de arquivos de dump da origem Supabase.
// Nao abre conexoes, nao executa SQL, nao escreve evidencias e NAO atesta restauração.
// Executar apenas no computador autorizado e guardar a saida em local privado.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_FILES = Object.freeze(['roles.sql', 'schema.sql', 'data.sql']);

async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Sem conteúdo de dumps, nomes de caminhos completos ou segredos no resultado. */
export async function verifyBackupFiles(paths) {
  if (!Array.isArray(paths) || paths.length !== EXPECTED_FILES.length ||
      paths.some(path => typeof path !== 'string' || path.trim() === '')) {
    return { export_files_present: false, restorable: false,
      results: [], errors: ['Informe exatamente os três arquivos de dump.'] };
  }

  const names = paths.map(path => path.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase());
  if (EXPECTED_FILES.some((expected, i) => names[i] !== expected)) {
    return { export_files_present: false, restorable: false, results: [],
      errors: ['Ordem obrigatória: roles.sql, schema.sql, data.sql.'] };
  }

  const results = [];
  const errors = [];
  for (let i = 0; i < paths.length; i += 1) {
    const name = EXPECTED_FILES[i];
    try {
      const information = await stat(paths[i]);
      if (!information.isFile() || information.size === 0) {
        errors.push(name + ': arquivo vazio ou inválido.');
        results.push({ name, present: false });
        continue;
      }
      const sha256 = await digest(paths[i]);
      results.push({ name, present: true, bytes: information.size, sha256 });
    } catch {
      errors.push(name + ': não foi possível ler ou calcular hash.');
      results.push({ name, present: false });
    }
  }
  return {
    export_files_present: errors.length === 0,
    restorable: false, // apenas restauracao isolada + reconciliacao atestam isto
    results,
    errors,
    next_step: 'Validar restauração em PostgreSQL isolado e reconciliar integridade; NÃO usar estes hashes como autorização de release.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyBackupFiles(process.argv.slice(2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.export_files_present) process.exitCode = 1;
}
