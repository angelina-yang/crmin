import { redirect } from "next/navigation";
import { getSessionCookie } from "@/lib/auth";
import { getSession } from "@/lib/kv";
import { Landing } from "@/components/landing";

export default async function Home() {
  // If a valid session cookie is present, skip the landing and send the
  // user straight to the workspace. This handles the post-verify
  // continuation and any return-visit where the cookie is still good.
  const sessionToken = await getSessionCookie();
  if (sessionToken) {
    const session = await getSession(sessionToken);
    if (session) {
      redirect("/app");
    }
  }

  return <Landing />;
}
