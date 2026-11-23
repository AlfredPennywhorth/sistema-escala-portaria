// Verificação local OFFLINE de dumps da origem Supabase.
// Não conecta a bancos, não grava evidências e NUNCA comprova restauração.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_FILES = Object.freeze(['roles.sql', 'schema.sql', 'data.sql']);
const CHUNK_BYTES = 64 * 1024;

// Metadados antes/depois são do MESMO descritor e são comparados com os
// bytes realmente lidos. Mudanças concorrentes devem falhar fechadas.
function metadadosIguais(antes, depois) {
  return antes.isFile() && depois.isFile() &&
    antes.dev === depois.dev && antes.ino === depois.ino &&
    antes.size === depois.size && antes.mtimeNs === depois.mtimeNs &&
    antes.ctimeNs === depois.ctimeNs;
}

/**
 * A função opcional onChunk existe APENAS para simular uma mutação durante a
 * leitura nos testes sintéticos; o CLI nunca fornece esse callback.
 */
export async function hashDescritor(handle, onChunk) {
  const antes = await handle.stat({ bigint: true });
  if (!antes.isFile() || antes.size === 0n) {
    throw new Error('Arquivo vazio ou inválido');
  }
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  let bytes = 0n;
  let blocos = 0;
  while (true) {
    const resultado = await handle.read(buffer, 0, buffer.length, Number(bytes));
    if (resultado.bytesRead === 0) break;
    hash.update(buffer.subarray(0, resultado.bytesRead));
    bytes += BigInt(resultado.bytesRead);
    blocos += 1;
    if (onChunk) await onChunk(blocos);
  }
  const depois = await handle.stat({ bigint: true });
  if (bytes === 0n || bytes !== antes.size || !metadadosIguais(antes, depois)) {
    throw new Error('Arquivo alterado, truncado ou substituído durante a leitura');
  }
  return { bytes: Number(bytes), sha256: hash.digest('hex'), fileStat: depois };
}

/** Resultado sem caminhos completos nem conteúdo do dump. */
export async function verifyBackupFiles(paths) {
  if (!Array.isArray(paths) || paths.length !== EXPECTED_FILES.length ||
      paths.some(path => typeof path !== 'string' || path.trim() === '')) {
    return { export_files_present: false, restorable: false, results: [],
      errors: ['Informe exatamente os três arquivos de dump.'] };
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
    let handle;
    try {
      const fileBefore = await lstat(paths[i], { bigint: true });
      if (!fileBefore.isFile() || fileBefore.isSymbolicLink()) {
        throw new Error('Arquivo não regular');
      }
      // O_NOFOLLOW também barra symlinks inseridos entre lstat e open onde
      // o sistema operacional suporta a flag.
      handle = await open(paths[i], constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const atOpen = await handle.stat({ bigint: true });
      if (!metadadosIguais(fileBefore, atOpen)) {
        throw new Error('Arquivo substituído antes da abertura');
      }
      const { bytes, sha256, fileStat } = await hashDescritor(handle);
      const finalPath = await lstat(paths[i], { bigint: true });
      if (!metadadosIguais(fileStat, finalPath)) {
        throw new Error('Arquivo substituído após leitura');
      }
      results.push({ name, present: true, bytes, sha256 });
    } catch {
      errors.push(name + ': inacessível, vazio ou alterado durante verificação.');
      results.push({ name, present: false });
    } finally {
      if (handle) await handle.close();
    }
  }
  return {
    export_files_present: errors.length === 0,
    restorable: false, // só restauração isolada e reconciliação fecham gate
    results,
    errors,
    next_step: 'Restaurar em PostgreSQL isolado e reconciliar integridade; hash local não autoriza release.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyBackupFiles(process.argv.slice(2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.export_files_present) process.exitCode = 1;
}
