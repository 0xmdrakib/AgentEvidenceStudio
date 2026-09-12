import { describe, expect, it, vi } from 'vitest';
import { runHostedJury } from '../lib/hosted-jury';
import { getAiConfig } from '../lib/ai-config';
import { AI_LIMITS } from '../lib/ai-policy';
import {
  isPublicIpv4,
  sourceFromPage,
  validateSourceUrl,
} from '../lib/research-sources';

const timestamp = '2026-09-12T12:00:00.000Z';
const source = {
  id: 'source_1',
  url: 'https://example.com/evidence',
  title: 'Primary evidence',
  publisher: 'Example',
  publishedAt: null,
  retrievedAt: timestamp,
  contentDigest: 'a'.repeat(64),
  excerpt: 'Direct evidence for the bounded claim.',
};
const claim = {
  id: 'claim_1',
  text: 'A bounded claim.',
  sourceIds: ['source_1'],
};
const outputs = [
  { claims: [claim] },
  { counterevidence: [], staleClaims: [], missingEvidence: [] },
  {
    briefEn: 'The source supports the claim.',
    verdicts: [
      {
        claimId: 'claim_1',
        status: 'supported',
        rationale: 'The excerpt supports the claim.',
        sourceIds: ['source_1'],
      },
    ],
    unresolvedQuestions: [],
  },
];
const config = getAiConfig({
  AI_API_KEY: 'test-key',
  AI_BASE_URL: 'https://api.deepseek.com',
  AI_MODEL: 'deepseek-flash',
});
const baseOptions = {
  question: 'Is the bounded claim supported?',
  userId: 'user_123',
  config,
  sources: [source],
  now: () => new Date(timestamp),
};

function replies(values: unknown[]) {
  const requests: Array<{ url: unknown; body: any; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
    if (typeof init?.body !== 'string') throw new Error('Expected JSON body.');
    requests.push({ url, body: JSON.parse(init.body), init });
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify(values[requests.length - 1]) },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

describe('bounded provider-independent Research Jury', () => {
  it('uses the administrator configuration and executes three short roles with canonical source records', async () => {
    const { fetchImpl, requests } = replies(outputs);
    const onUsage = vi.fn();
    const run = await runHostedJury({ ...baseOptions, fetchImpl, onUsage });
    expect(run.state).toBe('completed');
    expect(run.events).toHaveLength(8);
    expect(run.juryResult?.sources).toEqual([source]);
    expect(run.juryResult?.verdicts[0].status).toBe('supported');
    expect(requests).toHaveLength(3);
    for (const [index, request] of requests.entries()) {
      expect(request.url).toBe('https://api.deepseek.com/chat/completions');
      expect(request.body.model).toBe('deepseek-flash');
      expect(request.body.max_tokens).toBe([1_024, 1_024, 1_536][index]);
      expect(request.body.thinking).toEqual({ type: 'disabled' });
      expect(request.body.tools).toBeUndefined();
      expect(request.body.response_format).toEqual({ type: 'json_object' });
      expect(request.body.user_id).toMatch(/^[a-f0-9]{64}$/);
      expect(request.init?.redirect).toBe('error');
    }
    expect(requests[0].body.messages.slice(0, 2)).toEqual(
      requests[1].body.messages.slice(0, 2),
    );
    expect(requests[1].body.messages.slice(0, 2)).toEqual(
      requests[2].body.messages.slice(0, 2),
    );
    expect(JSON.stringify(requests[0].body.messages)).not.toContain(
      source.contentDigest,
    );
    expect(JSON.stringify(requests[0].body.messages)).toContain(
      source.publisher,
    );
    expect(onUsage).toHaveBeenLastCalledWith({
      calls: 3,
      inputTokens: 300,
      outputTokens: 150,
    });
  });

  it('supports third-party model IDs and base paths without forwarding DeepSeek-specific options', async () => {
    const { fetchImpl, requests } = replies(outputs);
    await runHostedJury({
      ...baseOptions,
      config: getAiConfig({
        AI_API_KEY: 'another-key',
        AI_BASE_URL: 'https://gateway.example/api/v1/',
        AI_MODEL: 'deepseek/deepseek-v4.1-flash',
      }),
      fetchImpl,
    });
    expect(requests[0].url).toBe(
      'https://gateway.example/api/v1/chat/completions',
    );
    expect(requests[0].body.model).toBe('deepseek/deepseek-v4.1-flash');
    expect(requests[0].body.thinking).toBeUndefined();
    expect(requests[0].body.user).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [
      'https://ai-gateway.vercel.sh/v1',
      'deepseek/deepseek-v4.1-flash',
      'vercel-gateway',
    ],
    ['https://api.deepseek.com', 'deepseek-flash', 'deepseek-native'],
  ])(
    'includes %s search in the four-call budget with accurate provenance',
    async (baseUrl, model, provider) => {
      const { fetchImpl, requests } = replies(outputs);
      const onUsage = vi.fn();
      const run = await runHostedJury({
        ...baseOptions,
        config: getAiConfig({
          AI_API_KEY: 'test',
          AI_BASE_URL: baseUrl,
          AI_MODEL: model,
        }),
        initialUsage: { calls: 1, inputTokens: 200, outputTokens: 100 },
        fetchImpl,
        onUsage,
      });
      expect(requests).toHaveLength(3);
      if (provider === 'vercel-gateway')
        expect(requests[0].body.reasoning).toEqual({ enabled: false });
      else expect(requests[0].body.thinking).toEqual({ type: 'disabled' });
      expect(
        run.events.find((event) => event.kind === 'search.completed')?.payload,
      ).toMatchObject({
        value: {
          method: `${provider}-search-then-independent-page-fetch`,
          exhaustive: false,
        },
      });
      expect(onUsage).toHaveBeenLastCalledWith({
        calls: 4,
        inputTokens: 500,
        outputTokens: 250,
      });
      const failed = replies([outputs[0], outputs[1], {}]);
      await expect(
        runHostedJury({
          ...baseOptions,
          initialUsage: { calls: 1, inputTokens: 200, outputTokens: 100 },
          fetchImpl: failed.fetchImpl,
        }),
      ).rejects.toMatchObject({ status: 502 });
      expect(failed.requests).toHaveLength(3);
    },
  );

  it('extracts later relevant evidence with nearby qualifications without increasing excerpt size', () => {
    const text = `${'Unrelated introductory material. '.repeat(90)}Flash supports tool calling. However, built-in web search is not supported. ${'Unrelated concluding material. '.repeat(80)}`;
    const record = sourceFromPage(
      new URL(source.url),
      Buffer.from(`<main>${text}</main>`),
      0,
      new Date(timestamp),
      'Does Flash support built-in web search?',
    );
    expect(record.excerpt).toContain('built-in web search is not supported');
    expect(record.excerpt.length).toBeLessThanOrEqual(1_000);
    expect(Buffer.byteLength(record.excerpt)).toBeLessThanOrEqual(1_600);
    expect(record.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not retry network/provider errors or expose their secret-bearing error text', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { message: 'secret-test-key at https://private.example' } },
        { status: 503 },
      ),
    ) as typeof fetch;
    await expect(
      runHostedJury({ ...baseOptions, fetchImpl }),
    ).rejects.toMatchObject({
      status: 502,
      message: expect.not.stringContaining('secret-test-key'),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops all subsequent roles if a provider reports exceeding its output allowance', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { content: JSON.stringify(outputs[0]) },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 5_000 },
      }),
    ) as typeof fetch;
    const onUsage = vi.fn();
    await expect(
      runHostedJury({ ...baseOptions, fetchImpl, onUsage }),
    ).rejects.toMatchObject({ status: 502 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenLastCalledWith({
      calls: 1,
      inputTokens: 100,
      outputTokens: 5_000,
    });
  });

  it('shares exactly one schema repair across the entire run', async () => {
    const { fetchImpl, requests } = replies([
      {},
      outputs[0],
      outputs[1],
      outputs[2],
    ]);
    expect((await runHostedJury({ ...baseOptions, fetchImpl })).state).toBe(
      'completed',
    );
    expect(requests).toHaveLength(4);
    const failed = replies([{}, outputs[0], {}, outputs[1]]);
    await expect(
      runHostedJury({ ...baseOptions, fetchImpl: failed.fetchImpl }),
    ).rejects.toMatchObject({ status: 502 });
    expect(failed.requests).toHaveLength(3);
  });

  it('rejects invented citations and duplicate claim IDs', async () => {
    for (const claims of [
      [{ ...claim, sourceIds: ['invented'] }],
      [claim, claim],
    ]) {
      const { fetchImpl } = replies([{ claims }, { claims }]);
      await expect(
        runHostedJury({ ...baseOptions, fetchImpl }),
      ).rejects.toMatchObject({ status: 502 });
    }
  });

  it('rejects unsupported final verdicts and preserves source provenance', async () => {
    const invalid = {
      ...outputs[2],
      sources: [{ ...source, contentDigest: 'f'.repeat(64) }],
    };
    const { fetchImpl } = replies([outputs[0], outputs[1], invalid, invalid]);
    await expect(
      runHostedJury({ ...baseOptions, fetchImpl }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('enforces input limits before dispatch and bounds streamed response bytes', async () => {
    const first = replies(outputs);
    await expect(
      runHostedJury({
        ...baseOptions,
        question: 'x'.repeat(20_000),
        fetchImpl: first.fetchImpl,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(first.fetchImpl).not.toHaveBeenCalled();
    const oversized = vi.fn(
      async () => new Response(' '.repeat(AI_LIMITS.responseBytes + 1)),
    ) as typeof fetch;
    await expect(
      runHostedJury({ ...baseOptions, fetchImpl: oversized }),
    ).rejects.toMatchObject({ status: 413 });
    expect(oversized).toHaveBeenCalledOnce();
  });

  it('fails closed when configuration is missing, unsafe, or is a full endpoint', () => {
    expect(() => getAiConfig({})).toThrow();
    for (const base of [
      'http://api.example',
      'https://user:password@api.example',
      'https://localhost',
      'https://127.0.0.1',
      'https://api.example/v1?token=secret',
      'https://api.example/v1/chat/completions',
    ]) {
      expect(() =>
        getAiConfig({
          AI_API_KEY: 'x',
          AI_MODEL: 'deepseek-flash',
          AI_BASE_URL: base,
        }),
      ).toThrow();
    }
  });
});

describe('bounded public source reader', () => {
  it('blocks local, private, metadata, reserved, and IP-literal destinations', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '100.64.0.1',
      '198.18.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      '::ffff:127.0.0.1',
    ])
      expect(isPublicIpv4(ip)).toBe(false);
    expect(isPublicIpv4('1.1.1.1')).toBe(true);
    for (const url of [
      'http://example.com',
      'https://localhost',
      'https://127.1',
      'https://[::1]',
      'https://site.internal',
      'https://example.com:8443',
      'https://user:pass@example.com',
    ])
      expect(() => validateSourceUrl(url)).toThrow();
  });

  it('hashes fetched bytes and excludes executable markup from bounded excerpts', () => {
    const page = Buffer.from(
      '<title>Evidence</title><script>steal-secret()</script><main>' +
        'Verified source text. '.repeat(100) +
        '</main>',
    );
    const result = sourceFromPage(
      new URL('https://example.com'),
      page,
      0,
      new Date(timestamp),
    );
    expect(result.excerpt).not.toContain('steal-secret');
    expect(result.excerpt.length).toBeLessThanOrEqual(1000);
    expect(result.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.retrievedAt).toBe(timestamp);
  });
});
