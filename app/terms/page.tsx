import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Cineflow Terms of Service — the rules for using the platform.",
};

const EFFECTIVE_DATE = "May 22, 2025";
const CONTACT_EMAIL = "admin@usecineflow.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function TermsPage() {
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
          <Link href="/login" className="text-xs text-zinc-500 hover:text-white transition-colors">
            Back to app →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-10">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">Terms of Service</h1>
          <p className="text-sm text-zinc-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <p className="mb-10 text-sm leading-relaxed text-zinc-400">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of Cineflow, a film production
          management platform operated by Maltav Media (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By
          creating an account or using Cineflow, you agree to these Terms. If you do not agree, do not use the
          platform.
        </p>

        <Section title="1. Eligibility">
          <p>You must be at least 16 years old to use Cineflow. By using the platform you represent that you meet this requirement. If you are using Cineflow on behalf of a company or organization, you represent that you have authority to bind that entity to these Terms.</p>
        </Section>

        <Section title="2. Your Account">
          <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#d4a853] hover:underline">{CONTACT_EMAIL}</a>{" "}
            if you believe your account has been compromised.
          </p>
          <p>You may not share your account with others or use another person&apos;s account. We reserve the right to terminate accounts that violate these Terms.</p>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You agree not to use Cineflow to:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Upload, transmit, or store content that is illegal, harmful, or infringes any third-party rights</li>
            <li>Attempt to gain unauthorized access to any part of the platform or another user&apos;s data</li>
            <li>Reverse-engineer, decompile, or otherwise attempt to extract source code</li>
            <li>Use automated means (bots, scrapers) to access or interact with the platform without our prior written consent</li>
            <li>Resell, sublicense, or commercially exploit the platform without a written agreement with us</li>
            <li>Interfere with or disrupt the platform&apos;s infrastructure</li>
          </ul>
        </Section>

        <Section title="4. Your Content">
          <p>You retain ownership of all content you create, upload, or store in Cineflow — including projects, shot lists, scripts, invoices, contracts, and uploaded files (&quot;Your Content&quot;).</p>
          <p>By using Cineflow, you grant us a limited, non-exclusive, royalty-free license to store, process, and display Your Content solely to provide the service to you. We do not claim ownership of Your Content and will never use it for advertising or to train AI models without your explicit consent.</p>
          <p>You are responsible for ensuring Your Content does not violate any laws or third-party rights.</p>
        </Section>

        <Section title="5. Payment and Billing">
          <p>Cineflow is currently free during its beta period. When paid plans are introduced, pricing and billing terms will be communicated in advance, and you will have the opportunity to accept or decline before being charged.</p>
          <p>If we introduce paid plans, subscription fees are billed in advance. All fees are non-refundable except where required by law or as otherwise stated at the time of purchase.</p>
        </Section>

        <Section title="6. Third-Party Services">
          <p>Cineflow integrates with third-party services (Stripe for payments, Resend for email, Anthropic for AI features). Your use of these integrations is subject to those providers&apos; terms. We are not responsible for the availability or conduct of third-party services.</p>
          <p>Payment processing via Stripe is governed by <a href="https://stripe.com/legal/end-users" target="_blank" rel="noopener noreferrer" className="text-[#d4a853] hover:underline">Stripe&apos;s terms</a>. We do not store or process credit card numbers.</p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>Cineflow, including its design, software, and branding, is owned by Maltav Media and protected by copyright and other intellectual property laws. Nothing in these Terms grants you a right to use our trademarks, logos, or brand assets.</p>
        </Section>

        <Section title="8. Disclaimer of Warranties">
          <p>Cineflow is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that the platform will be error-free, uninterrupted, or free of security vulnerabilities.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>To the fullest extent permitted by law, Maltav Media shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of Cineflow, even if we have been advised of the possibility of such damages. Our total liability to you for any claims arising under these Terms shall not exceed the greater of (a) the amount you paid us in the twelve months preceding the claim, or (b) $100.</p>
        </Section>

        <Section title="10. Termination">
          <p>You may stop using Cineflow at any time and delete your account from Settings. We may suspend or terminate your account if you violate these Terms, with or without notice, depending on the severity of the violation.</p>
          <p>Upon termination, your right to use Cineflow ends. We will delete your data within 30 days in accordance with our Privacy Policy.</p>
        </Section>

        <Section title="11. Changes to These Terms">
          <p>We may update these Terms from time to time. When we make material changes, we will notify you by email or by displaying a notice in the app at least 14 days before the changes take effect. Your continued use of Cineflow after that date constitutes acceptance of the updated Terms.</p>
        </Section>

        <Section title="12. Governing Law">
          <p>These Terms are governed by the laws of the State of California, without regard to its conflict-of-law provisions. Any disputes shall be resolved in the state or federal courts located in Los Angeles County, California.</p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms? Contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#d4a853] hover:underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
          <p className="mt-1">Maltav Media · Los Angeles, CA</p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} Maltav Media. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-zinc-600">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
