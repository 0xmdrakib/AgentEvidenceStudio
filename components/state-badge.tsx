import type { RunState } from '@aes/contracts';
const styles: Record<RunState, string> = { draft: 'bg-stone-200', awaiting_approval: 'bg-amber-200', running: 'bg-blue-200', blocked: 'bg-orange-200', completed: 'bg-[#cce7dd]', failed: 'bg-[#ffd7d1]', canceled: 'bg-stone-200' };
export function StateBadge({ state }: { state: RunState }) { return <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-[0.08em] ${styles[state]}`}>{state.replaceAll('_', ' ')}</span>; }
