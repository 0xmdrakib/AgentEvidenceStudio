import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sha256 } from '@aes/core';
import { runHostedJury, type AiTokenUsage } from './hosted-jury.ts';
import { getAiConfig, supportsWebSearch } from './ai-config.ts';
import { discoverResearchSources } from './research-search.ts';
import { AI_LIMITS, AiRequestError } from './ai-policy.ts';
import { readBoundedText } from './bounded-body.ts';
import {
  collectResearchSources,
  validateSourceUrl,
} from './research-sources.ts';
import {
  assertJsonRequest,
  assertTrustedOrigin,
  verifyNeonUser,
} from './server-auth.ts';
import {
  finishHostedRun,
  getHostedUsage,
  reserveHostedRun,
} from './hosted-usage.ts';

const inputSchema = z
  .object({
    action: z.literal('jury.run'),
    question: z.string().trim().min(10).max(AI_LIMITS.questionCharacters),
    sourceUrls: z
      .array(z.string().trim().min(1).max(1_500))
      .max(AI_LIMITS.maximumSources)
      .default([]),
    requestId: z.uuid(),
  })
  .strict();

function json(body: unknown, status = 200, retryAfter?: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      ...(retryAfter ? { 'retry-after': String(retryAfter) } : {}),
      ...(status === 405 ? { allow: 'GET, POST' } : {}),
    },
  });
}

export const hostedRunnerHandler = {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === 'GET') {
        if (new URL(request.url).searchParams.get('usage') === '1') {
          const { userId } = await verifyNeonUser(request);
          return json({ usage: await getHostedUsage(userId) });
        }
        let configured = false;
        let model = '';
        let webSearch = false;
        try {
          const config = getAiConfig();
          configured = Boolean(
            process.env.DATABASE_URL &&
            process.env.NEON_AUTH_JWKS_URL &&
            process.env.NEON_AUTH_ISSUER,
          );
          model = config.model;
          webSearch = supportsWebSearch(config);
        } catch {
          /* Public availability never discloses credentials or endpoint. */
        }
        return json({
          status: configured ? 'ready' : 'configuration_required',
          mode: 'hosted',
          configured,
          model,
          webSearch,
          limits: {
            dailyRuns: AI_LIMITS.dailyRuns,
            monthlyRuns: AI_LIMITS.monthlyRuns,
          },
        });
      }
      if (request.method !== 'POST')
        return json({ error: 'Method not allowed.' }, 405);
      assertTrustedOrigin(request);
      assertJsonRequest(request);
      const { userId } = await verifyNeonUser(request);
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(AI_LIMITS.runTimeoutMs),
      ]);
      if (
        Number(request.headers.get('content-length') ?? 0) >
        AI_LIMITS.requestBytes
      )
        throw new AiRequestError('Request is too large.', 413);
      const raw = await readBoundedText(
        request.body,
        AI_LIMITS.requestBytes,
        AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      );
      let candidate: unknown;
      try {
        candidate = JSON.parse(raw);
      } catch {
        throw new AiRequestError('Send a valid JSON research request.', 400);
      }
      const parsed = inputSchema.safeParse(candidate);
      if (!parsed.success)
        throw new AiRequestError(
          'Enter a 10–1,000 character question and at most three source links. Only research requests are accepted.',
          422,
        );
      const { question, requestId } = parsed.data;
      const sourceUrls = [
        ...new Set(
          parsed.data.sourceUrls.map((value) => validateSourceUrl(value).href),
        ),
      ];
      const config = getAiConfig();
      if (!sourceUrls.length && !supportsWebSearch(config))
        throw new AiRequestError(
          'Automatic search is not available with this connection. Add one to three public source links.',
          422,
        );
      const id = randomUUID();
      const usage = await reserveHostedRun(
        userId,
        id,
        requestId,
        await sha256({ question, sourceUrls }),
      );
      let state: 'completed' | 'failed' = 'failed';
      let tokenUsage: AiTokenUsage = {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      try {
        const selectedUrls = sourceUrls.length
          ? sourceUrls
          : await discoverResearchSources({
              question,
              userId,
              config,
              signal,
              onUsage: (value) => {
                tokenUsage = value;
              },
            });
        const sources = await collectResearchSources(
          selectedUrls,
          signal,
          question,
          !sourceUrls.length,
        );
        const run = await runHostedJury({
          question,
          userId,
          config,
          sources,
          initialUsage: tokenUsage,
          signal,
          onUsage: (value) => {
            tokenUsage = value;
          },
        });
        state = 'completed';
        return json({ run, usage }, 201);
      } finally {
        // A finalization failure leaves the six-minute lease and charged quota
        // intact. Never refund uncertain calls or repeat a completed AI request.
        await finishHostedRun(id, userId, state, tokenUsage).catch(() => {
          console.error(
            'AI reservation finalization failed; quota and lease remain reserved.',
          );
        });
      }
    } catch (error) {
      if (error instanceof AiRequestError)
        return json({ error: error.message }, error.status, error.retryAfter);
      if (
        error instanceof Error &&
        'status' in error &&
        [401, 403, 415].includes(Number(error.status))
      )
        return json({ error: error.message }, Number(error.status));
      return json(
        {
          error:
            'Research is temporarily unavailable. Please try again shortly.',
        },
        503,
      );
    }
  },
};
