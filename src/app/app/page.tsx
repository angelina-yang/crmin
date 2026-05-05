import { redirect } from "next/navigation";
import { getSessionCookie, SESSION_TTL_SECONDS } from "@/lib/auth";
import { getSession, refreshSessionTtl, getUser } from "@/lib/kv";
import { Workspace } from "@/components/workspace";

export default async function AppPage() {
  // Defense in depth: proxy.ts blocks unauthenticated requests at the edge,
  // but we re-validate against KV here to detect deleted/expired sessions
  // and to refresh the TTL on every visit (rolling 30-day expiry).
  // Note: server components can't modify cookies in Next 16, so we redirect
  // through /api/auth/clear (a route handler) to drop a stale cookie.
  const sessionToken = await getSessionCookie();
  if (!sessionToken) redirect("/");

  const session = await getSession(sessionToken);
  if (!session) redirect("/api/auth/clear");

  await refreshSessionTtl(sessionToken, SESSION_TTL_SECONDS);

  const user = await getUser(session.email);
  if (!user) redirect("/api/auth/clear");

  return <Workspace user={{ name: user.name }} />;
}
