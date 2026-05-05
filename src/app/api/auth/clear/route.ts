import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Tiny route handler used to clear a stale session cookie when a server
// component detects an expired/invalid session. Server components can't
// modify cookies in Next 16; route handlers can.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
