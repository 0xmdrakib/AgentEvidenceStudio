import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyNeonUser } from '../lib/server-auth';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('member JWT verification for usage reads', () => {
  it('requires the exact signed member issuer and never logs the token or member identity', async () => {
    const origin = 'https://member-auth.example';
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const key = {
      ...(await exportJWK(publicKey)),
      kid: 'test-member-key',
      alg: 'RS256',
      use: 'sig',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [key] })),
    );
    vi.stubEnv('NEON_AUTH_JWKS_URL', origin + '/jwks');
    vi.stubEnv('NEON_AUTH_ISSUER', origin + '/neondb/auth');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: key.kid })
      .setSubject('private-member-id')
      .setIssuer(origin)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const request = new Request('https://app.example/api/runner?usage=1', {
      headers: { authorization: `Bearer ${token}` },
    });
    // Anonymous-token or base URLs cannot substitute for the member's issuer.
    await expect(verifyNeonUser(request)).rejects.toMatchObject({
      status: 401,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"issuerForm":"origin-only"'),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(token);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-member-id');

    vi.stubEnv('NEON_AUTH_ISSUER', origin);
    await expect(verifyNeonUser(request)).resolves.toEqual({
      userId: 'private-member-id',
      token,
    });
    // Even a trusted signing key does not make a different issuer acceptable.
    const otherToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: key.kid })
      .setSubject('private-member-id')
      .setIssuer('https://other.example')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(
      verifyNeonUser(
        new Request(request.url, {
          headers: { authorization: `Bearer ${otherToken}` },
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('requires sign-in before retrieving verification keys', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      verifyNeonUser(new Request('https://app.example/api/runner?usage=1')),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
