import { NextResponse } from "next/server";
import { getSessionCookie, clearSessionCookie } from "@/lib/auth";
import { deleteSession } from "@/lib/kv";

export async function POST() {
  const token = await getSessionCookie();
  if (token) {
    await deleteSession(token);
    await clearSessionCookie();
  }
  return NextResponse.json({ ok: true });
}
