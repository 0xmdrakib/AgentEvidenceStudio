import { Client } from 'pg';

const BURST_WINDOW_MINUTES = 10;
const BURST_RUN_LIMIT = 3;

export async function reserveHostedRun(
  userId: string,
): Promise<{ used: number; limit: number }> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(
      `
      insert into public.account_limits (owner_id)
      values ($1)
      on conflict (owner_id) do nothing
    `,
      [userId],
    );

    const quota = await client.query<{ daily_hosted_run_limit: number }>(
      `
      select daily_hosted_run_limit
      from public.account_limits
      where owner_id = $1
      for update
    `,
      [userId],
    );
    const limit = quota.rows[0]?.daily_hosted_run_limit ?? 5;
    const burst = await client.query<{ requests_count: number }>(
      `
      insert into public.hosted_request_buckets (owner_id, bucket_start, requests_count, updated_at)
      values ($1, date_bin(($2 || ' minutes')::interval, now(), timestamptz '2020-01-01 00:00:00+00'), 1, now())
      on conflict (owner_id, bucket_start) do update
      set requests_count = public.hosted_request_buckets.requests_count + 1,
          updated_at = now()
      where public.hosted_request_buckets.requests_count < $3
      returning requests_count
    `,
      [userId, BURST_WINDOW_MINUTES, BURST_RUN_LIMIT],
    );
    if (!burst.rows[0])
      throw Object.assign(
        new Error(
          `Please wait before starting another hosted run (${BURST_RUN_LIMIT} per ${BURST_WINDOW_MINUTES} minutes).`,
        ),
        { status: 429 },
      );

    const result = await client.query<{ runs_count: number }>(
      `
      insert into public.execution_usage (owner_id, usage_date, runs_count, updated_at)
      values ($1, current_date, 1, now())
      on conflict (owner_id, usage_date) do update
      set runs_count = public.execution_usage.runs_count + 1, updated_at = now()
      where public.execution_usage.runs_count < $2
      returning runs_count
    `,
      [userId, limit],
    );
    const used = result.rows[0]?.runs_count;
    if (!used)
      throw Object.assign(
        new Error(`Daily hosted run limit reached (${limit}).`),
        { status: 429 },
      );
    await client.query('commit');
    return { used, limit };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
