import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import {
  getMagicLink,
  deleteMagicLink,
  getUser,
  setUser,
  setSession,
} from "@/lib/kv";
import {
  generateToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (isRateLimited(`verify:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { token } = body as Partial<{ token: string }>;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const link = await getMagicLink(token);
  if (!link) {
    return NextResponse.json(
      {
        error: "This sign-in link has expired or already been used.",
        code: "expired",
      },
      { status: 410 }
    );
  }

  const user = await getUser(link.email);
  if (!user) {
    await deleteMagicLink(token);
    return NextResponse.json(
      { error: "Account not found." },
      { status: 404 }
    );
  }

  const now = Date.now();
  if (!user.verifiedAt) user.verifiedAt = now;
  user.lastLoginAt = now;
  await setUser(user);

  await deleteMagicLink(token);

  const sessionToken = generateToken();
  await setSession(
    sessionToken,
    { email: user.email, createdAt: now, lastActiveAt: now },
    SESSION_TTL_SECONDS
  );

  const response = NextResponse.json({ ok: true, email: user.email });
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
