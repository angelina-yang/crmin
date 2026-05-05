/**
 * Email validation for Lab tool registration.
 *
 * Goal: block obvious typos and lazy fakes without infrastructure.
 * We don't (and won't) verify deliverability — that requires sending mail.
 */

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.test",
  "fake.com",
  "fake.fake",
  "asdf.com",
  "qwerty.com",
  "a.com",
  "b.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "guerrillamail.com",
  "trashmail.com",
  "yopmail.com",
  "throwaway.email",
  "maildrop.cc",
  "sharklasers.com",
  "dispostable.com",
  "getnada.com",
  "fakeinbox.com",
  "emailondeck.com",
]);

const BLOCKED_LOCALS = new Set([
  "test",
  "tests",
  "testing",
  "fake",
  "asdf",
  "qwerty",
  "nobody",
  "noone",
  "none",
  "null",
  "undefined",
  "a",
  "b",
  "x",
  "xxx",
  "email",
  "user",
  "admin",
]);

export function isValidEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return false;

  const atIdx = email.lastIndexOf("@");
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);

  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (BLOCKED_LOCALS.has(local)) return false;
  if (/^(.)\1{2,}$/.test(local)) return false;

  const tld = domain.split(".").pop() ?? "";
  if (!/^[a-z]{2,}$/.test(tld)) return false;

  return true;
}
