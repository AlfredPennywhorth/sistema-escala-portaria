// Release readiness is a separate gate from a green PR CI.
// No secrets, network calls, writes, or production changes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const GATES = [
  'source_inventory',
  'restorable_source_backup',
  'identity_mapping',
  'migration_dry_run_reconciled',
  'direct_dml_and_legacy_rpc_closed',
  'jwt_two_admins_verified',
  'occ_and_locked_history_verified',
  'operational_ui_neon_e2e',
  'rollback_rehearsed',
  'ci_and_review_approved',
  'release_authorized',
];

export function validateReleaseEvidence(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { ready: false, failed: GATES, errors: ['Documento ausente ou inválido'] };
  }
  const errors = [];
  const failed = [];
  for (const gate of GATES) {
    const entry = document.gates?.[gate];
    const verified = entry?.verified === true &&
      typeof entry.evidence === 'string' && entry.evidence.trim().length > 0 &&
      typeof entry.reviewer === 'string' && entry.reviewer.trim().length > 0;
    if (!verified) failed.push(gate);
    if (entry?.verified === true && !verified) {
      errors.push(gate + ': aprovação requer evidência e revisor');
    }
  }
  if (document.environment !== 'production') errors.push('Ambiente de destino deve ser production');
  if (document.target_date !== '2026-11-29') errors.push('Data da janela de publicação inválida');
  return { ready: failed.length === 0 && errors.length === 0, failed, errors };
}

if (process.argv[1] && import.meta.url === new URL('file://' + resolve(process.argv[1])).href) {
  const path = process.argv[2];
  if (!path) {
    console.error('Uso: node scripts/check-neon-release-gates.mjs <arquivo-evidencias.json>');
    process.exitCode = 2;
  } else {
    try {
      const result = validateReleaseEvidence(JSON.parse(readFileSync(path, 'utf8')));
      console.log(JSON.stringify(result, null, 2));
      if (!result.ready) process.exitCode = 1;
    } catch (error) {
      console.error('Go/No-Go indisponível: ' + error.message);
      process.exitCode = 2;
    }
  }
}
