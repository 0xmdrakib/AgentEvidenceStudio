import { Client } from 'pg';

export async function reserveHostedRun(userId: string): Promise<{ used: number; limit: number }> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  const limit = Math.max(1, Math.min(100, Number(process.env.OPENAI_DAILY_RUN_LIMIT ?? 5)));
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ runs_count: number }>(`
      insert into public.execution_usage (owner_id, usage_date, runs_count, updated_at)
      values ($1, current_date, 1, now())
      on conflict (owner_id, usage_date) do update
      set runs_count = public.execution_usage.runs_count + 1, updated_at = now()
      where public.execution_usage.runs_count < $2
      returning runs_count
    `, [userId, limit]);
    const used = result.rows[0]?.runs_count;
    if (!used) throw Object.assign(new Error(`Daily hosted run limit reached (${limit}).`), { status: 429 });
    return { used, limit };
  } finally {
    await client.end();
  }
}
