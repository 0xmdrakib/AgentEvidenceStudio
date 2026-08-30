import { describe, expect, it, vi } from 'vitest';
import { runHostedJury } from '../lib/hosted-jury';

const timestamp = '2026-08-29T12:00:00.000Z';
const source = { id: 'source_1', url: 'https://example.com/evidence', title: 'Primary evidence', publisher: 'Example', publishedAt: timestamp, retrievedAt: timestamp, contentDigest: 'a'.repeat(64), excerpt: 'Direct evidence for the bounded claim.' };
const claim = { id: 'claim_1', text: 'A bounded claim.', sourceIds: ['source_1'] };
const outputs = [
  { sources: [source], claims: [claim] },
  { sources: [], counterevidence: [], staleClaims: [], missingEvidence: [] },
  { question: 'Is the claim supported?', briefEn: 'The source supports the claim.', sources: [source], claims: [claim], counterevidence: [], verdicts: [{ claimId: 'claim_1', status: 'supported', rationale: 'The primary source is direct evidence.', sourceIds: ['source_1'] }], unresolvedQuestions: [] },
];

describe('hosted Research Jury', () => {
  it('runs three strict server-side roles without storing provider responses', async () => {
    const requests: any[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new TypeError('Expected a JSON request body.');
      requests.push(JSON.parse(init.body));
      const output = outputs[requests.length - 1];
      return Response.json({ id: `resp_${requests.length}`, model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(output), output: [], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } });
    }) as typeof fetch;
    const run = await runHostedJury({ question: 'Is the bounded claim supported?', userId: 'user_123', apiKey: 'test-key', model: 'gpt-5.6-sol', fetchImpl, now: () => new Date(timestamp) });
    expect(run.state).toBe('completed');
    expect(run.events).toHaveLength(8);
    expect(run.juryResult?.verdicts[0].status).toBe('supported');
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.store).toBe(false);
      expect(request.tools).toEqual([{ type: 'web_search' }]);
      expect(request.text.format.strict).toBe(true);
      expect(request.safety_identifier).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('records bounded failures after both role attempts fail', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: { message: 'provider unavailable' } }, { status: 503 })) as typeof fetch;
    await expect(runHostedJury({ question: 'Why is this provider unavailable?', userId: 'user_123', apiKey: 'test-key', model: 'gpt-5.6-sol', fetchImpl, now: () => new Date(timestamp) })).rejects.toMatchObject({ run: { state: 'failed' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
