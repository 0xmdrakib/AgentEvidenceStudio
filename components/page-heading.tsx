import type { ReactNode } from 'react';
export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-3xl"><p className="eyebrow mb-3 text-[var(--muted-ink)]">{eyebrow}</p><h1 className="display text-4xl sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted-ink)] sm:text-base">{description}</p></div>{actions && <div className="shrink-0">{actions}</div>}</div>;
}
