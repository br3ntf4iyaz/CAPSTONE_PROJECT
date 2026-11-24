"""Starting text for the three policy pages.

These are DRAFTS. They only describe what the platform actually does, and they leave clearly marked blanks (in square
brackets) for facts the platform cannot decide, such as retention periods and the data protection officer. They are not
legal advice and make no claim of legal compliance: LYDO / the City Government of Lucena must review and edit them in
Admin > Policies before relying on them. Until an administrator marks a policy as reviewed, the public page shows a notice.
"""

TERMS = """## 1. About this platform
The Lucena Youth Leadership Hub (LYDOP) is the online platform of the Lucena City Youth Development Office (LYDO). It gives young people, Sangguniang Kabataan (SK) officials and youth organization leaders access to programs, events, learning courses, opportunities, resources and compliance tools.

## 2. Who may use it
The platform is meant for youth residents of Lucena City, SK officials and youth organization leaders. Parts of the platform are public. Other parts need an account.

## 3. Your account
- Give accurate information when you register and keep it up to date.
- Keep your password private. You are responsible for activity under your account.
- Tell LYDO right away if you think someone else used your account.

## 4. Acceptable use
- Use the platform only for lawful, youth-development purposes.
- Do not post or upload anything false, abusive, hateful, sexual, or that infringes anyone's rights.
- Do not try to break into accounts, overload the system, or access data that is not yours.
- Do not pretend to be another person, an SK official, or an organization leader.

## 5. Information and documents you submit
- You confirm that what you submit (forms, IDs, applications, documents, posts) is true and that you have the right to submit it.
- Uploaded files must be of the allowed types and sizes. Files that look unsafe may be rejected.
- LYDO may review submissions to verify them, and may decline or remove submissions that are false or break these terms.

## 6. Learning courses and certificates
Certificates are issued by the platform only after the required lessons and assessments are completed. Certificates may be verified by LYDO.

## 7. Administration and suspension
LYDO administrators manage the platform. An account may be limited, suspended or removed if these terms are broken or to protect other users or the platform.

## 8. Limits
The platform is provided as a public service. Features may change, and the platform may be unavailable from time to time for maintenance or other reasons. LYDO does not guarantee that the platform will always be available or error-free.

## 9. Privacy and cookies
How personal information and cookies are handled is explained in the Privacy Policy and the Cookie Policy.

## 10. Changes and contact
These terms may be updated. The date and version shown on this page tell you which text applies. Questions: [LYDO contact details to be confirmed], or email lydo@lucena.gov.ph.
"""

PRIVACY = """## 1. Who is responsible
The Lucena City Youth Development Office (LYDO), City Government of Lucena, operates this platform and decides how personal information on it is used. Data protection officer / privacy contact: [to be completed by LYDO]. General contact: lydo@lucena.gov.ph.

## 2. What we collect
- Account details: name, email address, barangay, account type (general youth, SK official or youth organization leader), and, where relevant, organization and position.
- Identity verification (optional, for features that need it): photos of a government ID and a selfie, and details read from the ID.
- Applications you make: scholarship, job and opportunity applications, with the documents you attach.
- Participation: events, programs, courses and assessments, certificates, badges, surveys, community posts and comments, feedback and support messages.
- Technical data: sign-in activity, security logs, and the data your browser stores to keep you signed in.

## 3. Why we collect it
- To create and secure your account and to show you the services you may use.
- To verify identity or role where a service needs it (for example SK official features).
- To process applications and to run programs, events and learning courses.
- To send notices about your account and services you use.
- To plan and report on youth programs and compliance, using summaries where possible.
- To keep the platform safe and to follow the law.

## 4. How it is stored and who can see it
- Information is stored on the platform's servers. Identity documents and application documents are kept in restricted storage and are not publicly accessible.
- Only authorized LYDO administrators, and SK or organization officers where their role requires it, can see personal information needed for their work.
- Information is not sold. It may be shared with Lucena City government offices for youth-development purposes and where the law requires.

## 5. How it is protected
Passwords are stored in hashed form. Access depends on your role. Sensitive actions are logged. The platform is served over HTTPS. No system is completely secure, so keep your password private.

## 6. How long we keep it
Retention periods: [to be completed by LYDO, in line with the City Government's records policy]. Information is kept only as long as needed for the purposes above or as the law requires.

## 7. Your rights
Under the Data Privacy Act of 2012 (Republic Act No. 10173) you may ask to be informed, to access your information, to correct it, to object to or ask us to stop certain processing, to ask for blocking or deletion in the cases the law allows, and to complain to the National Privacy Commission. To use these rights, contact LYDO using the details above.

## 8. Cookies
See the Cookie Policy for what the platform stores in your browser and how to manage your choices.

## 9. Changes
This policy may be updated. The version and date on this page show which text applies.
"""

COOKIES = """## 1. What cookies are
Cookies and similar browser storage are small pieces of data a website saves in your browser. They help a site remember who you are and how you like it set up.

## 2. What this platform uses
**Strictly necessary (always on).** These keep you signed in, protect your account and make the site work. Without them sign-in and secure pages cannot work, so they cannot be switched off.
- Sign-in tokens kept in your browser while you are signed in.
- Security and session data.
- Your cookie choice, so we do not ask again on every visit.

**Preferences (only with your consent).** These remember your choices to make the site more comfortable.
- Display settings, such as light or dark theme.
- The chat assistant's recent conversation, so you can continue where you left off.

**Analytics and advertising.** This platform does not currently use analytics or advertising cookies. If that changes, it will only happen after you agree, and this policy will be updated.

**Third-party sign-in.** If you choose "Sign in with Google", Google may set its own cookies according to Google's own policies. This only happens when you use that option.

## 3. How to manage your choices
- When you first visit, you can choose Accept All, Reject Non-Essential, or Manage Preferences.
- You can change your choice at any time with the "Cookie settings" link in the page footer.
- You can also clear or block cookies in your browser settings. Blocking strictly necessary storage will stop sign-in from working.

## 4. Changes and contact
This policy may be updated. The version and date on this page show which text applies. Questions: lydo@lucena.gov.ph.
"""

DEFAULTS = {
    'terms': ('Terms of Use', TERMS),
    'privacy': ('Privacy Policy', PRIVACY),
    'cookies': ('Cookie Policy', COOKIES),
}
