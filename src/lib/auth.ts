import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export { SESSION_COOKIE } from "./session-cookie";
import { SESSION_COOKIE } from "./session-cookie";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, rolling
export const MAGIC_LINK_TTL_SECONDS = 60 * 15; // 15 min

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
