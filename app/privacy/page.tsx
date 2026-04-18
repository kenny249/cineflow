import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Cineflow collects, uses, and protects your information.",
};

const EFFECTIVE_DATE = "April 17, 2025";
const CONTACT_EMAIL = "kenny@maltavmedia.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-foreground">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-[#d4a853]">CINEFLOW</span>
          </Link>
          <Link
            href="/login"
            className="text-xs text-zinc-500 hover:text-white transition-colors"
          >
            Back to app →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-10">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">Privacy Policy</h1>
          <p className="text-sm text-zinc-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <p className="mb-10 text-sm leading-relaxed text-zinc-400">
          Cineflow is a film production management platform operated by Maltav Media. This
          policy explains what information we collect, how we use it, and what rights you have
          over it. We keep this simple — we don't sell your data, we don't run ads, and we only
          collect what we need to run the product.
        </p>

        <Section title="1. What We Collect">
          <p><strong className="text-zinc-200">Account information.</strong> When you sign up, we collect your email address, first name, last name, and company name. This is used to identify your account and personalize the app.</p>
          <p><strong className="text-zinc-200">Project and production data.</strong> Everything you create inside Cineflow — projects, shot lists, storyboards, scripts, calendar events, client contacts, team members, and retainer plans — is stored and associated with your account.</p>
          <p><strong className="text-zinc-200">Uploaded files.</strong> Project thumbnails, revision videos, and any other files you upload are stored securely in our cloud storage. These files are private to your account unless you explicitly share a review link.</p>
          <p><strong className="text-zinc-200">Financial data.</strong> Invoice details, client payment information you enter (amounts, line items, payment status), and contract content are stored to support the Finance and Contracts features. We do not process or store credit card numbers — payments are handled externally.</p>
          <p><strong className="text-zinc-200">Activity and usage data.</strong> We log in-app actions (e.g., project updates, file uploads) to populate your activity feed and help you track your work history. We may also collect basic usage analytics to understand how features are used.</p>
          <p><strong className="text-zinc-200">Communications.</strong> When we send you a login code, invoice, or contract via email, your email address is passed to our email delivery provider (Resend) for that purpose only.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use your information only to operate and improve Cineflow:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Authenticate you and secure your account</li>
            <li>Store and display your production data across devices</li>
            <li>Send transactional emails (login codes, invoices, contracts) on your behalf</li>
            <li>Power AI-assisted features (storyboard and script suggestions) using Anthropic's Claude — your content is sent to Anthropic's API only when you actively use these features</li>
            <li>Improve the product through aggregated, anonymized usage patterns</li>
            <li>Respond to support requests</li>
          </ul>
          <p>We do not use your data for advertising, behavioral profiling, or any purpose unrelated to providing Cineflow to you.</p>
        </Section>

        <Section title="3. Who We Share Data With">
          <p>We do not sell, rent, or share your personal information with third parties for their own purposes. We work with the following service providers who process data on our behalf:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li><strong className="text-zinc-200">Supabase</strong> — database, authentication, and file storage (hosted on AWS infrastructure)</li>
            <li><strong className="text-zinc-200">Vercel</strong> — application hosting and server-side functions</li>
            <li><strong className="text-zinc-200">Resend</strong> — transactional email delivery (login codes, invoices, contracts)</li>
            <li><strong className="text-zinc-200">Anthropic</strong> — AI language model for in-app assistant features (only when you use those features)</li>
          </ul>
          <p>Each of these providers is bound by their own privacy policies and data processing agreements. We may also disclose information when required by law or to protect the security of our platform.</p>
        </Section>

        <Section title="4. Data Storage and Security">
          <p>Your data is stored in Supabase's managed database infrastructure, which runs on Amazon Web Services (AWS) in the United States. All data in transit is encrypted with TLS. Database access is secured with Row Level Security (RLS) policies, meaning your data is only accessible to your account.</p>
          <p>Uploaded files are stored in private Supabase Storage buckets. Review links you share with clients use time-limited, token-based access — your underlying files are never publicly exposed.</p>
          <p>No security system is perfect, but we take reasonable precautions to protect your information from unauthorized access, disclosure, or loss.</p>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain your data for as long as your account is active. If you delete your account, your data is permanently removed from our systems within 30 days, except where we are required by law to retain it longer (e.g., financial records).</p>
          <p>Demo accounts created without signing up are automatically deleted after 7 days.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>Depending on where you are located, you may have rights including:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li><strong className="text-zinc-200">Access.</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong className="text-zinc-200">Correction.</strong> Update your name or account information at any time in Settings.</li>
            <li><strong className="text-zinc-200">Deletion.</strong> Request deletion of your account and all associated data.</li>
            <li><strong className="text-zinc-200">Portability.</strong> Request an export of your data in a readable format.</li>
            <li><strong className="text-zinc-200">Objection.</strong> Object to certain processing of your data.</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#d4a853] hover:underline">
              {CONTACT_EMAIL}
            </a>. We will respond within 30 days.
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>Cineflow uses minimal cookies and browser storage. We use session storage and local storage to maintain your login session and remember UI preferences (such as sidebar state). We do not use third-party tracking cookies or advertising pixels.</p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>Cineflow is not intended for use by anyone under the age of 16. We do not knowingly collect personal information from children. If you believe a child has provided us with their information, please contact us and we will delete it promptly.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this policy from time to time. When we do, we'll update the effective date at the top of this page. For significant changes, we'll notify active users by email. Continued use of Cineflow after a policy update constitutes your acceptance of the revised policy.</p>
        </Section>

        <Section title="10. Contact">
          <p>
            If you have questions about this policy or how your data is handled, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#d4a853] hover:underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
          <p className="mt-1">
            Maltav Media · Los Angeles, CA
          </p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <p className="text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} Maltav Media. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
