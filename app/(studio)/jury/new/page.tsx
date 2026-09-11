'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowRight,
  FlaskConical,
  SearchCheck,
  Settings2,
  ShieldQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClayScene } from '@/components/clay-scene';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { AiAllowance } from '@/components/ai-allowance';
import { useStudio } from '@/components/studio-provider';
import { AI_LIMITS } from '@/lib/ai-policy';

export default function NewJuryPage() {
  const { providers, runnerOnline, startJury } = useStudio();
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [links, setLinks] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const sourceUrls = links
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean);
  const provider = providers[0];
  const submit = async () => {
    if (!provider) return;
    setBusy(true);
    try {
      const run = await startJury(question, provider.id, sourceUrls);
      router.push(`/jury/${run.id}`);
    } catch {
      /* The shared error banner or sign-in flow handles this failure. */
    } finally {
      setBusy(false);
      setRefreshKey((value) => value + 1);
    }
  };
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        eyebrow="Module 03 · teal evidence"
        title="Research Jury"
        description="Bring a question and public sources. Three evidence-review passes examine claims, challenge weak support, and explain what remains unresolved."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="paper min-w-0 rounded-[26px] p-5 sm:p-7">
          {!provider ? (
            <EmptyState
              icon={Settings2}
              title="Research is being prepared"
              body="The administrator is finishing the research connection. Your saved evidence remains available."
            />
          ) : (
            <>
              <Label
                htmlFor="research-question"
                className="text-sm font-extrabold"
              >
                What should the jury investigate?
              </Label>
              <Textarea
                id="research-question"
                className="mt-3 min-h-36 rounded-2xl bg-[#fcf9f3] p-4 text-base leading-7"
                maxLength={AI_LIMITS.questionCharacters}
                placeholder="Ask a focused factual question that your sources can help answer."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={busy}
              />
              <p className="mt-2 text-right text-sm text-[var(--muted-ink)]">
                {question.length} / {AI_LIMITS.questionCharacters}
              </p>
              <Label
                htmlFor="source-links"
                className="mt-5 block text-sm font-extrabold"
              >
                Source links
              </Label>
              <Textarea
                id="source-links"
                className="mt-3 min-h-28 rounded-2xl bg-[#fcf9f3] p-4 text-base"
                placeholder="https://example.com/article"
                value={links}
                onChange={(event) => setLinks(event.target.value)}
                disabled={busy}
                aria-describedby="source-help"
              />
              <p
                id="source-help"
                className="mt-2 text-sm leading-6 text-[var(--muted-ink)]"
              >
                Add 1–3 public HTTPS links, one per line. The jury reviews short
                excerpts from these pages, so choose specific articles or
                documentation. PDFs, sign-in pages, and image-only pages are not
                supported.
              </p>
              <div className="mt-5">
                <AiAllowance refreshKey={refreshKey} />
              </div>
              <p className="mt-4 break-words text-sm text-[var(--muted-ink)]">
                Research model:{' '}
                <span className="font-bold text-[var(--ink)]">
                  {provider.model}
                </span>
              </p>
              <Button
                className="mt-5 min-h-13 w-full rounded-2xl bg-[var(--teal)] !text-white"
                disabled={
                  !runnerOnline ||
                  question.trim().length < 10 ||
                  sourceUrls.length < 1 ||
                  sourceUrls.length > 3 ||
                  busy
                }
                onClick={submit}
              >
                {busy ? (
                  'Jury is examining evidence…'
                ) : (
                  <>
                    Start hosted jury <ArrowRight />
                  </>
                )}
              </Button>
            </>
          )}
        </section>
        <aside className="paper min-w-0 overflow-hidden rounded-[26px] p-4">
          <ClayScene module="jury" className="rounded-[20px]" />
          <div className="px-1 pb-1 pt-4">
            <p className="eyebrow">Evidence roles</p>
            <h2 className="mt-1 text-xl font-black">
              Three independent passes
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
              Each role reviews the same source excerpts from a different
              perspective. This is a focused source review, not an exhaustive
              search of the web.
            </p>
            <div className="mt-4 divide-y divide-[var(--line)] rounded-[18px] border border-[var(--line)] bg-[#fcf9f3]">
              <Role
                icon={SearchCheck}
                label="Researcher"
                body="Extracts claims grounded in the supplied sources."
              />
              <Role
                icon={ShieldQuestion}
                label="Challenger"
                body="Checks for contradictions, stale details, and missing proof."
              />
              <Role
                icon={FlaskConical}
                label="Adjudicator"
                body="Explains which claims are supported, disputed, or unresolved."
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
function Role({
  icon: Icon,
  label,
  body,
}: {
  icon: typeof FlaskConical;
  label: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f1ee] text-[var(--teal)]">
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-sm font-extrabold">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--muted-ink)]">
          {body}
        </span>
      </span>
    </div>
  );
}
