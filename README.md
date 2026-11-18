# Hastkatha / KalaSetu

An AI-powered digital business platform for traditional Indian artisans: AI-written product descriptions, AI-generated product photography, a shareable public catalogue, a directory of government schemes and opportunities, and a multilingual blog, all in 23 languages.

This one codebase and database serves two separately-branded, separately-deployed products — see "Multi-brand deployment" below.

## Chosen vertical

**Societal Benefit.** India has millions of traditional artisans (weavers, potters, metal and wood workers) whose skill is world class but whose income depends on middlemen, because selling online needs things most of them don't have: product photos, written listings in English, a storefront, and knowledge of the government schemes meant for them. KalaSetu is an assistant that gives an artisan those things from a phone, in their own language.

## Approach and logic

The assistant adapts to who the user is and what they are doing, rather than offering one generic chat box:

- **Language first.** The artisan picks one of 23 languages on first visit. Every screen, every AI answer (`/api/ai` adds "respond only in <language>" to the prompt), every community story and every blog post is served in that language. Stories are judged in the language they were written in, never translated first.
- **Task-aware AI.** `/api/ai` takes a `mode` (`description`, `craft_story`, `caption`, `pricing`, `whatsapp`) and switches the system prompt to match. A pricing question always factors in labour time; a WhatsApp message stays 2-4 lines; a craft story is told not to invent biographical facts.
- **Gated publishing.** A community story is scored on seven dimensions by AI on the server. It is published only if the overall score is 8 or more; otherwise the artisan gets one specific suggestion to improve it. The browser never supplies a score.
- **Progress that responds to real actions.** Profile completeness, badges, and the Saathi (mentor) referral reward each move forward only when the server confirms the underlying event happened (a saved profile, a first product, a published story).
- **Graceful degradation.** Text AI falls back from Claude to Groq. Image generation walks a chain of five providers. If everything fails, the user gets a plain "try again shortly" message, never a stack trace.

## How it works

1. **Sign up** and choose a language and craft.
2. **Studio / Products:** upload a phone photo, get a studio-quality product shot (the dominant colour is detected in the browser and folded into the prompt) plus an AI description and price guidance.
3. **Catalogue:** publish a shareable public catalogue page; export to PDF, Word or PowerPoint.
4. **Opportunities:** browse government schemes, competitions and trade shows. An admin-reviewed pipeline extracts these from official pages; nothing is auto-published.
5. **Learn / Community / Blog:** short learning modules, artisan stories, and a daily blog, each readable in any of the 23 languages (translations are cached so cost does not grow with traffic).
6. **Saathi:** an established artisan refers a newcomer and is rewarded once the newcomer has both completed a profile and added a first product.

Every API route that spends money (AI, images, payments) checks the Supabase session on the server, is rate limited per user, validates its input, and returns generic error messages.

## Assumptions

- Artisans mostly use a phone, may have patchy connectivity, and are more comfortable in a regional language than in English.
- An AI provider can be down or rate limited at any time, so every AI feature must have a fallback or a clear failure message.
- Rate limiting is per serverless instance (there is no Redis); it is a cost guard, not a hard security boundary. Auth and Row Level Security are the real boundary.
- Prices are in INR and paid through Razorpay; the price charged is always computed on the server from `lib/pricing.ts`.
- Government scheme data is only shown after a human admin approves it.

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

Vitest suites in `tests/` cover:

- **API routes:** auth, rate limiting, input validation, provider failure and success paths for `/api/ai`, `/api/photoshoot`, `/api/design-image`, `/api/story-evaluate`, `/api/story-publish`, `/api/story-translate`, `/api/referral`, and both webhook hooks.
- **Payments:** Razorpay order creation charges the server-side price; verification rejects forged or mismatched signatures, unpaid orders, and wrong amounts, and grants the tier recorded on Razorpay's order rather than the one the client claims.
- **Core logic:** pricing, KalaWallet balance and atomic redemption, profile completeness, story-score validation, rate limiting, request parsing, and the image-provider fallback chain.
- **Platform:** cron endpoint auth, robots.txt and sitemap, branding, and translation-file integrity across all 23 languages.

CI (`.github/workflows/tests.yml`) runs the suite and ESLint on every push and pull request.

## Database migrations

SQL migrations live in `supabase/`, numbered in the order they were applied. Run new migrations against the Supabase project directly; this repo does not run them automatically.

## Deployment

```bash
npx vercel --prod --yes
```

Requires `.npmrc` with `legacy-peer-deps=true` (already committed) — Vercel's build will fail without it, due to a peer-dependency conflict introduced by the test suite's dependencies.
