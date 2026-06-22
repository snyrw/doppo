import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Doppo",
  description: "The terms that govern your use of Doppo.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 17, 2026">
      <h2>Agreement to our legal terms</h2>
      <p>
        We are Doppo, a sole proprietorship operated by William Snyder, located in Washington, United
        States (“we,” “us,” “our”). We operate the website https://doppo.tools (the “Site”), as well as
        any other related products and services that refer or link to these legal terms (the “Legal
        Terms”) (collectively, the “Services”).
      </p>
      <p>
        You can contact us by email at <a href="mailto:help@doppo.tools">help@doppo.tools</a>.
      </p>
      <p>
        These Legal Terms constitute a legally binding agreement made between you, whether personally or
        on behalf of an entity (“you”), and Doppo, concerning your access to and use of the Services. By
        accessing the Services, you agree that you have read, understood, and agreed to be bound by all
        of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY
        PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.
      </p>
      <p>
        We will provide you with prior notice of any scheduled changes to the Services you are using.
        The modified Legal Terms will become effective upon posting or notifying you by email at
        help@doppo.tools. By continuing to use the Services after the effective date of any changes, you
        agree to be bound by the modified terms.
      </p>
      <p>
        The Services are intended for users who are at least 18 years old. Persons under the age of 18
        are not permitted to use or register for the Services. We recommend that you print a copy of
        these Legal Terms for your records.
      </p>

      <h2>1. Our services</h2>
      <p>
        The information provided when using the Services is not intended for distribution to or use by
        any person or entity in any jurisdiction or country where such distribution or use would be
        contrary to law or regulation. Those who access the Services from other locations do so on their
        own initiative and are solely responsible for compliance with local laws. The Services are not
        tailored to comply with industry-specific regulations (HIPAA, FISMA, etc.), so if your
        interactions would be subject to such laws, you may not use the Services.
      </p>

      <h2>2. Intellectual property rights</h2>
      <p>
        We are the owner or licensee of all intellectual property rights in our Services, including all
        source code, databases, functionality, software, website designs, text, and graphics (the
        “Content”), as well as the trademarks, service marks, and logos contained therein (the “Marks”).
        Our Content and Marks are protected by copyright and trademark laws.
      </p>
      <p>
        Subject to your compliance with these Legal Terms, we grant you a non-exclusive,
        non-transferable, revocable license to access the Services and to use them, including for your
        own commercial, academic, or research purposes, in accordance with these Legal Terms. Except as
        set out here, no part of the Content or Marks may be copied, reproduced, republished, uploaded,
        posted, publicly displayed, encoded, translated, transmitted, distributed, sold, or otherwise
        exploited for any commercial purpose without our express prior written permission.
      </p>
      <p>
        <strong>Your submissions.</strong> By sending us any question, comment, suggestion, idea, or
        other feedback about the Services (“Submissions”), you agree we may use and share such feedback
        for any lawful purpose without compensation or acknowledgment to you. You warrant that you have
        the necessary rights to provide the Submission and that it does not constitute confidential
        information.
      </p>

      <h2>3. User representations</h2>
      <p>
        By using the Services, you represent and warrant that: (1) all registration information you
        submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of
        such information; (3) you have the legal capacity and agree to comply with these Legal Terms;
        (4) you are not a minor in the jurisdiction in which you reside; (5) you will not access the
        Services through automated or non-human means except as expressly permitted; (6) you will not
        use the Services for any illegal or unauthorized purpose; and (7) your use will not violate any
        applicable law or regulation.
      </p>

      <h2>4. User registration</h2>
      <p>
        You may be required to register to use the Services. You agree to keep your password
        confidential and will be responsible for all use of your account and password.
      </p>

      <h2>5. Purchases and payment</h2>
      <p>
        We accept the following forms of payment, processed by our third-party payment processor,
        Stripe: Visa, Mastercard, American Express, and Discover. We do not store your full card
        details.
      </p>
      <p>
        <strong>Compute credits.</strong> Access to GPU-based analyses is paid for using prepaid compute
        credits purchased through Stripe. Credits are consumed based on the GPU time your analyses use.
        Listed prices include the Stripe payment-processing fee (2.9% + $0.30), passed through at cost.
        <strong>
          {" "}Except where a refund is required by applicable law, all credit purchases are final and
          non-refundable, and credits are non-transferable and have no cash value.
        </strong>{" "}
        We may change prices or credit rates at any time; changes apply only prospectively and do not
        affect credits already purchased.
      </p>
      <p>
        You agree to provide current, complete, and accurate purchase and account information for all
        purchases, and to promptly update account and payment information. Sales tax will be added to
        the price of purchases where required. All payments shall be in US dollars. We reserve the right
        to refuse or cancel any order, and to correct any errors or mistakes in pricing even if we have
        already requested or received payment.
      </p>

      <h2>6. Prohibited activities</h2>
      <p>
        You may not access or use the Services for any purpose other than that for which we make the
        Services available. As a user of the Services, you agree not to:
      </p>
      <ul>
        <li>Resell, sublicense, or commercially redistribute the Services themselves, or use them to build, train, or operate a competing product or service.</li>
        <li>Systematically retrieve data or content from the Services to create a collection, compilation, or database without our written permission.</li>
        <li>Trick, defraud, or mislead us or other users, especially in any attempt to learn sensitive account information such as passwords.</li>
        <li>Circumvent, disable, or otherwise interfere with security-related features of the Services.</li>
        <li>Use any information obtained from the Services to harass, abuse, or harm another person.</li>
        <li>Make improper use of our support services or submit false reports of abuse or misconduct.</li>
        <li>Use the Services in a manner inconsistent with any applicable laws or regulations.</li>
        <li>Upload or transmit viruses, Trojan horses, or other material that interferes with the Services, or that acts as a passive or active information-collection mechanism.</li>
        <li>Engage in any unauthorized automated use of the system, or attempt to bypass measures designed to prevent or restrict access to the Services.</li>
        <li>Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising the Services.</li>
        <li>Interfere with, disrupt, or create an undue burden on the Services or connected networks.</li>
      </ul>

      <h2>7. User generated contributions</h2>
      <p>
        The Services allow you to create content such as prompts, model selections, projects, and
        canvases (“Contributions”). Most Contributions are private to your account. If you choose to use
        the sharing feature, the project you share becomes publicly accessible to anyone with the share
        link — <strong>do not share anything you want to keep private.</strong> When you create or make
        available any Contributions, you represent and warrant that:
      </p>
      <ul>
        <li>Your Contributions do not and will not infringe the proprietary rights of any third party, including copyright, patent, trademark, trade secret, or moral rights.</li>
        <li>You are the creator and owner of, or have the necessary licenses, rights, and permissions to use and authorize use of, your Contributions.</li>
        <li>Your Contributions are not false, inaccurate, or misleading.</li>
        <li>Your Contributions are not unsolicited or unauthorized advertising, spam, or other forms of solicitation.</li>
        <li>Your Contributions are not obscene, lewd, violent, harassing, libelous, or otherwise objectionable.</li>
        <li>Your Contributions do not violate any applicable law, regulation, or rule, or the privacy or publicity rights of any third party.</li>
      </ul>

      <h2>8. Contribution license</h2>
      <p>
        We do not assert any ownership over your Contributions. You retain full ownership of all of your
        Contributions and any intellectual property rights associated with them. We may access, store,
        process, and use your Contributions only as needed to operate the Services for you and in
        accordance with our Privacy Policy and your settings. You are solely responsible for your
        Contributions.
      </p>

      <h2>9. Third-party websites and content</h2>
      <p>
        The Services may contain links to third-party websites and content that are not investigated or
        monitored by us. We are not responsible for any third-party websites or content accessed through
        the Services, and inclusion of or linking to them does not imply our approval or endorsement. If
        you access third-party websites or content, you do so at your own risk, and these Legal Terms no
        longer govern.
      </p>

      <h2>10. Services management</h2>
      <p>
        We reserve the right, but not the obligation, to: (1) monitor the Services for violations of
        these Legal Terms; (2) take appropriate legal action against anyone who violates the law or
        these Legal Terms; (3) refuse, restrict, limit, or disable any of your Contributions; (4) remove
        or disable content that is excessive in size or burdensome to our systems; and (5) otherwise
        manage the Services to protect our rights and property and facilitate their proper functioning.
      </p>

      <h2>11. Privacy policy</h2>
      <p>
        We care about data privacy and security. Please review our{" "}
        <Link href="/privacy">Privacy Policy</Link>. By using the Services, you agree to be bound by our
        Privacy Policy, which is incorporated into these Legal Terms. The Services are hosted in the
        United States. If you access the Services from another region with laws governing personal data
        that differ from US law, through your continued use you are transferring your data to the United
        States and consent to have it processed there.
      </p>

      <h2>12. Term and termination</h2>
      <p>
        These Legal Terms remain in full force and effect while you use the Services. WITHOUT LIMITING
        ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND
        WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES TO ANY PERSON FOR ANY REASON,
        INCLUDING FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS
        OR OF ANY APPLICABLE LAW. We may terminate your use or delete your account at any time, without
        warning, in our sole discretion.
      </p>

      <h2>13. Modifications and interruptions</h2>
      <p>
        We reserve the right to change, modify, or remove the contents of the Services at any time or
        for any reason at our sole discretion without notice. We cannot guarantee the Services will be
        available at all times and will not be liable for any loss, damage, or inconvenience caused by
        your inability to access or use the Services during any downtime or discontinuance.
      </p>

      <h2>14. Governing law</h2>
      <p>
        These Legal Terms and your use of the Services are governed by and construed in accordance with
        the laws of the State of Washington, without regard to its conflict-of-law principles.
      </p>

      <h2>15. Dispute resolution</h2>
      <p>
        <strong>Informal negotiations.</strong> To expedite resolution and control cost, the parties
        agree to first attempt to negotiate any dispute informally for at least thirty (30) days before
        initiating arbitration.
      </p>
      <p>
        <strong>Binding arbitration.</strong> If the parties are unable to resolve a dispute through
        informal negotiations, the dispute will be finally and exclusively resolved by binding
        arbitration. YOU UNDERSTAND THAT WITHOUT THIS PROVISION, YOU WOULD HAVE THE RIGHT TO SUE IN COURT
        AND HAVE A JURY TRIAL. The arbitration will be conducted under the Commercial Arbitration Rules
        of the American Arbitration Association (AAA) and, where appropriate, the AAA’s Supplementary
        Procedures for Consumer Related Disputes. The arbitration will take place in King County,
        Washington.
      </p>
      <p>
        <strong>Restrictions.</strong> The parties agree that any arbitration will be limited to the
        dispute between them individually; no arbitration will be joined with any other, and there is no
        right for any dispute to be arbitrated on a class-action basis.
      </p>

      <h2>16. Corrections</h2>
      <p>
        There may be information on the Services that contains typographical errors, inaccuracies, or
        omissions, including descriptions, pricing, and availability. We reserve the right to correct
        any errors and to change or update the information on the Services at any time, without prior
        notice.
      </p>

      <h2>17. Disclaimer</h2>
      <p>
        THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE
        SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL
        WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING
        THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. WE MAKE NO WARRANTIES ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES’
        CONTENT, INCLUDING ANY MODEL OUTPUTS OR ANALYSES, WHICH ARE PROVIDED FOR RESEARCH AND
        EDUCATIONAL PURPOSES AND MAY BE INACCURATE. YOU SHOULD USE YOUR BEST JUDGMENT AND EXERCISE
        CAUTION WHERE APPROPRIATE.
      </p>

      <h2>18. Limitations of liability</h2>
      <p>
        IN NO EVENT WILL WE OR OUR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT,
        CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST
        REVENUE, OR LOSS OF DATA, ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF
        THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT WILL OUR TOTAL LIABILITY ARISING OUT OF OR RELATED
        TO THESE LEGAL TERMS OR THE SERVICES EXCEED THE GREATER OF (A) THE TOTAL FEES YOU PAID US IN THE
        TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) US $100.
      </p>

      <h2>19. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold us harmless, including our agents and employees, from
        and against any loss, damage, liability, claim, or demand, including reasonable attorneys’ fees
        and expenses, made by any third party due to or arising out of: (1) your use of the Services;
        (2) breach of these Legal Terms; (3) any breach of your representations and warranties; or (4)
        your violation of the rights of a third party.
      </p>

      <h2>20. User data</h2>
      <p>
        We will maintain certain data that you transmit to the Services for the purpose of managing the
        performance of the Services, as well as data relating to your use of the Services. Although we
        perform regular routine backups of data, you are solely responsible for all data that you
        transmit or that relates to any activity you have undertaken using the Services. You agree that
        we shall have no liability to you for any loss or corruption of any such data.
      </p>

      <h2>21. Electronic communications, transactions, and signatures</h2>
      <p>
        Visiting the Services, sending us emails, and completing online forms constitute electronic
        communications. You consent to receive electronic communications, and you agree that all
        agreements, notices, disclosures, and other communications we provide to you electronically
        satisfy any legal requirement that such communication be in writing. You consent to the use of
        electronic signatures, contracts, orders, and other records.
      </p>

      <h2>22. California users and residents</h2>
      <p>
        If any complaint with us is not satisfactorily resolved, you can contact the Complaint
        Assistance Unit of the Division of Consumer Services of the California Department of Consumer
        Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834 or by
        telephone at (800) 952-5210 or (916) 445-1254.
      </p>

      <h2>23. Miscellaneous</h2>
      <p>
        These Legal Terms and any policies or operating rules posted by us constitute the entire
        agreement and understanding between you and us. Our failure to exercise or enforce any right or
        provision of these Legal Terms shall not operate as a waiver of such right or provision. If any
        provision or part of a provision of these Legal Terms is determined to be unlawful, void, or
        unenforceable, that provision is deemed severable and does not affect the validity and
        enforceability of any remaining provisions. There is no joint venture, partnership, employment,
        or agency relationship created between you and us as a result of these Legal Terms.
      </p>

      <h2>24. Contact us</h2>
      <p>
        In order to resolve a complaint regarding the Services or to receive further information
        regarding use of the Services, please contact us at{" "}
        <a href="mailto:help@doppo.tools">help@doppo.tools</a>.
      </p>
    </LegalPage>
  );
}
