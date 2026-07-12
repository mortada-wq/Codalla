import { LegalPageLayout } from "@/components/legal-page-layout"

const SECTIONS = [
  { id: "acceptance", label: "1. Acceptance" },
  { id: "service", label: "2. The Service" },
  { id: "accounts", label: "3. Your Account" },
  { id: "acceptable-use", label: "4. Acceptable Use" },
  { id: "your-content", label: "5. Your Content" },
  { id: "third-parties", label: "6. Third-Party Services" },
  { id: "billing", label: "7. Plans & Billing" },
  { id: "cancellation", label: "8. Cancellation & Refunds" },
  { id: "ip", label: "9. Intellectual Property" },
  { id: "disclaimers", label: "10. Disclaimers" },
  { id: "liability", label: "11. Limitation of Liability" },
  { id: "indemnity", label: "12. Indemnification" },
  { id: "termination", label: "13. Termination" },
  { id: "changes", label: "14. Changes to These Terms" },
  { id: "governing-law", label: "15. Governing Law" },
  { id: "contact", label: "16. Contact" },
]

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="July 9, 2026" sections={SECTIONS}>
      <p>
        Welcome to Codalla. These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) govern your access to and use of
        Codalla&apos;s website, applications, APIs, and related services (collectively, the &ldquo;<strong>Service</strong>&rdquo;).
        By creating an account or otherwise accessing the Service, you agree to be bound by these Terms.
      </p>

      <h2 id="acceptance">1. Acceptance of Terms</h2>
      <p>
        By clicking &ldquo;Create account,&rdquo; &ldquo;Sign in,&rdquo; or otherwise using the Service, you (&ldquo;<strong>you</strong>&rdquo; or
        &ldquo;<strong>User</strong>&rdquo;) enter into a binding agreement with Codalla (&ldquo;<strong>Codalla</strong>,&rdquo; &ldquo;<strong>we</strong>,&rdquo;
        &ldquo;<strong>us</strong>,&rdquo; or &ldquo;<strong>our</strong>&rdquo;). If you are using the Service on behalf of an organization,
        you represent that you have authority to bind that organization to these Terms.
      </p>
      <p>
        You must be at least 13 years old (or the age of digital consent in your jurisdiction) to use the Service.
        If you are under 18, you must have permission from a parent or legal guardian.
      </p>

      <h2 id="service">2. The Service</h2>
      <p>
        Codalla is an AI-assisted coding workspace. It lets you connect to external AI model providers (such as
        OpenRouter, SiliconFlow, RunPod, or your own OpenAI-compatible endpoints), clone and edit code from GitHub,
        and organize your work in projects.
      </p>
      <p>
        The Service acts as a client that relays your prompts and code to the model provider(s) you configure.
        We do not operate or control the AI models themselves. Availability, response quality, and pricing of any
        given model depend on the third-party provider you have connected.
      </p>

      <h2 id="accounts">3. Your Account</h2>
      <p>You may sign in using email + password. You agree to:</p>
      <ul>
        <li>Provide accurate, current, and complete information;</li>
        <li>Keep your password confidential and choose one that is not shared with any other service;</li>
        <li>Notify us immediately at <a href="mailto:security@codalla.dev">security@codalla.dev</a> if you suspect unauthorized access to your account;</li>
        <li>Be responsible for all activity that occurs under your account.</li>
      </ul>
      <p>
        We may suspend or terminate accounts that we reasonably believe have been compromised, are being used to
        abuse the Service, or that violate these Terms.
      </p>

      <h2 id="acceptable-use">4. Acceptable Use</h2>
      <p>You will not, and will not attempt to:</p>
      <ul>
        <li>Use the Service to generate, distribute, or store content that is illegal, defamatory, harassing, hateful, or otherwise harmful;</li>
        <li>Circumvent, disable, or interfere with any security or usage-metering features of the Service;</li>
        <li>Reverse engineer, decompile, or attempt to extract the source code of the Service, except to the extent applicable law prohibits such restriction;</li>
        <li>Use the Service to build a product that directly replicates or competes with the Service;</li>
        <li>Share your account credentials or your paid seat with any other individual;</li>
        <li>Upload malware, or use the Service in a manner that consumes excessive resources or degrades performance for other users;</li>
        <li>Violate the terms of any AI model provider or third-party API you access via the Service.</li>
      </ul>

      <h2 id="your-content">5. Your Content</h2>
      <p>
        &ldquo;<strong>Your Content</strong>&rdquo; means the code, prompts, files, project descriptions, notes, and any other
        material you upload, create, or generate using the Service.
      </p>
      <p>
        <strong>You own Your Content.</strong> We claim no ownership over it. You grant Codalla a limited,
        non-exclusive, worldwide license to host, store, transmit, and process Your Content solely to provide
        the Service to you (for example: forwarding your prompt to your chosen AI provider, storing your project
        files on our servers, and displaying them back to you in the editor).
      </p>
      <p>
        <strong>We do not use Your Content to train AI models.</strong> We do not sell Your Content. We do not share
        Your Content with third parties except: (a) with model providers you explicitly configure, (b) with infrastructure
        providers processing data on our behalf under confidentiality obligations, or (c) as required by law.
      </p>
      <p>
        You are solely responsible for ensuring that Your Content — including any code you clone from GitHub or paste
        into the editor — complies with all applicable licenses and laws.
      </p>

      <h2 id="third-parties">6. Third-Party Services</h2>
      <p>
        The Service integrates with third-party providers, including but not limited to: OpenRouter, SiliconFlow,
        RunPod, GitHub, and Stripe. Your use of those services is governed by the respective providers&apos;
        terms and privacy policies. Codalla is not responsible for the availability, accuracy, or content of any
        third-party service.
      </p>
      <p>
        When you provide an API key or personal access token for a third-party service, you authorize Codalla to
        transmit requests to that service on your behalf, using that key. You are responsible for managing your keys
        (including revoking them if compromised) and for any charges the third-party service applies to your account
        with them.
      </p>

      <h2 id="billing">7. Plans & Billing</h2>
      <p>
        Codalla offers a free tier and paid subscription plans (currently <strong>Pro</strong> and <strong>Team</strong>).
        Paid plans include a monthly allowance of AI usage credits; additional credits can be purchased on a pay-as-you-go
        basis. Prices and included allowances are shown on the pricing page inside the app and may be updated from time to
        time upon notice.
      </p>
      <ul>
        <li><strong>Billing cycle.</strong> Subscriptions renew automatically on a monthly cycle until cancelled.</li>
        <li><strong>Payment provider.</strong> Payments are processed by Stripe. Codalla never stores your card details.</li>
        <li><strong>Credits.</strong> Included credits reset at the start of each billing cycle and do not roll over unless expressly stated. Top-up credits do not expire but are non-refundable and non-transferable.</li>
        <li><strong>Taxes.</strong> Prices exclude taxes unless stated. You are responsible for any applicable taxes.</li>
      </ul>

      <h2 id="cancellation">8. Cancellation & Refunds</h2>
      <p>
        You may cancel your paid subscription at any time from the <em>Settings → Billing</em> page. Cancellation takes
        effect at the end of the current billing period; you retain access to paid features until then. We do not
        provide pro-rated refunds for partially used months. If a payment fails, we may downgrade your account to the
        free tier until the payment is resolved.
      </p>
      <p>
        If you believe you were charged in error, contact <a href="mailto:billing@codalla.dev">billing@codalla.dev</a>
        within thirty (30) days of the charge and we will review the case in good faith.
      </p>

      <h2 id="ip">9. Intellectual Property</h2>
      <p>
        The Service, its user interface, the Codalla name and logo, and all associated designs, code, and
        documentation are the property of Codalla and its licensors, protected by copyright, trademark, and other
        laws. These Terms do not transfer any of those rights to you.
      </p>
      <p>
        You may not use the Codalla name or logo to imply endorsement, partnership, or sponsorship without our
        prior written consent.
      </p>

      <h2 id="disclaimers">10. Disclaimers</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo;</strong> and <strong>&ldquo;as available&rdquo;</strong>
        without warranties of any kind, whether express or implied, including implied warranties of merchantability,
        fitness for a particular purpose, and non-infringement.
      </p>
      <p>
        AI-generated code, suggestions, and explanations may be incorrect, incomplete, insecure, or infringing.
        You are responsible for reviewing, testing, and verifying all output before relying on it, and for any
        decisions or actions you take based on that output. Codalla does not provide legal, financial, medical,
        or professional advice via the Service.
      </p>

      <h2 id="liability">11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Codalla and its officers, directors, employees, and agents will
        not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for
        any loss of profits, revenue, data, goodwill, or business opportunity arising out of or related to your
        use of the Service, even if we have been advised of the possibility of such damages.
      </p>
      <p>
        Our aggregate liability for any claim arising out of or related to the Service will not exceed the greater
        of (a) the amount you paid Codalla in the twelve (12) months preceding the event giving rise to the claim,
        or (b) USD $100.
      </p>

      <h2 id="indemnity">12. Indemnification</h2>
      <p>
        You will defend, indemnify, and hold harmless Codalla from and against any third-party claims, damages,
        liabilities, and expenses (including reasonable attorneys&apos; fees) arising from: (a) Your Content, (b)
        your use of the Service in violation of these Terms, or (c) your violation of any law or the rights of a
        third party.
      </p>

      <h2 id="termination">13. Termination</h2>
      <p>
        You may terminate your account at any time from the <em>Settings → Profile → Danger zone</em> section, or
        by writing to <a href="mailto:support@codalla.dev">support@codalla.dev</a>. Upon termination, we will
        delete Your Content in accordance with our data-retention practices described in the Privacy Policy.
      </p>
      <p>
        We may suspend or terminate your access if you materially breach these Terms, if required by law, or if
        the Service is discontinued. Sections that by their nature should survive termination (including sections
        5, 9, 10, 11, 12, and 15) will do so.
      </p>

      <h2 id="changes">14. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material changes, we will notify you by email or via
        an in-app banner at least fourteen (14) days before they take effect. Your continued use of the Service after
        the effective date constitutes acceptance of the updated Terms. If you do not agree, you may cancel your
        account before the effective date.
      </p>

      <h2 id="governing-law">15. Governing Law & Disputes</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which Codalla is incorporated, without regard
        to its conflict-of-laws principles. The parties agree to submit to the exclusive jurisdiction of the
        competent courts of that jurisdiction, except that either party may seek injunctive relief in any court of
        competent jurisdiction to protect its intellectual property or confidential information.
      </p>
      <p>
        Nothing in these Terms limits your non-waivable statutory rights as a consumer in your country of residence.
      </p>

      <h2 id="contact">16. Contact</h2>
      <p>
        Questions about these Terms? Get in touch:
      </p>
      <ul>
        <li>General: <a href="mailto:hello@codalla.dev">hello@codalla.dev</a></li>
        <li>Legal: <a href="mailto:legal@codalla.dev">legal@codalla.dev</a></li>
        <li>Billing: <a href="mailto:billing@codalla.dev">billing@codalla.dev</a></li>
        <li>Security: <a href="mailto:security@codalla.dev">security@codalla.dev</a></li>
      </ul>

      <hr />
      <p className="text-[13px] text-muted-foreground">
        These Terms are drafted in plain language for readability. Some terminology (&ldquo;Service,&rdquo; &ldquo;User,&rdquo;
        &ldquo;Your Content&rdquo;) is defined to keep the document precise. Nothing in this document overrides the
        rights you have under mandatory local laws.
      </p>
    </LegalPageLayout>
  )
}
