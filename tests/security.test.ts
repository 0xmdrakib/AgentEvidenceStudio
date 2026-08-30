import { afterEach, describe, expect, it } from 'vitest';
import { assertJsonRequest, assertTrustedOrigin } from '../lib/server-auth.ts';
import {
  DEFAULT_ACCOUNT_LIMITS,
  getGoogleSignInHref,
  isNeonSignInRequiredError,
  NeonSignInRequiredError,
} from '../lib/neon.ts';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('hosted request boundary', () => {
  it('accepts the configured same-origin JSON request', () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      'https://agentevidencestudio.rakibhq.xyz';
    const request = new Request(
      'https://agentevidencestudio.rakibhq.xyz/api/runner',
      {
        method: 'POST',
        headers: {
          origin: 'https://agentevidencestudio.rakibhq.xyz',
          'content-type': 'application/json',
          'sec-fetch-site': 'same-origin',
        },
      },
    );
    expect(() => assertTrustedOrigin(request)).not.toThrow();
    expect(() => assertJsonRequest(request)).not.toThrow();
  });

  it('rejects missing, untrusted, and cross-site origins', () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      'https://agentevidencestudio.rakibhq.xyz';
    expect(() =>
      assertTrustedOrigin(
        new Request('https://example.com/api/runner', { method: 'POST' }),
      ),
    ).toThrow(/origin is required/i);
    expect(() =>
      assertTrustedOrigin(
        new Request('https://example.com/api/runner', {
          method: 'POST',
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toThrow(/not allowed/i);
    expect(() =>
      assertTrustedOrigin(
        new Request('https://example.com/api/runner', {
          method: 'POST',
          headers: {
            origin: 'https://agentevidencestudio.rakibhq.xyz',
            'sec-fetch-site': 'cross-site',
          },
        }),
      ),
    ).toThrow(/cross-site/i);
  });

  it('rejects non-JSON mutations and keeps the member plan intentionally small', () => {
    expect(() =>
      assertJsonRequest(
        new Request('https://example.com/api/runner', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
        }),
      ),
    ).toThrow(/application\/json/i);
    expect(DEFAULT_ACCOUNT_LIMITS).toEqual({
      storageBytes: 10_485_760,
      bundleBytes: 524_288,
      reportBytes: 262_144,
      versions: 100,
      reports: 20,
      dailyCloudWrites: 50,
      dailyHostedRuns: 5,
    });
  });

  it('keeps browsing public and sends protected actions back to their route', () => {
    expect(getGoogleSignInHref('/jury/new?mode=hosted')).toBe(
      '/auth?next=%2Fjury%2Fnew%3Fmode%3Dhosted',
    );
    expect(getGoogleSignInHref('https://evil.example')).toBe(
      '/auth?next=%2F',
    );
    expect(isNeonSignInRequiredError(new NeonSignInRequiredError())).toBe(
      true,
    );
  });
});
