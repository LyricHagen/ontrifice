import type { Metadata } from "next";
import { TableOfContents } from "@/components/table-of-contents";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Ontrifice collects, uses, and protects your data.",
  openGraph: {
    title: "Privacy Policy | Ontrifice",
    description: "How Ontrifice collects, uses, and protects your data.",
    type: "website",
    url: "https://ontrifice.dev/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 flex gap-12">
      <aside className="hidden lg:block w-56 shrink-0">
        <TableOfContents />
      </aside>
      <article className="max-w-[720px] flex-1 min-w-0">
        <header className="mb-12">
          <h1 className="font-mono text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-text-secondary">
            Last updated: September 8, 2026
          </p>
        </header>

        <div className="flex flex-col gap-12 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2
              id="data-we-collect"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              Data We Collect
            </h2>
            <p className="mb-3">
              Ontrifice collects only the minimum data necessary to operate the
              service. If you create an account, we store:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                <strong className="text-foreground">Email address</strong>{" "}
                &mdash; used for account identification, login, and essential
                service communications (password resets, security alerts).
              </li>
              <li>
                <strong className="text-foreground">
                  Hashed password
                </strong>{" "}
                &mdash; passwords are hashed using bcrypt before storage. We
                never store or have access to your plaintext password.
              </li>
              <li>
                <strong className="text-foreground">API usage logs</strong>{" "}
                &mdash; request timestamps, endpoint paths, response status
                codes, and your client IP address. These logs are used
                exclusively for rate limiting and abuse detection.
              </li>
            </ul>
            <p className="mt-3">
              If you use Ontrifice without creating an account, we do not
              collect any personal data. Unauthenticated requests are not
              tracked or logged beyond standard server access logs required for
              infrastructure operation.
            </p>
          </section>

          <section>
            <h2
              id="how-we-use-it"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              How We Use It
            </h2>
            <p className="mb-3">Your data is used for the following purposes:</p>
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                <strong className="text-foreground">Authentication</strong>{" "}
                &mdash; verifying your identity when you log in.
              </li>
              <li>
                <strong className="text-foreground">Rate limiting</strong>{" "}
                &mdash; preventing abuse of the API and ensuring fair usage
                across all users.
              </li>
              <li>
                <strong className="text-foreground">
                  Security and abuse detection
                </strong>{" "}
                &mdash; identifying and blocking malicious or automated access
                patterns.
              </li>
              <li>
                <strong className="text-foreground">
                  Service communications
                </strong>{" "}
                &mdash; sending you password reset emails or security
                notifications. We will never send marketing emails.
              </li>
            </ul>
            <p className="mt-3">
              We do not use your data for profiling, advertising, training
              machine learning models, or any purpose beyond operating the
              Ontrifice service.
            </p>
          </section>

          <section>
            <h2
              id="data-we-do-not-collect"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              Data We Do Not Collect
            </h2>
            <p className="mb-3">
              Ontrifice does not use tracking cookies, fingerprinting, analytics
              services, or any third-party tracking of any kind. Specifically:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>No Google Analytics, Mixpanel, Segment, or similar services.</li>
              <li>
                No tracking pixels, advertising cookies, or cross-site
                identifiers.
              </li>
              <li>
                No browser fingerprinting or device identification beyond your
                IP address in server logs.
              </li>
              <li>
                No collection of browsing behavior, referral sources, or session
                recordings.
              </li>
            </ul>
            <p className="mt-3">
              The only cookie we set is a session cookie for authenticated users,
              which is strictly necessary for maintaining your login state and
              contains no tracking information.
            </p>
          </section>

          <section>
            <h2
              id="third-party-services"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              Third-Party Services
            </h2>
            <p className="mb-3">
              Ontrifice aggregates publicly available market data from
              Polymarket, Kalshi, and Limitless via their public APIs. We do not
              share your personal data with any of these providers or any other
              third party.
            </p>
            <p>
              Our infrastructure runs on standard cloud hosting. Your data is
              processed and stored within the hosting provider&apos;s
              infrastructure, subject to their standard data processing
              agreements. No personal data is sold, shared with, or made
              accessible to any other party.
            </p>
          </section>

          <section>
            <h2
              id="data-retention"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              Data Retention
            </h2>
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                <strong className="text-foreground">Account data</strong>{" "}
                (email, hashed password) is retained for as long as your account
                is active. Upon account deletion, this data is permanently
                removed within 30 days.
              </li>
              <li>
                <strong className="text-foreground">API usage logs</strong> are
                retained for 90 days and then automatically purged.
              </li>
              <li>
                <strong className="text-foreground">Server access logs</strong>{" "}
                (for unauthenticated users) are retained for 14 days.
              </li>
            </ul>
          </section>

          <section>
            <h2
              id="your-rights"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              Your Rights
            </h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                <strong className="text-foreground">Access</strong> the personal
                data we hold about you.
              </li>
              <li>
                <strong className="text-foreground">Correct</strong> inaccurate
                personal data.
              </li>
              <li>
                <strong className="text-foreground">Delete</strong> your
                account and all associated personal data.
              </li>
              <li>
                <strong className="text-foreground">Export</strong> your data in
                a machine-readable format.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{" "}
              <a href="mailto:privacy@ontrifice.com">privacy@ontrifice.com</a>.
              We will respond within 30 days. Account deletion requests are
              processed immediately and data is permanently removed within 30
              days of the request.
            </p>
          </section>

          <section>
            <h2
              id="contact"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              Contact
            </h2>
            <p>
              For questions or concerns about this privacy policy or our data
              practices, contact us at{" "}
              <a href="mailto:privacy@ontrifice.com">privacy@ontrifice.com</a>.
            </p>
          </section>

          <section>
            <h2
              id="changes-to-this-policy"
              className="font-mono text-base font-semibold text-foreground mb-4"
            >
              Changes to This Policy
            </h2>
            <p>
              We may update this privacy policy to reflect changes in our
              practices or for legal, operational, or regulatory reasons. If we
              make material changes, we will notify registered users by email
              before the changes take effect. The &ldquo;last updated&rdquo;
              date at the top of this page indicates when the policy was last
              revised.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
