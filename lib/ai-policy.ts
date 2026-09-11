// Public product limits. The database enforces the same run limits; clients
// cannot choose the model, endpoint, prompts, token limits, or repair budget.
export const AI_LIMITS = {
  dailyRuns: 2,
  monthlyRuns: 10,
  globalDailyRuns: 20,
  globalMonthlyRuns: 200,
  cooldownSeconds: 60,
  maximumCalls: 4,
  inputBytesPerCall: 12_288,
  outputTokensPerCall: 1_536,
  questionCharacters: 1_000,
  maximumSources: 3,
  requestBytes: 8_192,
  responseBytes: 65_536,
  runTimeoutMs: 240_000,
  callTimeoutMs: 50_000,
} as const;

export type AiUsage = {
  usedToday: number;
  usedThisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyResetAt: string;
  monthlyResetAt: string;
};

export class AiRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'AiRequestError';
  }
}
