/**
 * Terms, Privacy Policy and Community Guidelines shown in the app (FR-604).
 * Plain-language MVP drafts written for the pilot. ⚠ They must be reviewed by a lawyer before a
 * public launch (tracked in docs/ROADMAP.md Phase 10). Edit here; every change → DEV_LOG.
 */
export type LegalDocId = 'terms' | 'privacy' | 'guidelines';

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: {
    title: 'Terms of Use',
    updated: '19 November 2026',
    sections: [
      {
        heading: 'Pilot and test mode',
        body:
          'Connect is in a pilot phase. All wallet money is TEST MODE money: it has no real value, cannot be cashed out and no real payment is ever taken or sent through the app. If you choose "Pay directly", you and the other person arrange payment yourselves and Connect is not part of that payment.',
      },
      {
        heading: 'Who can use Connect',
        body: 'You must be at least 18 years old and give true information about yourself. One person, one account. You are responsible for keeping your password safe.',
      },
      {
        heading: 'What Connect does',
        body:
          'We help people find each other to do work: you can offer services, post jobs, send quotes, chat and record orders. We are not the employer or the customer of anyone, and we do not guarantee the quality, safety or legality of any work. Check people and listings carefully, and use the reviews and the start/finish codes for on-site jobs.',
      },
      {
        heading: 'Your content',
        body:
          'You own what you post (text and photos). You allow Connect to show it in the app and on your public work record. Do not post anything you do not have the right to share, or anything that breaks the Community Guidelines.',
      },
      {
        heading: 'Orders, reviews and disputes',
        body:
          'An order is an agreement between the buyer and the seller. Reviews are only possible for completed orders and must be honest. If something goes wrong you can report a problem; an admin may decide a dispute in test mode by refunding the buyer or paying the seller.',
      },
      {
        heading: 'Suspension',
        body: 'We may hide content or suspend accounts that break these terms or the Community Guidelines, especially scams, harassment or unsafe behaviour.',
      },
      {
        heading: 'Changes and contact',
        body: 'We may update these terms during the pilot; we will show the date of the latest version here. Questions: use "Report a problem" in the app.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: '19 November 2026',
    sections: [
      {
        heading: 'What we collect',
        body:
          'Your email, password (stored only as a secure hash), date of birth, name and the profile details you add; your listings, quotes, messages, orders, reviews and wallet activity; a college email if you verify it for the Student badge; your location only when you use "near me" or post on-site work.',
      },
      {
        heading: 'What others can see',
        body:
          'Your name, photo, bio, city, college, skills, languages, badges, ratings, reviews, portfolio and listings. Never your email, phone number, date of birth, college email or exact location — on-site locations are rounded to about 100 metres and only a distance is shown. Your public work record shows completed jobs with category, month, rating and comment, but never the buyer\'s name.',
      },
      {
        heading: 'How we use it',
        body:
          'To run the service (accounts, matching, chat, orders, notifications), to keep it safe (spam checks, reports, suspensions) and to fix problems. We do not sell your data and we do not show ads.',
      },
      {
        heading: 'Where it is stored',
        body: 'On our servers and with the service providers we use to run the app (hosting, database, file storage, email and push notifications).',
      },
      {
        heading: 'Your choices',
        body:
          'You can edit your profile at any time and delete your account in My profile → Delete my account. Deleting removes your personal details; completed orders and reviews stay for the other person, shown as "Deleted user".',
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    updated: '19 November 2026',
    sections: [
      { heading: 'Be honest', body: 'Describe your skills, prices and jobs truthfully. Only post photos of your own work. Leave fair reviews.' },
      {
        heading: 'No scams',
        body:
          'Never ask for a "registration fee", deposit or advance to give someone a job. Never ask for OTPs, UPI PINs or bank passwords. Keep payments inside the app. Report anyone who asks.',
      },
      { heading: 'Be respectful', body: 'No harassment, hate, threats, sexual content or spam. Disagreements happen — stay polite and use "Report a problem" if needed.' },
      {
        heading: 'Stay safe',
        body:
          'Meet in safe places, tell someone where you are going for on-site work, and use the start/finish codes. Child care, elder care and pet care are not available yet, until we can verify identities.',
      },
      { heading: 'Report problems', body: 'Use Report on a listing, profile or message. Our team reviews reports and may hide content or suspend accounts.' },
    ],
  },
};
