import { runHostedJury } from './hosted-jury.ts';
import { assertTrustedOrigin, verifyNeonUser } from './server-auth.ts';
import { reserveHostedRun } from './hosted-usage.ts';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export const hostedRunnerHandler = {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === 'GET') {
        const configured = Boolean(process.env.OPENAI_API_KEY && process.env.DATABASE_URL && process.env.NEON_AUTH_JWKS_URL);
        return json({ status: configured ? 'ready' : 'configuration_required', mode: 'hosted', configured, model: process.env.OPENAI_MODEL ?? 'gpt-5.6-sol' });
      }
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      assertTrustedOrigin(request);
      const length = Number(request.headers.get('content-length') ?? 0);
      if (length > 16_384) return json({ error: 'Request is too large.' }, 413);
      const { userId } = await verifyNeonUser(request);
      const input = await request.json() as { action?: string; question?: string };
      if (input.action !== 'jury.run') return json({ error: 'Unknown hosted action.' }, 404);
      const question = input.question?.trim() ?? '';
      if (question.length < 10 || question.length > 2_000) return json({ error: 'Research question must be between 10 and 2,000 characters.' }, 422);
      const usage = await reserveHostedRun(userId);
      const run = await runHostedJury({
        question,
        userId,
        apiKey: process.env.OPENAI_API_KEY!,
        model: process.env.OPENAI_MODEL ?? 'gpt-5.6-sol',
      });
      return json({ run, usage }, 201);
    } catch (error: any) {
      return json({ error: error instanceof Error ? error.message : 'Hosted execution failed.', ...(error?.run ? { run: error.run } : {}) }, Number(error?.status ?? 400));
    }
  },
};
