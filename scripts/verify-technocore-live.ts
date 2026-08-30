import { randomUUID } from 'node:crypto';
import { canonicalJson, createId } from '@aes/core';
import {
  createTechnocoreNonce,
  generateIdentity,
  signTechnocoreMessage,
  TechnocoreHttpTransport,
  type SignedSummary,
} from '@aes/technocore';

const origin = process.env.AES_TECHNOCORE_ORIGIN ?? 'http://127.0.0.1:18080';
const health = await fetch(`${origin}/healthz`, { redirect: 'manual' });
if (!health.ok || (await health.text()).trim() !== 'ok') throw new Error('Technocore health check failed.');

const identity = await generateIdentity();
const roomId = `d-p-aes-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const namespace = 'room-owners';
const ownerNonce = createTechnocoreNonce();
const ownerValue = identity.did;
const ownerKey = await crypto.subtle.importKey('jwk', identity.privateKey, { name: 'Ed25519' }, false, ['sign']);
const ownerPayload = new TextEncoder().encode(`${namespace}|${roomId}|${ownerNonce}|${ownerValue}`);
const ownerSignature = Buffer.from(await crypto.subtle.sign('Ed25519', ownerKey, ownerPayload)).toString('base64url');
const ownerUrl = new URL(`/kv/${namespace}/${encodeURIComponent(roomId)}/set-signed/${encodeURIComponent(identity.did)}/${ownerSignature}/${ownerNonce}/${encodeURIComponent(ownerValue)}`, origin);
ownerUrl.searchParams.set('if_absent', '1');
const ownerWrite = await fetch(ownerUrl, { redirect: 'manual' });
if (!ownerWrite.ok) throw new Error(`Technocore ownership claim failed: ${ownerWrite.status} ${(await ownerWrite.text()).slice(0, 300)}`);

const storedOwner = await fetch(`${origin}/kv/${namespace}/${encodeURIComponent(roomId)}`, { redirect: 'manual' });
const ownerLines = (await storedOwner.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
if (!storedOwner.ok || ownerLines.at(-1) !== identity.did) throw new Error('Technocore ownership read-back failed.');

const summary: SignedSummary = {
  id: createId('summary'),
  roomId,
  controllerDid: identity.did,
  kind: 'run.completed',
  runId: createId('run'),
  eventDigest: 'a'.repeat(64),
  status: 'completed',
  timestamp: new Date().toISOString(),
  signature: '',
};
const transport = new TechnocoreHttpTransport(origin, identity);
const published = await transport.publish(summary);
if (published.state !== 'acknowledged') throw new Error('Technocore signed summary outcome remained unknown.');
const readBack = await transport.readBack(roomId, summary.id);
if (!readBack || canonicalJson({ ...readBack, signature: '' }) !== canonicalJson({ ...summary, signature: '' })) {
  throw new Error('Technocore signed summary did not round-trip exactly.');
}

const unsigned = await fetch(`${origin}/r/${encodeURIComponent(roomId)}/say/untrusted/should-be-rejected`, { redirect: 'manual' });
if (unsigned.status !== 403) throw new Error(`Owned room accepted an unsigned write with HTTP ${unsigned.status}.`);

const signedProbe = await signTechnocoreMessage(roomId, createTechnocoreNonce(), 'protocol probe', identity.privateKey);
if (signedProbe.signature.length !== 86) throw new Error('Technocore signature encoding is not protocol compatible.');

const rooms = await fetch(`${origin}/rooms?format=json`, { redirect: 'manual' });
if (!rooms.ok) throw new Error('Technocore room listing failed.');
const directory = JSON.stringify(await rooms.json());
if (directory.includes(roomId)) throw new Error('Unlisted Technocore room leaked into the public room directory.');

console.log(JSON.stringify({
  status: 'passed',
  version: '0.9.5',
  image: 'ghcr.io/flop-labs/technocore-chat:0.9.5',
  roomClass: 'owned+unlisted',
  checks: ['health', 'did:key ownership', 'signed write', 'exact read-back', 'unsigned rejection', 'directory privacy'],
}, null, 2));
