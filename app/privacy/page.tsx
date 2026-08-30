import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Agent Evidence Studio handles identity, encrypted evidence, and usage data.',
};

export default function PrivacyPage() {
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
        <h1 className="display mt-3 text-4xl sm:text-5xl">Privacy Policy</h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-[var(--muted-ink)]">
          <Section title="What we collect">
            Google sign-in provides a stable account ID and may provide your
            name, email address, and profile image. We store account quota
            counters, encrypted evidence bundles, run metadata, and reports you
            explicitly publish.
          </Section>
          <Section title="How private evidence is protected">
            Private run payloads are encrypted in your browser before upload.
            The workspace passphrase and unwrapped encryption key are not sent
            to the hosted service. Neon Postgres row-level security restricts
            private records to their authenticated owner.
          </Section>
          <Section title="Usage and security data">
            We keep small account-level counters to enforce storage, write, and
            hosted-run limits and to prevent spam. Service providers may process
            standard network logs for security, reliability, and abuse
            prevention.
          </Section>
          <Section title="Public reports">
            A report becomes publicly readable only after you use the explicit
            publish flow. Published reports contain redacted report data, not
            the private encrypted bundle.
          </Section>
          <Section title="Service providers">
            Authentication and database services are provided by Neon; Google
            provides identity verification; Vercel hosts the application;
            Cloudflare protects and routes the custom domain. Each provider
            processes data under its own terms.
          </Section>
          <Section title="Retention and contact">
            Private data remains associated with your account until it is
            removed or the service is discontinued, subject to operational
            backups and legal obligations. For privacy or deletion requests,
            contact the repository owner through the project’s public GitHub
            profile.
          </Section>
        </div>
        <div className="mt-9 flex gap-4 border-t pt-6 text-sm font-bold">
          <Link href="/terms" className="underline underline-offset-4">
            Terms of Service
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
