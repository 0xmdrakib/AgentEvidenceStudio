import { describe, expect, it, vi } from 'vitest';
import { discoverResearchSources } from '../lib/research-search';
import { getAiConfig, supportsWebSearch } from '../lib/ai-config';
import { AI_LIMITS } from '../lib/ai-policy';

const config = getAiConfig({
  AI_API_KEY: 'secret-test',
  AI_BASE_URL: 'https://ai-gateway.vercel.sh/v1',
  AI_MODEL: 'deepseek/deepseek-v4.1-flash',
});
const options = {
  config,
  question: 'Does this factual claim have supporting evidence?',
  userId: 'verified-user',
  signal: new AbortController().signal,
  onUsage: vi.fn(),
};
function body(
  urls = ['https://www.example.com/evidence'],
  counts: unknown = { perplexity_search: 1 },
) {
  return {
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({ urls }),
          provider_metadata: { gateway: { gatewayToolCalls: counts } },
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50 },
  };
}

describe('bounded Gateway search discovery', () => {
  it('makes a single fixed search with developer-controlled query and result limits', async () => {
    const fetchImpl = vi.fn(async () => Response.json(body())) as typeof fetch;
    const onUsage = vi.fn();
    expect(
      await discoverResearchSources({ ...options, onUsage, fetchImpl }),
    ).toEqual(['https://www.example.com/evidence']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe('https://ai-gateway.vercel.sh/v1/chat/completions');
    if (typeof init?.body !== 'string')
      throw new Error('Expected JSON request');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe(config.model);
    expect(sent.tools).toEqual([
      {
        type: 'vercel:perplexity_search',
        config: {
          query: options.question,
          max_results: 3,
          max_tokens_per_page: 512,
          max_tokens: 1536,
        },
      },
    ]);
    expect(sent.tool_choice).toBe('required');
    expect(sent.max_tokens).toBe(512);
    expect(sent.reasoning).toEqual({ enabled: false });
    expect(init?.redirect).toBe('error');
    expect(onUsage.mock.calls[0][0].calls).toBe(1);
    expect(onUsage).toHaveBeenLastCalledWith({
      calls: 1,
      inputTokens: 100,
      outputTokens: 50,
    });
  });
  it('never treats missing, zero, or excessive reported search calls as successful search', async () => {
    for (const counts of [
      undefined,
      {},
      { perplexity_search: 0 },
      { perplexity_search: 2 },
      { perplexity_search: '1' },
    ]) {
      const response = body();
      response.choices[0].message.provider_metadata.gateway.gatewayToolCalls =
        counts;
      const fetchImpl = vi.fn(async () =>
        Response.json(response),
      ) as typeof fetch;
      await expect(
        discoverResearchSources({ ...options, fetchImpl }),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects private URLs, empty results, oversized lists and invalid JSON without retries', async () => {
    for (const urls of [
      [],
      ['https://127.0.0.1/a'],
      ['https://host.internal/a'],
      [
        'https://a.example',
        'https://b.example',
        'https://c.example',
        'https://d.example',
      ],
    ]) {
      const fetchImpl = vi.fn(async () =>
        Response.json(body(urls)),
      ) as typeof fetch;
      await expect(
        discoverResearchSources({ ...options, fetchImpl }),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
  it('bounds search output and does not leak upstream errors or retry them', async () => {
    for (const response of [
      new Response('secret-test', { status: 429 }),
      new Response(' '.repeat(AI_LIMITS.responseBytes + 1)),
      new Response('invalid json'),
    ]) {
      const fetchImpl = vi.fn(async () => response) as typeof fetch;
      const onUsage = vi.fn();
      await expect(
        discoverResearchSources({ ...options, onUsage, fetchImpl }),
      ).rejects.toMatchObject({
        message: expect.not.stringContaining('secret-test'),
        status: 502,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(onUsage).toHaveBeenCalledTimes(1);
    }
  });
  it('does not forward Gateway tools to other compatible or lookalike endpoints', async () => {
    for (const base of [
      'https://api.deepseek.com',
      'https://ai-gateway.vercel.sh.evil.example/v1',
      'https://ai-gateway.vercel.sh/v2',
    ]) {
      const other = getAiConfig({
        AI_API_KEY: 'test',
        AI_MODEL: 'deepseek-flash',
        AI_BASE_URL: base,
      });
      expect(supportsWebSearch(other)).toBe(false);
      const fetchImpl = vi.fn();
      await expect(
        discoverResearchSources({ ...options, config: other, fetchImpl }),
      ).rejects.toMatchObject({ status: 422 });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });
  it('does not dispatch an oversized or already-aborted question', async () => {
    const fetchImpl = vi.fn();
    await expect(
      discoverResearchSources({
        ...options,
        question: 'q'.repeat(1_001),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      discoverResearchSources({
        ...options,
        signal: AbortSignal.abort(),
        fetchImpl,
      }),
    ).rejects.toBeDefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
