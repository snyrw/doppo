import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Doppo",
  description: "How Doppo collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 17, 2026">
      <p>
        This Privacy Notice for Doppo, operated by William Snyder, a sole proprietor located in
        Washington, United States (“we,” “us,” or “our”), describes how and why we might access,
        collect, store, use, and/or share (“process”) your personal information when you use our
        services (“Services”), including when you:
      </p>
      <ul>
        <li>Visit our website at doppo.tools, or any website of ours that links to this Privacy Notice</li>
        <li>Engage with us in other related ways, including any marketing or events</li>
      </ul>
      <p>
        <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand
        your privacy rights and choices. We are responsible for making decisions about how your
        personal information is processed. If you do not agree with our policies and practices, please
        do not use our Services. If you still have any questions or concerns, please contact us at{" "}
        <a href="mailto:help@doppo.tools">help@doppo.tools</a>.
      </p>

      <h2>Summary of key points</h2>
      <p>
        <strong>What personal information do we process?</strong> When you visit, use, or navigate our
        Services, we may process personal information depending on how you interact with us and the
        Services, the choices you make, and the products and features you use.
      </p>
      <p>
        <strong>Do we process any sensitive personal information?</strong> We do not process sensitive
        personal information.
      </p>
      <p>
        <strong>Do we collect any information from third parties?</strong> We receive limited profile
        information from GitHub if you choose to sign in with it; we do not otherwise collect
        information about you from third parties.
      </p>
      <p>
        <strong>How do we process your information?</strong> We process your information to provide,
        improve, and administer our Services, communicate with you, for security and fraud prevention,
        and to comply with law. We process your information only when we have a valid legal reason to
        do so.
      </p>
      <p>
        <strong>In what situations and with which parties do we share personal information?</strong> We
        may share information in specific situations and with specific third parties.
      </p>
      <p>
        <strong>How do we keep your information safe?</strong> We have organizational and technical
        processes and procedures in place to protect your personal information. However, no electronic
        transmission over the internet or information storage technology can be guaranteed to be 100%
        secure.
      </p>
      <p>
        <strong>What are your rights?</strong> Depending on where you are located geographically, the
        applicable privacy law may mean you have certain rights regarding your personal information.
      </p>
      <p>
        <strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by
        contacting us at <a href="mailto:help@doppo.tools">help@doppo.tools</a>. We will consider and
        act upon any request in accordance with applicable data protection laws.
      </p>

      <h2>1. What information do we collect?</h2>
      <p>
        <strong>Personal information you disclose to us.</strong> We collect personal information that
        you voluntarily provide to us when you register on the Services, express an interest in
        obtaining information about us or our Services, when you participate in activities on the
        Services, or otherwise when you contact us. The personal information we collect may include:
      </p>
      <ul>
        <li>names</li>
        <li>email addresses</li>
        <li>passwords</li>
        <li>usernames</li>
      </ul>
      <p>
        We also store the content you create through the Services — such as prompts, model selections,
        projects, and canvases — so we can show it back to you and re-run analyses.
      </p>
      <p>
        <strong>Sensitive information.</strong> We do not process sensitive information.
      </p>
      <p>
        <strong>Payment data.</strong> If you choose to make purchases, your payment is processed by
        Stripe. We do not receive or store your full card number; all payment card data is handled and
        stored by Stripe. We retain a record of the usage balance you purchase and your current balance. You
        may review Stripe’s privacy notice at{" "}
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">https://stripe.com/privacy</a>.
      </p>
      <p>
        <strong>Social login data.</strong> We provide you with the option to register using your
        GitHub account. If you choose to do this, we will collect certain profile information from
        GitHub as described in “How do we handle your social logins?” below.
      </p>
      <p>
        All personal information that you provide to us must be true, complete, and accurate, and you
        must notify us of any changes to such personal information.
      </p>
      <p>
        <strong>Cookies.</strong> We use a single essential session cookie to keep you logged in. We do
        not use analytics or advertising cookies, and we do not track you across other websites. Because
        this cookie is strictly necessary to provide the Services, no consent banner is required.
      </p>

      <h2>2. How do we process your information?</h2>
      <p>
        We process your personal information for a variety of reasons, depending on how you interact
        with our Services, including:
      </p>
      <ul>
        <li>
          <strong>To facilitate account creation and authentication and otherwise manage user
          accounts.</strong> So you can create and log in to your account and keep it in working order.
        </li>
        <li>
          <strong>To deliver and facilitate delivery of services.</strong> To run the model analyses
          you request and to process payments and track usage balances.
        </li>
        <li>
          <strong>To protect our Services.</strong> As part of our efforts to keep our Services safe
          and secure, including fraud monitoring and prevention.
        </li>
        <li>
          <strong>To comply with law</strong> and to protect an individual’s vital interests, such as
          to prevent harm.
        </li>
      </ul>

      <h2>3. What legal bases do we rely on to process your information?</h2>
      <p>
        <em>If you are located in the EU or UK,</em> the General Data Protection Regulation (GDPR) and
        UK GDPR require us to explain the valid legal bases we rely on to process your personal
        information. We may rely on the following:
      </p>
      <ul>
        <li>
          <strong>Consent.</strong> We may process your information if you have given us permission to
          use it for a specific purpose. You can withdraw your consent at any time.
        </li>
        <li>
          <strong>Performance of a contract.</strong> To provide you the Services you have requested.
        </li>
        <li>
          <strong>Legitimate interests.</strong> To diagnose problems, prevent fraudulent activity, and
          otherwise operate and improve the Services, where those interests do not override your rights.
        </li>
        <li>
          <strong>Legal obligations</strong> and <strong>vital interests</strong>, where necessary.
        </li>
      </ul>
      <p>
        <em>If you are located in Canada,</em> we may process your information with your express or
        implied consent. You may withdraw consent at any time. In some exceptional cases we may be
        permitted by law to process your information without consent — for example, for fraud detection
        and prevention, or where required to comply with a subpoena, warrant, or court order.
      </p>

      <h2>4. When and with whom do we share your personal information?</h2>
      <p>
        We share personal information with the following categories of third-party service providers
        who process it on our behalf, under a written contract:
      </p>
      <table>
        <thead>
          <tr><th>Provider</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td>Stripe</td><td>Payment processing</td></tr>
          <tr><td>Neon</td><td>Application database</td></tr>
          <tr><td>Railway</td><td>Application hosting</td></tr>
          <tr><td>Modal</td><td>Serverless GPU compute that runs analyses</td></tr>
          <tr><td>Cloudflare (R2)</td><td>Storage of cached analysis results</td></tr>
          <tr><td>Hugging Face</td><td>Source of the open model weights we load</td></tr>
          <tr><td>Anthropic</td><td>Optional AI generation of contrastive prompt pairs</td></tr>
          <tr><td>Resend</td><td>Transactional email delivery</td></tr>
          <tr><td>Sentry</td><td>Error monitoring and crash reporting</td></tr>
          <tr><td>GitHub</td><td>Optional sign-in (OAuth)</td></tr>
        </tbody>
      </table>
      <p>
        We may also share or transfer your information in connection with, or during negotiations of,
        any merger, sale of company assets, financing, or acquisition of all or a portion of our
        business to another company (a “business transfer”). We do not sell your personal information.
      </p>

      <h2>5. Do we offer artificial intelligence-based products?</h2>
      <p>
        As part of our Services, we offer features powered by artificial intelligence and machine
        learning (“AI Products”) for the purpose of AI interpretability research. We process these as
        follows:
      </p>
      <ul>
        <li>
          Open-weight models are downloaded from <strong>Hugging Face</strong> and run on our own GPU
          infrastructure provided by <strong>Modal</strong>. Your prompts are processed on that
          infrastructure and are <strong>not</strong> sent to Hugging Face.
        </li>
        <li>
          Separately, an optional feature that generates contrastive prompt pairs sends the text you
          provide to <strong>Anthropic</strong> (Claude) to produce those pairs.
        </li>
      </ul>
      <p>
        You must not use the AI Products in a way that violates the terms or policies of Hugging Face,
        Modal, or Anthropic.
      </p>

      <h2>6. How do we handle your social logins?</h2>
      <p>
        Our Services offer you the ability to register and log in using your GitHub account. Where you
        choose to do this, we will receive certain profile information from GitHub — typically your
        name, username, email address, and profile picture. We will use the information we receive only
        for the purposes described in this Privacy Notice. We do not control, and are not responsible
        for, other uses of your personal information by GitHub. We recommend you review GitHub’s privacy
        notice to understand how it collects, uses, and shares your personal information.
      </p>

      <h2>7. How long do we keep your information?</h2>
      <p>
        We keep your personal information for as long as it is necessary for the purposes set out in
        this Privacy Notice, unless a longer retention period is required or permitted by law (such as
        tax or accounting requirements). When we have no ongoing legitimate business need to process
        your personal information, we will either delete or anonymize it, or, if that is not possible
        (for example, because it has been stored in backup archives), securely store it and isolate it
        from further processing until deletion is possible.
      </p>

      <h2>8. How do we keep your information safe?</h2>
      <p>
        We have implemented appropriate and reasonable technical and organizational security measures
        designed to protect the security of any personal information we process. However, despite our
        safeguards, no electronic transmission over the internet or information storage technology can
        be guaranteed to be 100% secure, so we cannot promise or guarantee that unauthorized third
        parties will not be able to defeat our security. You should only access the Services within a
        secure environment.
      </p>

      <h2>9. Do we collect information from minors?</h2>
      <p>
        We do not knowingly collect, solicit data from, or market to children under 18 years of age,
        nor do we knowingly sell such personal information. By using the Services, you represent that
        you are at least 18, or that you are the parent or guardian of such a minor and consent to
        their use of the Services. If we learn that personal information from users under 18 has been
        collected, we will deactivate the account and take reasonable measures to promptly delete such
        data. If you become aware of any data we may have collected from children under 18, please
        contact us at <a href="mailto:help@doppo.tools">help@doppo.tools</a>.
      </p>

      <h2>10. What are your privacy rights?</h2>
      <p>
        In some regions (like the EEA, UK, Switzerland, and Canada), you have certain rights under
        applicable data protection laws. These may include the right to request access to and obtain a
        copy of your personal information, to request rectification or erasure, to restrict the
        processing of your personal information, to data portability, and not to be subject to
        automated decision-making. You can make such a request by contacting us at{" "}
        <a href="mailto:help@doppo.tools">help@doppo.tools</a>.
      </p>
      <p>
        If you are located in the EEA or UK and believe we are unlawfully processing your personal
        information, you also have the right to complain to your local data protection authority. If
        you are in Switzerland, you may contact the Federal Data Protection and Information
        Commissioner.
      </p>
      <p>
        <strong>Withdrawing your consent.</strong> If we are relying on your consent, you have the right
        to withdraw it at any time by contacting us. This will not affect the lawfulness of processing
        before its withdrawal.
      </p>
      <p>
        <strong>Account information.</strong> You may review or change the information in your account
        or terminate your account at any time by logging in to your account settings. Upon your request
        to terminate your account, we will deactivate or delete your account and information from our
        active databases. We may retain some information to prevent fraud, troubleshoot problems,
        assist with investigations, enforce our legal terms, and/or comply with applicable legal
        requirements.
      </p>

      <h2>11. Controls for do-not-track features</h2>
      <p>
        Most web browsers include a Do-Not-Track (“DNT”) feature. At this stage, no uniform technology
        standard for recognizing and implementing DNT signals has been finalized. As such, we do not
        currently respond to DNT browser signals. If a standard is adopted that we must follow in the
        future, we will inform you about that practice in a revised version of this Privacy Notice.
      </p>

      <h2>12. Do United States residents have specific privacy rights?</h2>
      <p>
        If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa,
        Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode
        Island, Tennessee, Texas, Utah, or Virginia, you may have the right to request access to and
        receive details about the personal information we maintain about you, correct inaccuracies, get
        a copy of, or delete your personal information, and to withdraw your consent. The categories of
        personal information we have collected are:
      </p>
      <table>
        <thead>
          <tr><th>Category</th><th>Examples</th><th>Collected</th></tr>
        </thead>
        <tbody>
          <tr><td>A. Identifiers</td><td>Name, online identifier, IP address, email address, account name</td><td>YES</td></tr>
          <tr><td>B. Personal information (California Customer Records statute)</td><td>Name, contact information, financial information</td><td>NO</td></tr>
          <tr><td>C. Protected classification characteristics</td><td>Gender, age, race, demographic data</td><td>NO</td></tr>
          <tr><td>D. Commercial information</td><td>Transaction information and purchase history</td><td>YES</td></tr>
          <tr><td>E. Biometric information</td><td>Fingerprints and voiceprints</td><td>NO</td></tr>
          <tr><td>F. Internet or other network activity</td><td>Browsing history, search history, online behavior</td><td>NO</td></tr>
          <tr><td>G. Geolocation data</td><td>Device location</td><td>NO</td></tr>
          <tr><td>H. Audio, electronic, sensory information</td><td>Images and audio or video recordings</td><td>NO</td></tr>
          <tr><td>I. Professional or employment information</td><td>Job title, work history</td><td>NO</td></tr>
          <tr><td>J. Education information</td><td>Student records</td><td>NO</td></tr>
          <tr><td>K. Inferences</td><td>Profiles reflecting preferences and characteristics</td><td>NO</td></tr>
          <tr><td>L. Sensitive personal information</td><td>—</td><td>NO</td></tr>
        </tbody>
      </table>
      <p>
        We have not sold or shared personal information to third parties for a business or commercial
        purpose in the preceding twelve (12) months, and will not sell or share personal information in
        the future. To exercise your rights, email us at{" "}
        <a href="mailto:help@doppo.tools">help@doppo.tools</a>. We will verify your identity before
        acting on a request. If we decline to take action, you may appeal by emailing us at the same
        address; if your appeal is denied, you may submit a complaint to your state attorney general.
      </p>

      <h2>13. Do other regions have specific privacy rights?</h2>
      <p>
        <strong>Australia and New Zealand.</strong> We collect and process your personal information
        under Australia’s Privacy Act 1988 and New Zealand’s Privacy Act 2020. At any time, you have the
        right to request access to or correction of your personal information by contacting us. If you
        believe we are unlawfully processing your personal information, you may complain to the Office
        of the Australian Information Commissioner or the Office of the New Zealand Privacy
        Commissioner.
      </p>
      <p>
        <strong>Republic of South Africa.</strong> At any time, you have the right to request access to
        or correction of your personal information by contacting us. If you are unsatisfied with how we
        address a complaint, you can contact the Information Regulator (South Africa).
      </p>

      <h2>14. Do we make updates to this notice?</h2>
      <p>
        We may update this Privacy Notice from time to time. The updated version will be indicated by an
        updated date at the top of this Privacy Notice. If we make material changes, we may notify you
        either by prominently posting a notice or by directly sending you a notification.
      </p>

      <h2>15. How can you contact us about this notice?</h2>
      <p>
        If you have questions or comments about this notice, you may email us at{" "}
        <a href="mailto:help@doppo.tools">help@doppo.tools</a>.
      </p>

      <h2>16. How can you review, update, or delete the data we collect from you?</h2>
      <p>
        Based on the applicable laws of your country or US state of residence, you may have the right to
        request access to the personal information we collect from you, details about how we have
        processed it, correct inaccuracies, or delete your personal information. You may also have the
        right to withdraw your consent. To request to review, update, or delete your personal
        information, email us at <a href="mailto:help@doppo.tools">help@doppo.tools</a>.
      </p>
      <p>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
