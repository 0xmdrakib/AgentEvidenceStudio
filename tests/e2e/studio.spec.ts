import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await expect(page.locator('[data-app-hydrated="true"]')).toBeVisible();
}

test('workspace is English-only and exposes the hosted primary flow', async ({ page }) => {
  await page.route('**/api/runner', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', mode: 'hosted', configured: true, model: 'gpt-5.6-sol' }) }));
  await page.goto('/'); await ready(page);
  await expect(page.getByRole('heading', { name: 'See, merge, and verify every agent decision.' })).toBeVisible();
  await expect(page.getByText(/Secure hosted execution works from any browser/)).toBeVisible();
  await expect(page.getByText('বাংলা')).toHaveCount(0);
  await expect(page.getByText(/Local runner required/i)).toHaveCount(0);
  await expect(page.locator('img[src="/brand/agent-evidence-logo.svg"]').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: /flight recorder/i })).toBeVisible();
});

test('navigation reaches every primary module', async ({ page, isMobile }) => {
  await page.route('**/api/runner', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', mode: 'hosted', configured: true, model: 'gpt-5.6-sol' }) }));
  await page.goto('/'); await ready(page);
  const openModule = async (name: string) => {
    if (isMobile) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect.poll(async () => Math.round((await page.locator('aside').boundingBox())?.x ?? -999)).toBe(0);
    }
    await page.getByRole('link', { name }).first().click();
  };
  await openModule('Flight Recorder'); await expect(page.getByRole('heading', { name: 'Flight Recorder' })).toBeVisible();
  await openModule('MemoryMerge'); await expect(page.getByRole('heading', { name: 'MemoryMerge' })).toBeVisible();
  await openModule('Research Jury'); await expect(page.getByRole('heading', { name: 'Research Jury' })).toBeVisible();
});

test('mobile navigation has a 44px touch target and opens on-screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport only');
  await page.route('**/api/runner', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', mode: 'hosted', configured: true, model: 'gpt-5.6-sol' }) }));
  await page.goto('/'); await ready(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  expect((await menu.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await menu.click();
  await expect.poll(async () => Math.round((await page.locator('aside').boundingBox())?.x ?? -999)).toBe(0);
});

test('hosted member workflow covers Jury, replay, encryption, merge, and bounded approval', async ({ page, isMobile }) => {
  test.skip(isMobile, 'validated once on the desktop product surface');
  const runId = `run_${'c'.repeat(32)}`;
  const timestamp = '2026-08-29T12:00:00.000Z';
  const source = { id: 'source_1', url: 'https://github.com/flop-labs/technocore-chat', title: 'technocore-chat', publisher: 'FLOP Labs', publishedAt: timestamp, retrievedAt: timestamp, contentDigest: 'a'.repeat(64), excerpt: 'The documented protocol supports signed room messages.' };
  const claim = { id: 'claim_1', text: 'The protocol supports signed messages.', sourceIds: ['source_1'] };
  const eventKinds = ['run.started', 'role.started', 'role.completed', 'role.started', 'role.completed', 'role.started', 'role.completed', 'run.completed'];
  const events = eventKinds.map((kind, index) => ({ runId, eventId: `evt_${index + 1}`, kind, actor: index === 0 || index === 7 ? 'controller' : index < 3 ? 'researcher' : index < 5 ? 'challenger' : 'adjudicator', parentIds: index ? [`evt_${index}`] : [], timestamp, digest: String(index + 1).padStart(64, '0'), deliveryState: 'acknowledged', payload: { value: { step: index + 1 }, redactions: [] } }));
  const run = { id: runId, title: 'Hosted evidence acceptance run', module: 'jury', state: 'completed', createdAt: timestamp, updatedAt: timestamp, providerId: 'provider_hosted_responses', events, juryResult: { question: 'Does the protocol support signed messages?', briefEn: 'The source supports the bounded claim.', sources: [source], claims: [claim], counterevidence: [], verdicts: [{ claimId: 'claim_1', status: 'supported', rationale: 'The protocol documentation is direct evidence.', sourceIds: ['source_1'] }], unresolvedQuestions: [] } };
  await page.route('**/api/runner', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', mode: 'hosted', configured: true, model: 'gpt-5.6-sol' }) });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ run, usage: { used: 1, limit: 5 } }) });
  });

  await page.goto('/jury/new'); await ready(page);
  await page.getByLabel('What should the jury investigate?').fill('Does the protocol support signed messages and what are its limits?');
  await page.getByLabel('Hosted provider').click();
  await page.getByRole('option', { name: /Hosted Research Jury/ }).click();
  await page.getByRole('button', { name: 'Start hosted jury' }).click();
  await expect(page).toHaveURL(new RegExp(`/jury/${runId}`));
  await expect(page.getByText('supported', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Flight Recorder' }).first().click();
  await page.getByRole('link', { name: /Hosted evidence acceptance run/ }).click();
  await expect(page).toHaveURL(new RegExp(`/recorder/${runId}$`), { timeout: 15_000 });
  await expect(page.getByText('The stored causal chain can be replayed completely.')).toBeVisible();
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(page.getByText('Step 2 of 8')).toBeVisible();

  const exportDirectory = join(tmpdir(), `aes-hosted-e2e-${process.pid}`);
  const downloads: import('@playwright/test').Download[] = [];
  page.on('download', (download) => downloads.push(download));
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByLabel('Passphrase (12+ characters)').fill('hosted-e2e-passphrase');
  await page.getByRole('button', { name: 'Download recovery kit and bundle' }).click();
  await expect.poll(() => downloads.length).toBe(2);
  const bundle = downloads.find((download) => download.suggestedFilename().endsWith('.aesrun'))!;
  const bundlePath = join(exportDirectory, bundle.suggestedFilename()); await bundle.saveAs(bundlePath);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: 'Flight Recorder' }).first().click();
  await page.getByRole('button', { name: 'Import .aesrun' }).filter({ visible: true }).first().click();
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Choose .aesrun bundle' }).click();
  await (await chooser).setFiles(bundlePath); await page.getByLabel('Workspace passphrase').fill('hosted-e2e-passphrase');
  await page.getByRole('button', { name: 'Unlock bundle' }).click();

  await page.getByRole('link', { name: 'Reports' }).first().click();
  await page.getByRole('button', { name: 'Redaction preview' }).click(); await expect(page.getByText('aesreport/v1', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'MemoryMerge' }).first().click();
  await page.getByLabel('Base').fill('{"status":"draft"}'); await page.getByLabel('Left').fill('{"status":"approved"}'); await page.getByLabel('Right').fill('{"status":"rejected"}');
  await page.getByRole('button', { name: 'Compare and merge' }).click(); await expect(page.getByText('1 competing change')).toBeVisible();
  await page.getByText('Choose resolution').click(); await page.getByRole('option', { name: 'Keep left' }).click(); await page.getByRole('button', { name: 'Resolve every conflict' }).click();
  await expect(page.getByText('Canonical head is clear')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).first().click();
  await expect(page.getByText('No localhost or PC availability dependency')).toBeVisible();
  await page.getByLabel('Owned room').fill('d-p-e2e-owned-room'); await page.getByLabel('Controller DID').fill('did:key:z6MkE2EAcceptanceController');
  await page.getByText('I approve only this exact scope. Any field change invalidates it.').click(); await page.getByRole('button', { name: 'Create bounded approval' }).click();
  await expect(page.getByText(/Exact scope approved until/)).toBeVisible();
  await rm(exportDirectory, { recursive: true, force: true });
});
