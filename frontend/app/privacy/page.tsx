import { LegalPage, SupportContact } from "@/components/legal/legal-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Eventra",
  description: "How Eventra collects, uses, stores and deletes your data, including Google Calendar data.",
};

const GOOGLE_USER_DATA_POLICY =
  "https://developers.google.com/terms/api-services-user-data-policy";

export default function PrivacyPage() {
  return (
    <LegalPage title="Eventra Privacy Policy">
      <section>
        <p>
          Eventra is a calendar and task-management app for scheduling events,
          tasks and meetings. This policy explains what information Eventra
          collects, how it is used, who it is shared with, and how you can
          delete it.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> your name and email address.
            If you sign up with a password, we store only a secure hash of it.
            If you sign in with Google, we receive your Google account ID, name
            and email address.
          </li>
          <li>
            <strong>Content you create:</strong> events, tasks, guests,
            reminders, settings, and messages you send to the Eventra AI
            assistant.
          </li>
          <li>
            <strong>Google Calendar data</strong>, only if you choose to connect
            Google Calendar (described below).
          </li>
        </ul>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          Connecting Google Calendar is optional. When you connect it, you
          grant Eventra access through Google OAuth with these scopes:
        </p>
        <ul>
          <li>
            <code>https://www.googleapis.com/auth/calendar</code> and{" "}
            <code>https://www.googleapis.com/auth/calendar.events</code>
          </li>
        </ul>
        <p>With that access, Eventra:</p>
        <ul>
          <li>
            <strong>Reads</strong> events from your primary Google Calendar
            within the date range you choose in Settings (title, description,
            time, location, guests, reminders, color, recurrence and video-call
            link), so they appear in your Eventra calendar and stay in sync
            when they change.
          </li>
          <li>
            <strong>Reads</strong> your calendar&apos;s color settings so
            events keep the colors you use in Google Calendar.
          </li>
          <li>
            <strong>Creates, updates and deletes</strong> events in your
            primary Google Calendar only when you turn on &quot;Add new
            Eventra events to Google Calendar&quot;, and only for events you
            create in Eventra.
          </li>
        </ul>
        <p>
          Imported Google events are stored in Eventra&apos;s database so they
          can be shown in the app. Your Google OAuth access and refresh tokens
          are stored encrypted.
        </p>
        <p>
          If you use the Eventra AI assistant and ask about your schedule, the
          events and tasks needed to answer (which can include events imported
          from Google Calendar) are sent to Google&apos;s Gemini API to
          generate the reply. This happens only when you send the assistant a
          message.
        </p>
        <p>
          Eventra&apos;s use and transfer of information received from Google
          APIs to any other app will adhere to the{" "}
          <a href={GOOGLE_USER_DATA_POLICY} target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. In particular, Eventra:
        </p>
        <ul>
          <li>uses Google user data only to provide and improve the features described above;</li>
          <li>does not sell Google user data;</li>
          <li>does not use or transfer Google user data for advertising;</li>
          <li>does not use Google user data to train AI or machine-learning models;</li>
          <li>
            does not allow humans to read Google user data, except with your
            explicit consent, when needed for security, or to comply with the
            law.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>to run your Eventra account and show your calendar and tasks;</li>
          <li>to sync with Google Calendar when you have connected it;</li>
          <li>to send account emails such as password-reset links;</li>
          <li>to keep the service secure and fix problems.</li>
        </ul>
      </section>

      <section>
        <h2>Sharing</h2>
        <p>
          We do not sell your information. We share it only with the service
          providers that run Eventra, and only as needed to provide the
          service: our hosting and database providers, Google (for Google
          sign-in, Google Calendar and the Gemini API), and our email provider
          for account emails. We may also disclose information if required by
          law.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <ul>
          <li>
            <strong>Disconnect Google Calendar</strong> at any time in Eventra
            Settings. Eventra then revokes its Google access and deletes the
            stored Google tokens and all events it imported from Google
            Calendar. You can also remove Eventra&apos;s access at{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
            >
              myaccount.google.com/permissions
            </a>
            .
          </li>
          <li>
            While Google Calendar is connected, imported events are kept in
            sync: events deleted in Google, or outside your chosen date range,
            are removed from Eventra.
          </li>
          <li>
            To delete your account and all associated data, contact us at{" "}
            <SupportContact />. We delete it within 30 days.
          </li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Data is sent over HTTPS. OAuth tokens are encrypted at rest and
          passwords are stored only as hashes. No method of storage is
          perfectly secure, but we work to protect your information.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We will update this page if this policy changes. Questions? Contact
          us at <SupportContact />.
        </p>
      </section>
    </LegalPage>
  );
}
