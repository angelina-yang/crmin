# CRM;IN Deploy Checklist

One-time setup to take CRM;IN from `localhost:3011` to `https://crm.twosetai.com`.

The order matters: Resend domain auth + Cloudflare DNS first, then Vercel KV, then Vercel project, then DNS for the subdomain, then the Lab registry entry.

---

## 1. Resend domain auth (`hi@crm.twosetai.com`)

You already have a Resend account from Founders for Students. Add a second sending subdomain.

1. Resend dashboard → **Domains** → **Add Domain** → enter `crm.twosetai.com`.
2. Resend gives 3 DNS records (DKIM TXT, return-path CNAME, DMARC TXT).
3. Cloudflare DNS for `twosetai.com` → add the 3 records exactly as shown by Resend (proxy disabled / DNS only).
4. Wait 5–15 min, click **Verify** in Resend until all rows go green.
5. Resend → **API Keys** → create a key scoped to `crm.twosetai.com` → copy. (Don't reuse the Founders key; per-tool keys make rotation easy.)

## 2. Cloudflare Email Routing (receive replies)

So replies to `hi@crm.twosetai.com` actually land somewhere — no Google Workspace needed.

1. Cloudflare dashboard → twosetai.com zone → **Email** → **Email Routing**.
2. Add custom address `hi@crm.twosetai.com` → forward to `getcastly@gmail.com`.
3. Click the verification link Cloudflare emails to that destination.

## 3. Vercel KV / Upstash Redis

Magic-link tokens, sessions, rate-limit counters, and the anonymous URL log all live here. The in-memory dev fallback won't survive a Vercel cold-start.

1. Vercel → CRM;IN project → **Storage** → **Create Database** → **Upstash for Redis** (Marketplace).
2. Pick the free tier. Region: closest to your Vercel function region.
3. Vercel auto-injects `REDIS_URL` into the project's env vars. Confirm under Settings → Environment Variables.

## 4. Vercel project env vars

| Var | Value | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | From Step 1 |
| `RESEND_FROM` | `CRM;IN <hi@crm.twosetai.com>` | Display-name format |
| `APP_URL` | `https://crm.twosetai.com` | No trailing slash. Used for magic-link URLs and `metadataBase`. |
| `GOOGLE_SHEET_WEBHOOK` | The shared Apps Script webhook URL | Same one TL;Listen / Founders use, source tag is `crmin` |
| `REDIS_URL` | (auto-injected by Step 3) | Don't paste manually |

Double-check that **no `ANTHROPIC_API_KEY`** is set on the project. CRM;IN is BYOK only — a server-side fallback would violate [LAB_PRINCIPLES Rule 11](../LAB_PRINCIPLES.md#rule-11-byok-only--no-server-side-fallback-keys).

## 5. Vercel project import + first deploy

1. Vercel → **Add New** → **Project** → import this repo (or link the existing GitHub remote when ready).
2. Root directory: `outreach_CRM/`
3. Framework preset: Next.js (auto-detected)
4. Build & install: defaults are fine (`next build`, `npm install`)
5. Environment variables: paste from Step 4 into both Preview and Production.
6. Deploy.

## 6. Domain mapping

1. Vercel project → **Settings** → **Domains** → add `crm.twosetai.com`.
2. Vercel gives a CNAME target.
3. Cloudflare DNS for `twosetai.com` → add a CNAME `crm` → Vercel's target. Proxy: **DNS only** (orange cloud OFF) so Vercel can issue the SSL cert. After cert issuance you can flip the proxy on if you want Cloudflare in front.
4. Wait ~5 min for cert provisioning.

## 7. twosetai-site Lab registry entry

Add CRM;IN to [twosetai-site/src/data/lab-tools.ts](../twosetai-site/src/data/lab-tools.ts) so it shows on `/lab`:

```ts
{
  slug: 'crmin',
  name: 'CRM;IN',
  icon: '📇',
  tagline: 'Run your LinkedIn outreach like a CRM, not a spam bot',
  description:
    'Upload a list, write a templated message, work through a queue. Manual sending only. No automation, no bans.',
  url: 'https://crm.twosetai.com',
},
```

(No em dashes per the Lab copy style rule.)

## 8. Post-deploy verification

Walk these in order on `https://crm.twosetai.com`:

- [ ] Landing page loads, OG preview is correct (test with `https://www.opengraph.xyz/url/https%3A%2F%2Fcrm.twosetai.com`)
- [ ] Welcome modal opens, signup form submits, magic-link email arrives at the test address (NOT logged to console — confirm Resend mode is live)
- [ ] Click magic link, land on `/verify?token=...`, click sign-in, redirect to `/app`
- [ ] Workspace renders with personalized greeting
- [ ] Create campaign, import 3-row CSV, queue renders
- [ ] Add Anthropic key, click `Resolve missing URLs (N)`, real Claude call returns a real LinkedIn URL
- [ ] Paste a known public list URL into the From URL tab, real Claude extracts candidates
- [ ] Sign out, cookie cleared, `/app` redirects to `/`
- [ ] Add `crm.twosetai.com` to home screen on iOS — confirm icon + standalone display

## 9. Sanity checks

- [ ] `/api/auth/start`, `/api/auth/verify`, `/api/auth/logout`, `/api/auth/clear` all 401 if cookie missing or session unknown
- [ ] `/api/enrich` rejects requests without `anthropicKey` starting with `sk-`
- [ ] `/api/scrape` rejects `http://localhost`, `http://192.168.*`, `http://169.254.169.254`, `file://`, malformed URLs
- [ ] Daily scrape limit: 6th call from one verified email returns 429 with the consulting upsell message
- [ ] Inspect Vercel KV: only auth + rate-limit + URL-log keys present. NO contact records, NO message templates, NO Anthropic keys.

## 10. Rollback

If anything goes sideways, the data plane is contained:

- Anthropic keys: never on the server. Cleared by users in their browser.
- Campaigns/contacts/messages: localStorage only. Untouched by deploys.
- KV: auth tokens and rate-limit counters. Safe to flush; users re-verify via magic link.
- Calendar/podcast-crm: completely separate from CRM;IN. Not affected.

Reverting to a previous Vercel deploy is one click. No DB migrations to undo.
