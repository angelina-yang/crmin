import { NextResponse, type NextRequest } from "next/server";
import { isValidEmail } from "@/lib/email-validation";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { getUser, setUser, setMagicLink, type UserRecord } from "@/lib/kv";
import { generateToken, MAGIC_LINK_TTL_SECONDS } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (isRateLimited(`signup:${ip}`, 5, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { name, email, termsAgreed, newsletter } = body as Partial<{
    name: string;
    email: string;
    termsAgreed: boolean;
    newsletter: boolean;
  }>;

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: "Name and email are required." },
      { status: 400 }
    );
  }

  if (!termsAgreed) {
    return NextResponse.json(
      { error: "You need to agree to the Terms of Use." },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  // Idempotent: if user already exists, just send a fresh magic link.
  // This means re-submitting the welcome modal works as a "resend link" path.
  const existing = await getUser(normalizedEmail);
  const now = Date.now();

  let userRecord: UserRecord;
  if (existing) {
    userRecord = existing;
  } else {
    userRecord = {
      email: normalizedEmail,
      name: cleanName,
      newsletterConsent: Boolean(newsletter),
      consentTimestamp: now,
      createdAt: now,
      verifiedAt: null,
      lastLoginAt: null,
    };
    await setUser(userRecord);
  }

  const token = generateToken();
  await setMagicLink(
    token,
    { email: normalizedEmail, createdAt: now },
    MAGIC_LINK_TTL_SECONDS
  );

  const appUrl =
    process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const verifyUrl = `${appUrl}/verify?token=${token}`;

  try {
    await sendMagicLinkEmail({
      to: normalizedEmail,
      name: userRecord.name,
      verifyUrl,
    });
  } catch (err) {
    console.error("[signup] sendMagicLinkEmail failed:", err);
    return NextResponse.json(
      { error: "Could not send sign-in email. Try again." },
      { status: 502 }
    );
  }

  // Fire-and-forget on first signup only:
  // - Log to shared Google Sheet
  // - Subscribe to Substack if opted in
  if (!existing) {
    logSignupToSheet({
      name: cleanName,
      email: normalizedEmail,
      newsletter: Boolean(newsletter),
    });
    if (newsletter) {
      subscribeToSubstack(normalizedEmail);
    }
  }

  console.log(
    `[signup] ${cleanName} <${normalizedEmail}> newsletter=${Boolean(
      newsletter
    )} firstSignup=${!existing}`
  );

  return NextResponse.json({ ok: true, email: normalizedEmail });
}

// Fire-and-forget. Failures must never block the user's signup.
function logSignupToSheet(payload: {
  name: string;
  email: string;
  newsletter: boolean;
}): void {
  const sheetWebhook = process.env.GOOGLE_SHEET_WEBHOOK;
  if (!sheetWebhook) return;
  void (async () => {
    try {
      const res = await fetch(sheetWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, source: "crmin" }),
        redirect: "manual",
      });
      // Apps Script returns 302; follow the redirect so the write completes.
      if (res.status === 302 || res.status === 301) {
        const redirectUrl = res.headers.get("location");
        if (redirectUrl) await fetch(redirectUrl);
      }
    } catch {
      // Swallow: signup logging failure must not affect the user.
    }
  })();
}

function subscribeToSubstack(email: string): void {
  void (async () => {
    try {
      await fetch("https://angelinayang.substack.com/api/v1/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          first_url: "https://crm.twosetai.com",
          first_referrer: "crmin",
        }),
      });
    } catch {
      // Swallow: Substack failure must not affect the user.
    }
  })();
}
