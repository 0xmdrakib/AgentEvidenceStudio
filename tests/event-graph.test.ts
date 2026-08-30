import { describe, expect, it } from 'vitest';
import type { EvidenceEvent } from '@aes/contracts';
import { analyzeEventGraph } from '@aes/core';

const digest = (letter: string) => letter.repeat(64);
const event = (eventId: string, parentIds: string[] = [], overrides: Partial<EvidenceEvent> = {}): EvidenceEvent => ({
  runId: 'run_1', eventId, kind: 'role.completed', actor: 'researcher', parentIds,
  timestamp: new Date(`2026-08-29T00:00:0${Math.min(eventId.length, 9)}.000Z`).toISOString(), digest: digest('a'), deliveryState: 'local', payload: {}, ...overrides,
});

describe('event graph analysis', () => {
  it('topologically replays a valid causal chain', () => {
    const result = analyzeEventGraph([event('third', ['second']), event('root'), event('second', ['root'])]);
    expect(result.replay.map((item) => item.eventId)).toEqual(['root', 'second', 'third']);
    expect(result.complete).toBe(true);
  });

  it('detects an orphan and incomplete replay', () => {
    const result = analyzeEventGraph([event('child', ['missing'])]);
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: 'orphan' }));
    expect(result.complete).toBe(false);
  });

  it('detects cycles', () => {
    const result = analyzeEventGraph([event('left', ['right']), event('right', ['left'])]);
    expect(result.issues.some((issue) => issue.kind === 'cycle')).toBe(true);
    expect(result.complete).toBe(false);
  });

  it('distinguishes duplicates from conflicting duplicates', () => {
    const duplicate = event('same');
    const result = analyzeEventGraph([duplicate, { ...duplicate }, { ...duplicate, digest: digest('b') }]);
    expect(result.issues.map((issue) => issue.kind)).toEqual(expect.arrayContaining(['duplicate', 'conflicting-result']));
  });

  it('flags delivery gaps, overdue acknowledgement, and unknown outcomes', () => {
    const old = '2026-08-28T00:00:00.000Z';
    const result = analyzeEventGraph([
      event('pending', [], { timestamp: old, deliveryState: 'pending' }),
      event('failed', [], { deliveryState: 'failed' }),
      event('unknown', [], { deliveryState: 'unknown' }),
    ]);
    expect(result.issues.map((issue) => issue.kind)).toEqual(expect.arrayContaining(['missing-acknowledgement', 'transport-gap', 'unknown-write']));
  });
});
