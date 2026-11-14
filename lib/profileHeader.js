// The person's header lines and initial (spec 49, ticket 09): the You tab's
// profile header and Settings' profile row.

const clean = (s) => (typeof s === 'string' ? s.trim() : '');

// One uppercase letter for the avatar circle: the name's first letter, else
// the email's, else "?".
export function profileInitial({ fullName, email } = {}) {
  const source = clean(fullName) || clean(email);
  return source ? source[0].toUpperCase() : '?';
}

// The title is the name, else the email; the caption is the email, hidden
// when it would repeat the title.
export function profileLines({ fullName, email } = {}) {
  const name = clean(fullName);
  const mail = clean(email);
  const title = name || mail;
  return { title, caption: mail && mail.toLowerCase() !== title.toLowerCase() ? mail : null };
}
