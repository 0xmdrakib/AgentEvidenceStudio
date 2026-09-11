import { Client } from 'pg';
import { AiRequestError, type AiUsage } from './ai-policy.ts';

const quotaErrors: Record<string, [string, number, number?]> = {
  AI_GOOGLE_REQUIRED: [
    'Sign in with a verified Google account to start research.',
    403,
  ],
  AI_DUPLICATE: [
    'This research request has already been submitted. Check your runs before trying again.',
    409,
  ],
  AI_BUSY: ['Your current research is still running.', 429, 60],
  AI_COOLDOWN: ['Please wait one minute between research runs.', 429, 60],
  AI_DAILY_LIMIT: [
    'Your daily research allowance is used. It resets at 00:00 UTC.',
    429,
  ],
  AI_MONTHLY_LIMIT: [
    'Your monthly research allowance is used. It resets on the first day of next month (UTC).',
    429,
  ],
  AI_SITE_DAILY_LIMIT: [
    'Today’s shared research allowance is used. Please return tomorrow (UTC).',
    429,
  ],
  AI_SITE_MONTHLY_LIMIT: [
    'The shared monthly research allowance is used. Please return next month (UTC).',
    429,
  ],
  AI_SITE_BUSY: [
    'Research is busy right now. Please try again in a minute.',
    429,
    60,
  ],
};

async function withDatabase<T>(
  work: (client: Client) => Promise<T>,
): Promise<T> {
  if (!process.env.DATABASE_URL)
    throw new AiRequestError('Research is awaiting administrator setup.', 503);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8_000,
    statement_timeout: 8_000,
    query_timeout: 10_000,
  });
  try {
    await client.connect();
    return await work(client);
  } catch (error) {
    const known =
      error instanceof Error ? quotaErrors[error.message] : undefined;
    if (known) throw new AiRequestError(...known);
    if (error instanceof AiRequestError) throw error;
    throw new AiRequestError(
      'Research allowance could not be checked. Please try again shortly.',
      503,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function getHostedUsage(userId: string): Promise<AiUsage> {
  return withDatabase(
    async (client) =>
      (
        await client.query<{ usage: AiUsage }>(
          'select public.ai_member_usage($1) as usage',
          [userId],
        )
      ).rows[0].usage,
  );
}

export async function reserveHostedRun(
  userId: string,
  id: string,
  requestId: string,
  digest: string,
): Promise<AiUsage> {
  return withDatabase(
    async (client) =>
      (
        await client.query<{ usage: AiUsage }>(
          'select public.reserve_ai_run($1, $2::uuid, $3::uuid, $4) as usage',
          [userId, id, requestId, digest],
        )
      ).rows[0].usage,
  );
}

export async function finishHostedRun(
  id: string,
  userId: string,
  state: 'completed' | 'failed',
  usage: { inputTokens: number; outputTokens: number; calls: number },
): Promise<void> {
  await withDatabase(async (client) => {
    await client.query(
      `update public.ai_run_reservations set state = $3, input_tokens = $4, output_tokens = $5, calls = $6
      where id = $1::uuid and owner_id = $2 and state = 'running'`,
      [id, userId, state, usage.inputTokens, usage.outputTokens, usage.calls],
    );
  });
}
