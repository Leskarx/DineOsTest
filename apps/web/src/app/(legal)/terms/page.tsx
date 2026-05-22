import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Dine&Stay OS',
  description: 'Terms and conditions for using Dine&Stay OS restaurant management software.',
};

const LAST_UPDATED = '1 June 2025';
const COMPANY      = 'Progressive Novus Private Limited';
const EMAIL        = 'legal@dinestay.app';
const ADDRESS      = 'Bengaluru, Karnataka, India';

export default function TermsPage() {
  return (
    <article className="prose prose-invert prose-slate max-w-none">
      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-slate-400 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <Section title="1. Acceptance of Terms">
        <p>
          By registering for, accessing, or using Dine&amp;Stay OS (the &ldquo;Service&rdquo;), you agree to be
          bound by these Terms of Service (&ldquo;Terms&rdquo;) and our{' '}
          <a href="/privacy" className="text-amber-400 hover:underline">Privacy Policy</a>.
          If you are using the Service on behalf of an organisation, you represent that you have the
          authority to bind that organisation to these Terms. If you do not agree to these Terms,
          do not use the Service.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          Dine&amp;Stay OS is a cloud-based Software-as-a-Service (SaaS) platform providing restaurant
          point-of-sale, kitchen display, billing, inventory, and hotel management features to food
          service businesses. The Service is provided by {COMPANY}, registered in India.
        </p>
      </Section>

      <Section title="3. Account Registration">
        <ul>
          <li>You must provide accurate, current, and complete information during registration.</li>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You must notify us immediately at <a href={`mailto:${EMAIL}`} className="text-amber-400">{EMAIL}</a> if you suspect unauthorised access.</li>
          <li>You must be at least 18 years old and legally capable of entering a contract.</li>
        </ul>
      </Section>

      <Section title="4. Subscription and Payment">
        <ul>
          <li>
            The Service is offered on a subscription basis. Fees are billed in advance on a monthly or
            annual cycle, as selected at checkout.
          </li>
          <li>
            Payments are processed by Razorpay. By providing payment information you authorise us to
            charge the applicable subscription fees.
          </li>
          <li>
            All fees are quoted in Indian Rupees (INR) and are exclusive of applicable taxes
            (GST at the prevailing rate).
          </li>
          <li>
            Subscriptions renew automatically unless cancelled at least 24 hours before the renewal date.
          </li>
          <li>
            We reserve the right to change pricing with 30 days&rsquo; notice. Continued use after the
            notice period constitutes acceptance of the new pricing.
          </li>
          <li>
            <strong>Refund policy:</strong> Refunds are issued at our sole discretion. Trial periods
            are not refundable. Annual subscriptions may be refunded pro-rata within 14 days of purchase
            if the Service is materially non-functional.
          </li>
        </ul>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of applicable laws.</li>
          <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure.</li>
          <li>Reverse-engineer, decompile, or disassemble the Service.</li>
          <li>Upload or transmit malicious code, viruses, or harmful data.</li>
          <li>Resell or sublicense the Service without our written consent.</li>
          <li>Interfere with the integrity or performance of the Service.</li>
        </ul>
      </Section>

      <Section title="6. Data Ownership and Licence">
        <p>
          <strong>Your data is yours.</strong> You retain all ownership rights to the business data
          you input into the Service (orders, menus, customer records, inventory, etc.).
        </p>
        <p>
          You grant {COMPANY} a limited, non-exclusive licence to store, process, and transmit your
          data solely to provide the Service. We do not sell your data to third parties.
        </p>
        <p>
          Upon termination, you may export your data (in CSV format) for up to 30 days. After that
          period we may delete your data from our systems.
        </p>
      </Section>

      <Section title="7. Confidentiality">
        <p>
          Each party agrees to keep the other&rsquo;s confidential information secret and to use it only
          in connection with the Service. This obligation does not apply to information that is publicly
          available or independently developed without reference to confidential information.
        </p>
      </Section>

      <Section title="8. Intellectual Property">
        <p>
          All rights, title, and interest in the Service (including the software, trademarks, and
          documentation) remain with {COMPANY}. Nothing in these Terms grants you any right to our
          intellectual property except the limited right to use the Service as described herein.
        </p>
      </Section>

      <Section title="9. Uptime and Service Level">
        <p>
          We target 99.5% monthly uptime, excluding scheduled maintenance and circumstances beyond our
          reasonable control. We will endeavour to notify you of planned maintenance at least 48 hours
          in advance via email or in-app notice.
        </p>
        <p>
          The Service is provided &ldquo;as is&rdquo;. We do not warrant that the Service will be
          uninterrupted, error-free, or meet your specific requirements.
        </p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, {COMPANY} and its officers, directors, employees, and
          agents shall not be liable for any indirect, incidental, special, consequential, or punitive
          damages (including loss of profits, data, or goodwill) arising from your use of the Service,
          even if advised of the possibility of such damages.
        </p>
        <p>
          Our total aggregate liability to you for any claim arising from these Terms or the Service
          shall not exceed the amount you paid us in the three months preceding the claim.
        </p>
      </Section>

      <Section title="11. Indemnification">
        <p>
          You agree to indemnify and hold harmless {COMPANY} from any claims, damages, and expenses
          (including legal fees) arising out of your use of the Service, your violation of these Terms,
          or your violation of any third-party rights.
        </p>
      </Section>

      <Section title="12. Termination">
        <ul>
          <li>
            <strong>By you:</strong> You may cancel your subscription at any time through the
            Settings → Subscription page. Cancellation takes effect at the end of the current billing
            period.
          </li>
          <li>
            <strong>By us:</strong> We may suspend or terminate your account immediately if you breach
            these Terms, fail to pay subscription fees, or engage in conduct that we reasonably believe
            harms the Service or other users.
          </li>
        </ul>
      </Section>

      <Section title="13. Governing Law and Dispute Resolution">
        <p>
          These Terms are governed by the laws of India. Any dispute shall first be attempted to be
          resolved by good-faith negotiation. If unresolved within 30 days, disputes shall be subject
          to the exclusive jurisdiction of the courts in Bengaluru, Karnataka, India.
        </p>
      </Section>

      <Section title="14. Changes to Terms">
        <p>
          We may update these Terms from time to time. We will notify you of material changes via email
          or in-app notice at least 14 days before they take effect. Continued use of the Service after
          the effective date constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="15. Contact">
        <p>
          For questions about these Terms, please contact us:
        </p>
        <address className="not-italic text-slate-400">
          {COMPANY}<br />
          {ADDRESS}<br />
          Email: <a href={`mailto:${EMAIL}`} className="text-amber-400 hover:underline">{EMAIL}</a>
        </address>
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
