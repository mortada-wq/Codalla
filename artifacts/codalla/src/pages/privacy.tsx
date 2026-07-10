import { LegalPageLayout } from "@/components/legal-page-layout"

const SECTIONS = [
  { id: "summary", label: "TL;DR" },
  { id: "who", label: "1. Who we are" },
  { id: "collect", label: "2. What we collect" },
  { id: "use", label: "3. How we use it" },
  { id: "share", label: "4. Who we share it with" },
  { id: "ai", label: "5. AI providers" },
  { id: "cookies", label: "6. Cookies & sessions" },
  { id: "retention", label: "7. Data retention" },
  { id: "security", label: "8. Security" },
  { id: "rights", label: "9. Your rights" },
  { id: "children", label: "10. Children" },
  { id: "international", label: "11. International transfers" },
  { id: "changes", label: "12. Changes" },
  { id: "contact", label: "13. Contact us" },
]

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="July 9, 2026" sections={SECTIONS}>
      <h2 id="summary">TL;DR</h2>
      <blockquote>
        We collect the minimum data required to run Codalla for you: your email + name, your project
        files, and API-usage counters. We <strong>do not</strong> train AI models on Your Content and
        we <strong>do not</strong> sell your data. Your prompts and code are forwarded to whichever
        AI provider you configure. You can export or delete your data at any time.
      </blockquote>

      <h2 id="who">1. Who we are</h2>
      <p>
        This Privacy Policy describes how <strong>Codalla</strong> (&ldquo;<strong>we</strong>,&rdquo;
        &ldquo;<strong>us</strong>,&rdquo; or &ldquo;<strong>Codalla</strong>&rdquo;) collects, uses,
        and shares personal information when you visit our website or use the Codalla application
        (collectively, the &ldquo;<strong>Service</strong>&rdquo;).
      </p>
      <p>
        For the purposes of the EU GDPR and the UK GDPR, Codalla is the &ldquo;data controller&rdquo;
        of the personal information described in this policy. For CCPA purposes, Codalla is the
        &ldquo;business.&rdquo;
      </p>

      <h2 id="collect">2. What we collect</h2>
      <p>We collect only the information we need to operate the Service.</p>

      <h3>a) Account information</h3>
      <ul>
        <li>Email address, display name, and password hash (bcrypt — we never see your plain password);</li>
        <li>Optional profile fields you fill in: avatar URL, bio, GitHub handle, timezone, organization name;</li>
        <li>If you sign in with Google: your Google account ID, name, email, and profile picture URL (returned to us by Google after you consent);</li>
        <li>Role and org membership (currently &ldquo;owner&rdquo; for all accounts).</li>
      </ul>

      <h3>b) Your Content</h3>
      <ul>
        <li>Projects you create, including project name, description, story, target, and success criteria;</li>
        <li>Files you upload, edit, or clone into the workspace;</li>
        <li>Prompts you send to AI models and the responses you receive;</li>
        <li>Memory notes, conversations, and other content generated inside a project.</li>
      </ul>

      <h3>c) Third-party credentials (encrypted at rest, sent only to the provider they belong to)</h3>
      <ul>
        <li>API keys for AI model providers (OpenRouter, SiliconFlow, RunPod, custom endpoints);</li>
        <li>GitHub personal access tokens (used only to clone/push repos you own).</li>
      </ul>

      <h3>d) Usage & billing</h3>
      <ul>
        <li>Model calls: model name, provider, prompt & completion token counts, cost estimate, timestamp;</li>
        <li>Login timestamps and IP-address-based brute-force counters (kept only while relevant);</li>
        <li>If you pay for a plan: Stripe customer ID, subscription status, transaction receipts (Stripe handles your card details — we never touch them).</li>
      </ul>

      <h3>e) Technical logs</h3>
      <ul>
        <li>Request logs with route, HTTP status, and response time — used for reliability and abuse detection;</li>
        <li>Browser-provided data (user-agent, screen size, language) used for basic diagnostics.</li>
      </ul>

      <h2 id="use">3. How we use it</h2>
      <p>We process the data above for these purposes:</p>
      <ul>
        <li><strong>Providing the Service</strong> — running your projects, forwarding prompts to model providers, saving files, syncing with GitHub. <em>Legal basis: contract performance.</em></li>
        <li><strong>Account security</strong> — password hashing, session tokens, brute-force protection. <em>Legal basis: legitimate interests.</em></li>
        <li><strong>Billing</strong> — processing subscriptions and top-ups via Stripe. <em>Legal basis: contract performance.</em></li>
        <li><strong>Customer support</strong> — responding to questions and diagnosing issues you report. <em>Legal basis: legitimate interests + your consent.</em></li>
        <li><strong>Product improvement (aggregated only)</strong> — analysing anonymised usage patterns to fix bugs and prioritise features. Aggregates cannot be re-associated with any individual user. <em>Legal basis: legitimate interests.</em></li>
        <li><strong>Legal & compliance</strong> — responding to lawful requests and enforcing our Terms. <em>Legal basis: legal obligation / legitimate interests.</em></li>
      </ul>
      <p>
        <strong>What we do not do:</strong> we do not train, fine-tune, or evaluate any AI model on Your
        Content. We do not sell your personal data. We do not use Your Content for advertising.
      </p>

      <h2 id="share">4. Who we share it with</h2>
      <p>We share personal data only with the following categories of recipients:</p>
      <ul>
        <li><strong>Infrastructure providers</strong> — our cloud host and database provider process data on our behalf under written data-processing agreements.</li>
        <li><strong>Payment processor</strong> — Stripe (see <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer">stripe.com/privacy</a>) processes payments; we exchange your customer ID, plan, and email with Stripe.</li>
        <li><strong>AI model providers you configure</strong> — see the next section.</li>
        <li><strong>Authentication provider</strong> — if you sign in with Google, Google returns your profile data to us. See <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google&apos;s privacy policy</a>.</li>
        <li><strong>Legal or safety recipients</strong> — regulators, law enforcement, or others where we are legally compelled or where disclosure is necessary to prevent imminent harm.</li>
      </ul>

      <h2 id="ai">5. AI providers</h2>
      <p>
        The Service is designed to relay your prompts and code to AI models operated by third parties (OpenRouter,
        SiliconFlow, RunPod, or any OpenAI-compatible endpoint you configure). <strong>You choose which provider(s)
        to use.</strong>
      </p>
      <p>
        Each provider has its own privacy and data-retention practices. When you send a prompt, that provider
        receives:
      </p>
      <ul>
        <li>Your prompt text and any context you attach (open file, memory notes, project story, success criteria);</li>
        <li>Their API key you supplied — used to authenticate the request;</li>
        <li>A generic HTTP referer header (e.g. <code>https://codalla.app</code>) so they can attribute usage.</li>
      </ul>
      <p>
        We do not send them your Codalla account email, name, or profile fields. Before connecting a provider,
        please review their privacy policy — most notably whether they log prompts, whether they train on
        submitted content, and how long they retain requests.
      </p>

      <h2 id="cookies">6. Cookies & sessions</h2>
      <p>We use a small number of strictly necessary cookies. There is no advertising or analytics tracking.</p>
      <ul>
        <li><code>access_token</code> — HTTP-only JWT that keeps you signed in (15 minute lifetime, renewed automatically).</li>
        <li><code>refresh_token</code> — HTTP-only JWT used to renew your session (7 day lifetime).</li>
      </ul>
      <p>Both cookies are <code>SameSite=Lax</code>, <code>Secure</code> in production, and cannot be read by JavaScript.</p>

      <h2 id="retention">7. Data retention</h2>
      <ul>
        <li><strong>Account &amp; profile:</strong> retained while your account is active. Deleted within 30 days after you delete your account.</li>
        <li><strong>Your Content (projects, files, conversations, memory notes):</strong> retained while the project exists; deleted when you delete the project.</li>
        <li><strong>Third-party API keys:</strong> retained until you delete them from the API Keys tab.</li>
        <li><strong>Usage logs (billing meters):</strong> retained for up to 24 months for accurate billing and dispute resolution.</li>
        <li><strong>Payment records:</strong> retained per applicable tax law (typically 7–10 years) in Stripe and in our billing database.</li>
        <li><strong>Security logs (login attempts, request logs):</strong> retained up to 90 days.</li>
      </ul>

      <h2 id="security">8. Security</h2>
      <p>
        We use industry-standard controls to protect your data:
      </p>
      <ul>
        <li>All traffic is served over HTTPS with modern TLS;</li>
        <li>Passwords are hashed with bcrypt (never stored in plaintext, never logged);</li>
        <li>Session tokens are stored in HTTP-only cookies not accessible to JavaScript;</li>
        <li>Failed logins are rate-limited with automatic lockout;</li>
        <li>Access to production systems is limited, logged, and requires MFA.</li>
      </ul>
      <p>
        No system is perfectly secure. If you become aware of a vulnerability, please write to
        <a href="mailto:security@codalla.dev"> security@codalla.dev</a>. We disclose confirmed breaches to
        affected users without undue delay, as required by applicable law.
      </p>

      <h2 id="rights">9. Your rights</h2>
      <p>
        Depending on where you live, you have some or all of the following rights over your personal data:
      </p>
      <ul>
        <li><strong>Access</strong> — request a copy of the personal data we hold about you;</li>
        <li><strong>Rectification</strong> — correct inaccurate or incomplete data (many fields you can edit yourself in <em>Settings → Profile</em>);</li>
        <li><strong>Erasure</strong> — request deletion of your account and personal data;</li>
        <li><strong>Portability</strong> — request an export of Your Content in a machine-readable format;</li>
        <li><strong>Restriction / objection</strong> — restrict or object to certain processing;</li>
        <li><strong>Withdraw consent</strong> — for any processing based on consent;</li>
        <li><strong>Lodge a complaint</strong> — with your local data-protection authority (in the EU/UK).</li>
      </ul>
      <p>
        To exercise these rights, email <a href="mailto:privacy@codalla.dev">privacy@codalla.dev</a>. We will
        respond within 30 days. We may ask you to verify your identity before acting on the request.
      </p>

      <h2 id="children">10. Children</h2>
      <p>
        The Service is not directed to children under 13, and we do not knowingly collect personal information
        from children under 13 (or 16 where required by local law). If you believe a child has provided us with
        personal information, contact us and we will delete it.
      </p>

      <h2 id="international">11. International transfers</h2>
      <p>
        Codalla operates globally. Your personal data may be processed in countries other than your own.
        When we transfer personal data from the European Economic Area, the United Kingdom, or Switzerland
        to third countries, we rely on the European Commission&apos;s Standard Contractual Clauses (SCCs)
        or another lawful transfer mechanism.
      </p>

      <h2 id="changes">12. Changes</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material changes, we will notify you
        by email or via an in-app banner at least 14 days before the changes take effect. The &ldquo;Last
        updated&rdquo; date at the top of this page reflects the most recent version.
      </p>

      <h2 id="contact">13. Contact us</h2>
      <ul>
        <li>Privacy inquiries: <a href="mailto:privacy@codalla.dev">privacy@codalla.dev</a></li>
        <li>Security disclosures: <a href="mailto:security@codalla.dev">security@codalla.dev</a></li>
        <li>Data-protection requests: <a href="mailto:dpo@codalla.dev">dpo@codalla.dev</a></li>
      </ul>

      <hr />
      <p className="text-[13px] text-muted-foreground">
        This policy is written in plain language and is intended to be read by humans, not just lawyers.
        Nothing in it overrides the rights you have under mandatory local privacy laws (GDPR, UK GDPR,
        CCPA, PIPEDA, LGPD, etc.).
      </p>
    </LegalPageLayout>
  )
}
