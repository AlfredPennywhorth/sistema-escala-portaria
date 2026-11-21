import test from 'node:test';
import assert from 'node:assert/strict';
import { GATES, validateReleaseEvidence } from '../scripts/check-neon-release-gates.mjs';

const evidence = () => ({
  environment: 'production',
  target_date: '2026-11-29',
  gates: Object.fromEntries(GATES.map(gate => [gate, {
    verified: true, evidence: 'reconciliation/report/' + gate,
    reviewer: 'independent-reviewer',
  }])),
});

test('release gate refuses an empty or incomplete evidence record', () => {
  assert.equal(validateReleaseEvidence({}).ready, false);
  assert.equal(validateReleaseEvidence(null).ready, false);
  assert.ok(validateReleaseEvidence({}).failed.includes('restorable_source_backup'));
});

test('release gate requires explicit independent traceability for every gate', () => {
  const doc = evidence();
  doc.gates.release_authorized.evidence = '';
  assert.equal(validateReleaseEvidence(doc).ready, false);
  assert.match(validateReleaseEvidence(doc).errors.join(' '), /release_authorized/);
  doc.gates.release_authorized.evidence = 'approval/ticket';
  doc.gates.direct_dml_and_legacy_rpc_closed.verified = false;
  assert.ok(validateReleaseEvidence(doc).failed.includes('direct_dml_and_legacy_rpc_closed'));
});

test('release gate rejects wrong environment and date', () => {
  const doc = evidence();
  doc.environment = 'homologacao';
  doc.target_date = '2026-11-28';
  assert.equal(validateReleaseEvidence(doc).ready, false);
  assert.equal(validateReleaseEvidence(doc).errors.length, 2);
});

test('release gate only accepts complete, corroborated declarations', () => {
  assert.equal(validateReleaseEvidence(evidence()).ready, true);
});
