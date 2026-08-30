import { describe, expect, it } from 'vitest';
import { validateJuryResult } from '@aes/core';

const source = { id: 'source_1', url: 'https://example.com/evidence', title: 'Primary evidence', publisher: 'Example', publishedAt: '2026-08-28T00:00:00.000Z', retrievedAt: '2026-08-29T00:00:00.000Z', contentDigest: 'a'.repeat(64), excerpt: 'Bounded source excerpt.' };
const base = { question: 'Is the claim supported?', briefEn: 'The evidence supports the bounded claim.', sources: [source], claims: [{ id: 'claim_1', text: 'A bounded claim.', sourceIds: ['source_1'] }], counterevidence: [], verdicts: [{ claimId: 'claim_1', status: 'supported' as const, rationale: 'The cited primary source directly supports it.', sourceIds: ['source_1'] }], unresolvedQuestions: [] };

describe('Research Jury evidence binding', () => {
  it('accepts a supported, source-bound verdict', () => { expect(validateJuryResult(base).verdicts[0].status).toBe('supported'); });
  it.each(['disputed', 'unresolved'] as const)('accepts an evidence-aware %s verdict', (status) => { expect(validateJuryResult({ ...base, verdicts: [{ ...base.verdicts[0], status }] }).verdicts[0].status).toBe(status); });
  it('rejects supported verdicts based only on agent agreement', () => { expect(() => validateJuryResult({ ...base, verdicts: [{ ...base.verdicts[0], sourceIds: [] }] })).toThrow(/no external evidence/); });
  it('rejects unknown citation bindings', () => { expect(() => validateJuryResult({ ...base, claims: [{ ...base.claims[0], sourceIds: ['missing'] }] })).toThrow(/unknown source/); });
  it('rejects a verdict for an unknown claim', () => { expect(() => validateJuryResult({ ...base, verdicts: [{ ...base.verdicts[0], claimId: 'missing' }] })).toThrow(/unknown claim/); });
});
