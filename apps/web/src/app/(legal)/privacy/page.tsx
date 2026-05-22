import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Dine&Stay OS',
  description: 'How Dine&Stay OS collects, uses, and protects your personal data.',
};

const LAST_UPDATED = '1 June 2025';
const COMPANY      = 'Progressive Novus Private Limited';
const EMAIL        = 'privacy@dinestay.app';

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert prose-slate max-w-none">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-slate-400 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <Section title="1. Introduction">
        <p>
          {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates Dine&amp;Stay OS
          (the &ldquo;Service&rdquo;). This Privacy Policy explains what personal data we collect, how
          we use it, and your rights in relation to it. It applies to all users of the Service, including
          restaurant owners, staff, and any individuals whose data is processed through the Service.
        </p>
        <p>
          We comply with the <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong> and,
          where applicable, the <strong>General Data Protection Regulation (GDPR)</strong>.
        </p>
      </Section>

      <Section title="2. Data We Collect">
        <h3 className="text-white font-medium mb-2">2a. Account &amp; Business Data</h3>
        <ul>
          <li>Name, email address, phone number, business name, and GSTIN of account holders.</li>
          <li>Billing address and payment method metadata (we do not store full card numbers).</li>
          <li>Profile photos or business logos uploaded by you.</li>
        </ul>

        <h3 className="text-white font-medium mb-2 mt-4">2b. Operational Data</h3>
        <ul>
          <li>Orders, bills, menu items, inventory records, and shift data entered into the Service.</li>
          <li>Customer names and contact details optionally entered during billing.</li>
          <li>Staff records including names, roles, and employee codes.</li>
        </ul>

        <h3 className="text-white font-medium mb-2 mt-4">2c. Usage &amp; Technical Data</h3>
        <ul>
          <li>IP addresses, browser type, device identifiers, and access timestamps (server logs).</li>
          <li>Service usage patterns (features accessed, pages visited) — collected in aggregate.</li>
          <li>Error reports and crash diagnostics (collected when you report an issue).</li>
        </ul>

        <h3 className="text-white font-medium mb-2 mt-4">2d. Data We Do NOT Collect</h3>
        <ul>
          <li>Full payment card numbers (processed by Razorpay, not stored by us).</li>
          <li>Government ID documents (Aadhaar, Passport) — we only collect GSTIN/PAN for invoicing.</li>
          <li>Biometric data of any kind.</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 pr-4 text-slate-300">Purpose</th>
              <th className="text-left py-2 text-slate-300">Legal Basis (GDPR)</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            {[
              ['Providing and operating the Service', 'Contract performance'],
              ['Processing subscription payments', 'Contract performance'],
              ['Sending transactional emails (receipts, OTPs, password reset)', 'Contract performance'],
              ['Sending service notifications and updates', 'Legitimate interest'],
              ['Detecting fraud and security threats', 'Legitimate interest'],
              ['Improving the Service via aggregate analytics', 'Legitimate interest'],
              ['Complying with legal obligations (GST, tax)', 'Legal obligation'],
              ['Marketing communications (opt-in only)', 'Consent'],
            ].map(([purpose, basis]) => (
              <tr key={purpose} className="border-b border-slate-800">
                <td className="py-2 pr-4">{purpose}</td>
                <td className="py-2">{basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="4. Data Sharing">
        <p>We share your data with the following categories of third parties, under strict contractual obligations:</p>
        <ul>
          <li><strong>Razorpay</strong> — Payment processing. <a href="https://razorpay.com/privacy/" className="text-amber-400 hover:underline" target="_blank" rel="noopener noreferrer">Their privacy policy</a>.</li>
          <li><strong>MSG91</strong> — OTP and SMS delivery.</li>
          <li><strong>SMTP provider</strong> (configured by you) — Email delivery.</li>
          <li><strong>Cloud infrastructure</strong> (VPS/hosting provider you choose) — Data hosting.</li>
          <li><strong>Legal authorities</strong> — When required by law, court order, or government request.</li>
        </ul>
        <p>We <strong>do not</strong> sell, rent, or share your personal data with advertisers or data brokers.</p>
      </Section>

      <Section title="5. Data Retention">
        <ul>
          <li>Account data is retained for the duration of your subscription plus 3 years (for tax/legal compliance).</li>
          <li>Operational data (orders, bills) is retained for 7 years to comply with GST record-keeping requirements.</li>
          <li>Server logs are retained for 90 days.</li>
          <li>OTPs are deleted immediately after verification or upon expiry (10 minutes).</li>
          <li>On account closure, personal data is anonymised or deleted within 30 days unless retention is legally required.</li>
        </ul>
      </Section>

      <Section title="6. Your Rights">
        <p>Under the DPDPA and GDPR, you have the following rights:</p>
        <ul>
          <li><strong>Right to access</strong> — Request a copy of your personal data.</li>
          <li><strong>Right to correction</strong> — Request correction of inaccurate data.</li>
          <li><strong>Right to erasure</strong> — Request deletion of your data (subject to legal retention requirements).</li>
          <li><strong>Right to data portability</strong> — Export your operational data as CSV via Settings → Export.</li>
          <li><strong>Right to object</strong> — Object to processing based on legitimate interest.</li>
          <li><strong>Right to withdraw consent</strong> — For any processing based on consent (e.g. marketing).</li>
        </ul>
        <p>
          To exercise any of these rights, email us at{' '}
          <a href={`mailto:${EMAIL}`} className="text-amber-400 hover:underline">{EMAIL}</a>.
          We will respond within 30 days.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          The Service uses only <strong>strictly necessary cookies</strong> for session management and
          authentication. We do not use tracking, advertising, or analytics cookies. No cookie consent
          banner is required as we do not use non-essential cookies.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          We implement industry-standard security measures including:
        </p>
        <ul>
          <li>TLS encryption in transit (HTTPS enforced).</li>
          <li>bcrypt password hashing (12 rounds).</li>
          <li>JWT-based authentication with 15-minute access token expiry.</li>
          <li>Row-level tenant data isolation — each restaurant&rsquo;s data is logically separated.</li>
          <li>Rate limiting on authentication endpoints.</li>
        </ul>
        <p>
          No system is 100% secure. In the event of a data breach affecting your rights, we will notify
          you and the relevant authorities within 72 hours as required by law.
        </p>
      </Section>

      <Section title="9. International Data Transfers">
        <p>
          Data is stored on servers in India by default. If you use cloud storage providers (AWS S3,
          Cloudflare R2) configured in your account settings, data may be stored in other jurisdictions.
          You are responsible for ensuring appropriate transfer mechanisms are in place.
        </p>
      </Section>

      <Section title="10. Children">
        <p>
          The Service is not directed to individuals under 18. We do not knowingly collect personal data
          from minors. If you believe a minor has provided us personal data, contact us and we will
          delete it promptly.
        </p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>
          We may update this Privacy Policy. We will notify you of material changes by email at least
          14 days before they take effect. The &ldquo;last updated&rdquo; date at the top of this page
          will always reflect the current version.
        </p>
      </Section>

      <Section title="12. Contact & Grievance Officer">
        <p>
          For privacy-related queries, complaints, or to exercise your rights:
        </p>
        <address className="not-italic text-slate-400">
          <strong className="text-slate-300">Data Protection Officer</strong><br />
          {COMPANY}<br />
          Email: <a href={`mailto:${EMAIL}`} className="text-amber-400 hover:underline">{EMAIL}</a><br />
          Response time: within 30 days of receipt
        </address>
        <p className="mt-3">
          If you are not satisfied with our response, you may lodge a complaint with the
          <strong> Data Protection Board of India</strong> (once operational) or your national
          supervisory authority.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-slate-400 leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  );
}
