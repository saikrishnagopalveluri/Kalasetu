# Hastkatha / KalaSetu

An AI-powered digital business platform for traditional Indian artisans: AI-written product descriptions, AI-generated product photography, a shareable public catalogue, a directory of government schemes and opportunities, and a multilingual blog, all in 23 languages.

This one codebase and database serves two separately-branded, separately-deployed products — see "Multi-brand deployment" below.

## Multi-brand deployment

Two Vercel projects deploy this same repo, differing only in the `NEXT_PUBLIC_BRAND` environment variable (`kalasetu` or `hastkatha`) and `NEXT_PUBLIC_APP_URL`:

| Vercel project | `NEXT_PUBLIC_BRAND` | Domain | Renders as |
|---|---|---|---|
| `kalasetu` | `kalasetu` | kalasetu-six.vercel.app | "KalaSetu" |
| `hastkatha` | `hastkatha` | hastkatha.vercel.app | "Hastkatha" |

`lib/brand.ts` reads that env var and exports `BRAND` (name, fallback URL, support email). Every page title, meta tag, JSON-LD entity, AI system prompt, and PWA manifest pulls the brand name from there rather than hardcoding either name — `tests/branding.test.ts` enforces this. `lib/translations.ts` uses a `{{BRAND}}` placeholder, substituted at read time in `getTranslations()`, instead of duplicating every UI string per brand.

The single scheduled cron job (`api/cron/daily`) registers on both projects but only actually runs on the `hastkatha` deployment — see the `BRAND_ID` guard. This is deliberate: both brands share one Supabase database, so running it from both deployments would insert every post and every scraped opportunity twice.

`hello@kalasetu.in` is never used anywhere in this codebase, for either brand. `kalasetu.in` is the live domain of a real, unrelated business — not ours (this project was renamed from KalaSetu to Hastkatha for exactly this reason; see the AI Build Log). Both brands share the one real support address, `hello@hastkatha.in`, until each has its own domain and inbox.

Adding a new custom domain to either brand: `npx vercel domains add <domain>` while linked to the right project (`npx vercel link --project kalasetu` or `--project hastkatha`), then update that project's `NEXT_PUBLIC_APP_URL`.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database & auth:** Supabase (PostgreSQL, Row Level Security on every table)
- **Hosting:** Vercel, including scheduled cron jobs
- **AI text:** Anthropic Claude, with automatic fallback to Groq
- **AI images:** Hugging Face, Cloudflare Workers AI, Pixazo, Stability AI, and Pollinations, tried in order with automatic fallback
- **Payments:** Razorpay
- **Tests:** Vitest

## Getting started

```bash
npm install --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will need a `.env.local` file — see Environment variables below.

## Environment variables

Set these in `.env.local` for local development, and in the Vercel project settings for production:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key that bypasses Row Level Security. Never expose to the client. |
| `ANTHROPIC_API_KEY` | Primary AI text provider |
| `GROQ_API_KEY` | Fallback AI text provider |
| `HF_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `PIXAZO_API_KEY`, `STABILITY_API_KEY`, `POLLINATIONS_API_TOKEN` | Image generation providers (fallback chain; only configured providers are used) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Payments |
| `CRON_SECRET` | Bearer token required by all cron endpoints (the scheduled one and the two directly-callable ones) |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL, used in the sitemap, robots.txt, and structured data |
| `NEXT_PUBLIC_BRAND` | `kalasetu` or `hastkatha` — picks which brand this deployment renders as. See "Multi-brand deployment" above. |

## Scheduled jobs

`vercel.json` registers exactly one cron entry, `api/cron/daily` (Vercel's Hobby plan allows only one cron job per account). It alternates by day of year: scheme scraping on even days, the blog on odd days, each still gated by `CRON_SECRET` and the `BRAND_ID` guard.

- `api/cron/daily-blog` — writes and publishes one blog post with a header image, then translates it into all supported languages. Still directly callable on its own (same `CRON_SECRET`) for a manual run regardless of the day.
- `api/cron/scrape-schemes` — crawls configured government/scheme sources and publishes new opportunities. Also still directly callable on its own.

## Testing

```bash
npm test
```

Covers translation-file integrity across all 23 languages, the auth guard on both cron endpoints, and the image-provider fallback chain. See `tests/`.

## Database migrations

SQL migrations live in `supabase/`, numbered in the order they were applied. Run new migrations against the Supabase project directly; this repo does not run them automatically.

## Deployment

```bash
npx vercel --prod --yes
```

Requires `.npmrc` with `legacy-peer-deps=true` (already committed) — Vercel's build will fail without it, due to a peer-dependency conflict introduced by the test suite's dependencies.
