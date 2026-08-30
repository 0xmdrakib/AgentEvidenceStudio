import { describe, expect, it } from 'vitest';
import { assertApproval, createBoundedApproval, generateIdentity, reconcilePublish, signTechnocoreMessage, sweepTechnocoreText, type SignedSummary, type TechnocoreTransport } from '@aes/technocore';

describe('Technocore bounded integration', () => {
  it('generates a protocol-compatible Ed25519 did:key and signature', async () => {
    const identity = await generateIdentity();
    expect(identity.did).toMatch(/^did:key:z6Mk/);
    const signed = await signTechnocoreMessage('d-room', '123456789', '  evidence\nsummary  ', identity.privateKey);
    expect(signed.text).toBe('evidence summary');
    expect(signed.signature).toHaveLength(86);
  });

  it('sweeps invisible single-line characters before signing', () => {
    expect(sweepTechnocoreText('a\u0000b\u202Ec')).toBe('a b c');
  });

  it('caps approvals at eight writes and two hours', async () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    await expect(createBoundedApproval({ roomId: 'd-room', controllerDid: 'did:key:z6MkExample', eventKinds: ['run.completed'], maximumWrites: 9, expiresAt: '2026-08-29T01:00:00.000Z' }, now)).rejects.toThrow(/eight/);
    await expect(createBoundedApproval({ roomId: 'd-room', controllerDid: 'did:key:z6MkExample', eventKinds: ['run.completed'], maximumWrites: 8, expiresAt: '2026-08-29T03:00:00.000Z' }, now)).rejects.toThrow(/two hours/);
  });

  it('invalidates changed scope, expired scope, and exhausted caps', async () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    const approval = await createBoundedApproval({ roomId: 'd-room', controllerDid: 'did:key:z6MkExample', eventKinds: ['run.completed'], maximumWrites: 1, expiresAt: '2026-08-29T01:00:00.000Z' }, now);
    await expect(assertApproval({ ...approval, roomId: 'd-other' }, { roomId: 'd-other', controllerDid: approval.controllerDid, kind: 'run.completed' }, now)).rejects.toThrow(/scope changed/);
    await expect(assertApproval({ ...approval, writesUsed: 1 }, { roomId: approval.roomId, controllerDid: approval.controllerDid, kind: 'run.completed' }, now)).rejects.toThrow(/cap/);
    await expect(assertApproval(approval, { roomId: approval.roomId, controllerDid: approval.controllerDid, kind: 'run.completed' }, new Date('2026-08-29T02:00:00.000Z'))).rejects.toThrow(/expired/);
  });

  it('reconciles an unknown write by exact read-back without retrying', async () => {
    const summary: SignedSummary = { id: 'summary_1', roomId: 'd-room', controllerDid: 'did:key:z6MkExample', kind: 'run.completed', runId: 'run_1', eventDigest: 'a'.repeat(64), status: 'completed', timestamp: '2026-08-29T00:00:00.000Z', signature: '' };
    let publishes = 0;
    const transport: TechnocoreTransport = { async publish() { publishes++; return { state: 'unknown' }; }, async readBack() { return summary; } };
    await expect(reconcilePublish(transport, summary)).resolves.toEqual({ state: 'acknowledged', remoteId: 'summary_1' });
    expect(publishes).toBe(1);
  });
});
