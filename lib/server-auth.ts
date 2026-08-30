import { createRemoteJWKSet, jwtVerify } from 'jose';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function verifyNeonUser(request: Request): Promise<{ userId: string; token: string }> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sign in is required.'), { status: 401 });
  const jwks = createRemoteJWKSet(new URL(required('NEON_AUTH_JWKS_URL')));
  const verified = await jwtVerify(token, jwks, process.env.NEON_AUTH_ISSUER ? { issuer: process.env.NEON_AUTH_ISSUER } : {});
  if (!verified.payload.sub) throw Object.assign(new Error('Authenticated user has no subject.'), { status: 403 });
  return { userId: verified.payload.sub, token };
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const allowed = new Set([process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined].filter(Boolean));
  if (!allowed.has(origin)) throw Object.assign(new Error('Request origin is not allowed.'), { status: 403 });
}
