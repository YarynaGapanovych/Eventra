import { LegalPage, SupportContact } from "@/components/legal/legal-page";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Eventra",
};

export default function TermsPage() {
  return (
    <LegalPage title="Eventra Terms of Service">
      <section>
        <p>
          These terms apply to your use of Eventra, a calendar and
          task-management app. By creating an account or using Eventra, you
          agree to them.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You are responsible for keeping your sign-in details safe.</li>
          <li>
            You are responsible for the events, tasks and other content you add
            to Eventra, and for having the right to share any guest details you
            enter.
          </li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>Do not use Eventra to:</p>
        <ul>
          <li>break the law or infringe anyone&apos;s rights;</li>
          <li>send spam or unwanted invitations;</li>
          <li>attempt to access other people&apos;s accounts or data;</li>
          <li>disrupt or overload the service.</li>
        </ul>
      </section>

      <section>
        <h2>Google Calendar</h2>
        <p>
          Connecting Google Calendar is optional. How Eventra uses your Google
          data is described in the <Link href="/privacy">Privacy Policy</Link>.
          Your use of Google services is also subject to Google&apos;s terms.
        </p>
      </section>

      <section>
        <h2>Service availability</h2>
        <p>
          Eventra is provided &quot;as is&quot;, without warranties of any
          kind. We may change, suspend or stop the service, and we are not
          liable for lost data or indirect damages to the extent the law
          allows. Keep your own copies of important information.
        </p>
      </section>

      <section>
        <h2>Ending your use</h2>
        <p>
          You can stop using Eventra at any time and ask us to delete your
          account. We may suspend accounts that break these terms.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms and will post the new version here.
          Questions? Contact us at <SupportContact />.
        </p>
      </section>
    </LegalPage>
  );
}
