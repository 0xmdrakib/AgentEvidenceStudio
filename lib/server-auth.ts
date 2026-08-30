import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksUrl: string | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function verifyNeonUser(
  request: Request,
): Promise<{ userId: string; token: string }> {
  const token = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');
  if (!token)
    throw Object.assign(new Error('Sign in is required.'), { status: 401 });
  const configuredUrl = required('NEON_AUTH_JWKS_URL');
  if (!jwks || jwksUrl !== configuredUrl) {
    jwks = createRemoteJWKSet(new URL(configuredUrl));
    jwksUrl = configuredUrl;
  }
  const verified = await jwtVerify(token, jwks, {
    ...(process.env.NEON_AUTH_ISSUER
      ? { issuer: process.env.NEON_AUTH_ISSUER }
      : {}),
    clockTolerance: 5,
    requiredClaims: ['sub', 'iat', 'exp'],
  });
  if (!verified.payload.sub)
    throw Object.assign(new Error('Authenticated user has no subject.'), {
      status: 403,
    });
  const hasControlCharacter = [...verified.payload.sub].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (verified.payload.sub.length > 160 || hasControlCharacter)
    throw Object.assign(new Error('Authenticated user subject is invalid.'), {
      status: 403,
    });
  return { userId: verified.payload.sub, token };
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin)
    throw Object.assign(new Error('Request origin is required.'), {
      status: 403,
    });
  const normalizeOrigin = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    try {
      return new URL(value).origin;
    } catch {
      return undefined;
    }
  };
  const allowed = new Set(
    [
      normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      process.env.NODE_ENV !== 'production'
        ? 'http://localhost:3000'
        : undefined,
    ].filter(Boolean),
  );
  if (!allowed.has(normalizeOrigin(origin)))
    throw Object.assign(new Error('Request origin is not allowed.'), {
      status: 403,
    });
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site')
    throw Object.assign(new Error('Cross-site request is not allowed.'), {
      status: 403,
    });
}

export function assertJsonRequest(request: Request): void {
  const contentType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== 'application/json')
    throw Object.assign(new Error('Content-Type must be application/json.'), {
      status: 415,
    });
}
