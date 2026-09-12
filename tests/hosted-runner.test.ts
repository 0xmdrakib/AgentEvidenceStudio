import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  reserve: vi.fn(),
  finish: vi.fn(),
  usage: vi.fn(),
  sources: vi.fn(),
  jury: vi.fn(),
  search: vi.fn(),
}));
vi.mock('../lib/server-auth.ts', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('../lib/server-auth.ts')>()),
  verifyNeonUser: mocks.verify,
}));
vi.mock('../lib/hosted-usage.ts', () => ({
  reserveHostedRun: mocks.reserve,
  finishHostedRun: mocks.finish,
  getHostedUsage: mocks.usage,
}));
vi.mock('../lib/research-sources.ts', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('../lib/research-sources.ts')>()),
  collectResearchSources: mocks.sources,
}));
vi.mock('../lib/hosted-jury.ts', () => ({ runHostedJury: mocks.jury }));
vi.mock('../lib/research-search.ts', () => ({
  discoverResearchSources: mocks.search,
}));
import { hostedRunnerHandler } from '../lib/hosted-runner-handler';
import { AiRequestError } from '../lib/ai-policy';

const site = 'https://agentevidence.rakibhq.xyz';
const input = {
  action: 'jury.run',
  question: 'Does the evidence support this claim?',
  sourceUrls: ['https://example.com/evidence'],
  requestId: '5c4d3e2f-1a00-4000-8000-000000000001',
};
function request(body: unknown = input, headers = {}) {
  return new Request(site + '/api/runner', {
    method: 'POST',
    headers: {
      origin: site,
      'content-type': 'application/json',
      authorization: 'Bearer test',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', site);
  vi.stubEnv('AI_API_KEY', 'server-secret');
  vi.stubEnv('AI_MODEL', 'provider/deepseek-model');
  vi.stubEnv('AI_BASE_URL', 'https://provider.example/v1');
  mocks.verify.mockResolvedValue({ userId: 'verified-owner', token: 'test' });
  mocks.reserve.mockResolvedValue({ usedToday: 1, dailyLimit: 2 });
  mocks.finish.mockResolvedValue(undefined);
  mocks.sources.mockResolvedValue([]);
  mocks.jury.mockResolvedValue({ id: 'run_test', state: 'completed' });
});
afterEach(() => vi.unstubAllEnvs());

describe('research API authorization and dispatch', () => {
  it('returns only the verified account’s usage without consuming a run or requiring an AI key', async () => {
    vi.stubEnv('AI_API_KEY', '');
    const usage = {
      usedToday: 1,
      usedThisMonth: 4,
      dailyLimit: 2,
      monthlyLimit: 10,
      dailyResetAt: '2026-09-13T00:00:00Z',
      monthlyResetAt: '2026-10-01T00:00:00Z',
    };
    mocks.usage.mockResolvedValue(usage);
    const response = await hostedRunnerHandler.fetch(
      new Request(site + '/api/runner?usage=1&userId=someone-else', {
        headers: { authorization: 'Bearer test' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ usage });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.usage).toHaveBeenCalledExactlyOnceWith('verified-owner');
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.jury).not.toHaveBeenCalled();
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it('does not fabricate zero usage when the allowance store is unavailable', async () => {
    mocks.usage.mockRejectedValue(
      new AiRequestError('Allowance temporarily unavailable.', 503),
    );
    const response = await hostedRunnerHandler.fetch(
      new Request(site + '/api/runner?usage=1', {
        headers: { authorization: 'Bearer test' },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('usage');
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it('requires sign-in before quota, source fetching, or provider work', async () => {
    mocks.verify.mockRejectedValue(
      Object.assign(new Error('Sign in required.'), { status: 401 }),
    );
    expect((await hostedRunnerHandler.fetch(request())).status).toBe(401);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.sources).not.toHaveBeenCalled();
    expect(mocks.jury).not.toHaveBeenCalled();
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests and request-supplied credentials, URLs, models, or chat messages', async () => {
    expect(
      (
        await hostedRunnerHandler.fetch(
          request(input, { origin: 'https://evil.example' }),
        )
      ).status,
    ).toBe(403);
    for (const key of [
      'model',
      'baseUrl',
      'apiKey',
      'messages',
      'max_tokens',
      'userId',
      'tools',
      'searchQueries',
    ]) {
      expect(
        (
          await hostedRunnerHandler.fetch(
            request({ ...input, [key]: 'attack' }),
          )
        ).status,
      ).toBe(422);
    }
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.jury).not.toHaveBeenCalled();
  });
  it('makes no external call when configuration or atomic quota checks fail', async () => {
    vi.stubEnv('AI_API_KEY', '');
    expect((await hostedRunnerHandler.fetch(request())).status).toBe(503);
    expect(mocks.reserve).not.toHaveBeenCalled();
    vi.stubEnv('AI_API_KEY', 'server-secret');
    mocks.reserve.mockRejectedValue(
      new AiRequestError('Limit reached.', 429, 60),
    );
    const response = await hostedRunnerHandler.fetch(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(mocks.sources).not.toHaveBeenCalled();
    expect(mocks.jury).not.toHaveBeenCalled();
  });
  it('accepts only bounded research and reserves the verified identity before dispatch', async () => {
    expect((await hostedRunnerHandler.fetch(request())).status).toBe(201);
    expect(mocks.reserve).toHaveBeenCalledWith(
      'verified-owner',
      expect.any(String),
      input.requestId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(mocks.jury).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'verified-owner',
        config: expect.objectContaining({ model: 'provider/deepseek-model' }),
      }),
    );
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.any(String),
      'verified-owner',
      'completed',
      { calls: 0, inputTokens: 0, outputTokens: 0 },
    );
  });
  it('retains failed reservations and never leaks unexpected upstream errors', async () => {
    mocks.jury.mockRejectedValue(
      new Error('server-secret postgres://credentials'),
    );
    const response = await hostedRunnerHandler.fetch(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('server-secret');
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.any(String),
      'verified-owner',
      'failed',
      expect.any(Object),
    );
  });
  it.each([
    'https://ai-gateway.vercel.sh/v1',
    'https://api.deepseek.com',
    'https://api.deepseek.com/v1',
  ])(
    'reserves quota before search with %s and shares the call budget',
    async (baseUrl) => {
      vi.stubEnv('AI_BASE_URL', baseUrl);
      const searchUsage = { calls: 1, inputTokens: 120, outputTokens: 50 };
      mocks.search.mockImplementation(async ({ onUsage }) => {
        onUsage(searchUsage);
        return ['https://example.com/discovered'];
      });
      const response = await hostedRunnerHandler.fetch(
        request({ ...input, sourceUrls: [] }),
      );
      expect(response.status).toBe(201);
      expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.search.mock.invocationCallOrder[0],
      );
      expect(mocks.sources).toHaveBeenCalledWith(
        ['https://example.com/discovered'],
        expect.any(AbortSignal),
        input.question,
        true,
      );
      expect(mocks.jury).toHaveBeenCalledWith(
        expect.objectContaining({ initialUsage: searchUsage }),
      );
      mocks.search.mockClear();
      mocks.reserve.mockRejectedValue(
        new AiRequestError('Limit reached.', 429),
      );
      expect(
        (await hostedRunnerHandler.fetch(request({ ...input, sourceUrls: [] })))
          .status,
      ).toBe(429);
      expect(mocks.search).not.toHaveBeenCalled();
    },
  );
  it.each(['https://ai-gateway.vercel.sh/v1', 'https://api.deepseek.com'])(
    'keeps explicit-source mode free of search with %s and rejects unsupported search before quota',
    async (baseUrl) => {
      expect(
        (await hostedRunnerHandler.fetch(request({ ...input, sourceUrls: [] })))
          .status,
      ).toBe(422);
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(mocks.search).not.toHaveBeenCalled();
      vi.stubEnv('AI_BASE_URL', baseUrl);
      expect((await hostedRunnerHandler.fetch(request())).status).toBe(201);
      expect(mocks.search).not.toHaveBeenCalled();
      expect(mocks.sources).toHaveBeenCalledWith(
        input.sourceUrls,
        expect.any(AbortSignal),
        input.question,
        false,
      );
    },
  );
  it.each(['https://ai-gateway.vercel.sh/v1', 'https://api.deepseek.com'])(
    'does not search anonymously or retry a failed search with %s',
    async (baseUrl) => {
      vi.stubEnv('AI_BASE_URL', baseUrl);
      mocks.verify.mockRejectedValueOnce(
        Object.assign(new Error('Sign in required.'), { status: 401 }),
      );
      expect(
        (await hostedRunnerHandler.fetch(request({ ...input, sourceUrls: [] })))
          .status,
      ).toBe(401);
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(mocks.search).not.toHaveBeenCalled();
      const searchUsage = { calls: 1, inputTokens: 14_336, outputTokens: 512 };
      mocks.search.mockImplementation(async ({ onUsage }) => {
        onUsage(searchUsage);
        throw new AiRequestError('Search unavailable.', 502);
      });
      expect(
        (await hostedRunnerHandler.fetch(request({ ...input, sourceUrls: [] })))
          .status,
      ).toBe(502);
      expect(mocks.search).toHaveBeenCalledOnce();
      expect(mocks.sources).not.toHaveBeenCalled();
      expect(mocks.jury).not.toHaveBeenCalled();
      expect(mocks.finish).toHaveBeenCalledWith(
        expect.any(String),
        'verified-owner',
        'failed',
        searchUsage,
      );
    },
  );
  it.each([
    'https://api.deepseek.com',
    'https://api.deepseek.com/v1',
    'https://ai-gateway.vercel.sh/v1',
  ])(
    'advertises search for configured supported base %s without exposing credentials',
    async (baseUrl) => {
      vi.stubEnv('AI_BASE_URL', baseUrl);
      vi.stubEnv('DATABASE_URL', 'test-db');
      vi.stubEnv('NEON_AUTH_JWKS_URL', 'https://auth.example/jwks');
      vi.stubEnv('NEON_AUTH_ISSUER', 'https://auth.example');
      const response = await hostedRunnerHandler.fetch(
        new Request(site + '/api/runner'),
      );
      const body = await response.json();
      expect(body.webSearch).toBe(true);
      expect(body.configured).toBe(true);
      expect(JSON.stringify(body)).not.toContain('server-secret');
      expect(JSON.stringify(body)).not.toContain(baseUrl);
    },
  );
  it('bounds request bytes and rejects unsupported methods', async () => {
    expect(
      (
        await hostedRunnerHandler.fetch(
          request({ ...input, question: 'x'.repeat(9_000) }),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await hostedRunnerHandler.fetch(
          new Request(site + '/api/runner', { method: 'PUT' }),
        )
      ).status,
    ).toBe(405);
    expect(mocks.jury).not.toHaveBeenCalled();
  });
  it('protects usage reads and never returns provider credentials in public status', async () => {
    const response = await hostedRunnerHandler.fetch(
      new Request(site + '/api/runner'),
    );
    expect(await response.text()).not.toMatch(/server-secret|provider.example/);
    mocks.verify.mockRejectedValue(
      Object.assign(new Error('Sign in required.'), { status: 401 }),
    );
    expect(
      (
        await hostedRunnerHandler.fetch(
          new Request(site + '/api/runner?usage=1'),
        )
      ).status,
    ).toBe(401);
    expect(mocks.usage).not.toHaveBeenCalled();
  });
});
