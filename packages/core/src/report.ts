import type { AesReportV1, RunRecord } from '@aes/contracts';
import { createId } from './canonical.ts';

const PRIVATE_FIELD = /(secret|token|password|credential|private.?key|authorization|cookie)/i;

export function redactPayload(value: unknown, path = '$', redactions: string[] = []): unknown {
  if (Array.isArray(value)) return value.map((item, index) => redactPayload(item, `${path}[${index}]`, redactions));
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (PRIVATE_FIELD.test(key)) {
      output[key] = '[REDACTED]';
      redactions.push(childPath);
    } else output[key] = redactPayload(child, childPath, redactions);
  }
  return output;
}

export function createPublicReport(run: RunRecord): AesReportV1 {
  if (!run.juryResult) throw new Error('Only completed Research Jury runs can produce a claim report.');
  const sourceById = new Map(run.juryResult.sources.map((source) => [source.id, source]));
  const verdictByClaim = new Map(run.juryResult.verdicts.map((verdict) => [verdict.claimId, verdict]));
  return {
    format: 'aesreport/v1',
    reportId: createId('report'),
    runId: run.id,
    createdAt: new Date().toISOString(),
    title: run.title,
    summary: run.juryResult.briefEn,
    claims: run.juryResult.claims.map((claim) => {
      const verdict = verdictByClaim.get(claim.id);
      return {
        text: claim.text,
        status: verdict?.status ?? 'unresolved',
        citations: claim.sourceIds.flatMap((sourceId) => {
          const source = sourceById.get(sourceId);
          return source ? [{ title: source.title, url: source.url, publisher: source.publisher }] : [];
        }),
      };
    }),
    redactions: [],
  };
}
