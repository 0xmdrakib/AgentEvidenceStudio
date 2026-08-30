import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms for using Agent Evidence Studio.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/auth" className="inline-flex">
        <Image
          src="/brand/agent-evidence-logo.svg"
          alt="Agent Evidence Studio"
          width={220}
          height={43}
          unoptimized
          className="h-10 w-auto max-w-[220px]"
        />
      </Link>
      <article className="paper mt-8 rounded-[28px] p-6 sm:p-10">
        <p className="eyebrow text-[var(--muted-ink)]">
          Effective August 30, 2026
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Terms of Service</h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-[var(--muted-ink)]">
          <Section title="Service">
            Agent Evidence Studio provides tools for recording agent evidence,
            reconciling structured memory, and producing source-bound research.
            The service is provided without a guarantee that every result is
            accurate, complete, or continuously available.
          </Section>
          <Section title="Account">
            You must use your own Google account and keep access to it secure.
            One person may not use multiple accounts to evade storage, write, or
            hosted-execution limits.
          </Section>
          <Section title="Acceptable use">
            Do not automate abusive traffic, probe other users’ data, upload
            unlawful content, bypass quotas, disrupt the service, or use the
            service to violate the rights of others.
          </Section>
          <Section title="Limits">
            The standard member plan includes 10 MB of stored cloud data, 100
            encrypted versions, 20 published reports, 50 cloud writes per day,
            and 5 hosted research runs per day. Limits may be reduced
            temporarily to protect service reliability.
          </Section>
          <Section title="Your content">
            You remain responsible for the evidence and reports you upload or
            publish. You grant the service only the permission needed to store,
            process, secure, and deliver that content.
          </Section>
          <Section title="Research output">
            Generated findings can be wrong or outdated. Verify important claims
            and do not rely on the service as a substitute for professional
            legal, medical, financial, or safety advice.
          </Section>
          <Section title="Termination and changes">
            Access may be suspended for abuse, security risk, or repeated limit
            evasion. These terms and service limits may change as the product
            evolves; material changes will be reflected on this page.
          </Section>
        </div>
        <div className="mt-9 flex gap-4 border-t pt-6 text-sm font-bold">
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          <Link href="/auth" className="underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-extrabold text-[var(--ink)]">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
