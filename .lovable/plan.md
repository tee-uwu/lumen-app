# IdeaForge — LinkedIn + Pitch Collaboration Platform

A professional network where members build profiles, post idea pitches, define needed roles (with equity or paid terms), and let others apply to join. Built entirely on free tiers.

## Recommended Stack (all free)

- **Frontend + Backend**: TanStack Start (React 19 + SSR) — already scaffolded here on Lovable.
- **Database + Auth + Storage + Serverless**: **Lovable Cloud** (managed Supabase under the hood — free tier covers Postgres, row-level security, file storage, email/Google auth, edge functions). Zero external accounts.
- **AI features**: **Lovable AI Gateway** — free during current promo window, gives access to Gemini and GPT models for pitch enhancement, role matching, moderation, embeddings.
- **UI**: Tailwind v4 + shadcn/ui (already in project).
- **Hosting**: Lovable's built-in publish (free subdomain, HTTPS included).
- **Email**: Supabase built-in auth emails (free); Resend later if needed.

Total monthly cost at launch: **$0**.

## Core Features (MVP scope)

1. **Auth & Profiles** — Email + Google sign-in. Profile with name, headline, bio, skills, experience, avatar, links.
2. **Feed** — LinkedIn-style posts (text/image), likes, comments, follow users.
3. **Pitches** — Create a pitch with title, problem, solution, stage, category, media.
4. **Open Roles on a Pitch** — Founder defines roles (e.g. "React dev", "Designer") with compensation type: **Equity %**, **Paid**, or **Revenue share**, plus commitment level.
5. **Applications** — Members apply to a role with a message; founder accepts/rejects. Accepted members become "team".
6. **Team workspace per pitch** — Private thread + task list for accepted members.
7. **Messaging** — 1:1 direct messages.
8. **AI helpers** (via Lovable AI Gateway):
   - Pitch polisher (rewrites your draft into a compelling pitch)
   - Role suggester (reads pitch → suggests roles you'll need)
   - Match score (ranks applicants against role using embeddings)
   - Moderation (flags spam/abuse before publish)

## Security Model

- Row-Level Security on every table (users read/write only their own or public rows).
- Roles stored in a separate `user_roles` table (never on profile) — prevents privilege escalation.
- Server-side input validation with Zod on every server function.
- Rate-limiting on pitch creation & applications.
- Email verification required before pitching.
- HIBP leaked-password check enabled.
- File uploads scoped to per-user storage folders.
- Secrets (AI keys, etc.) stored server-side only.
- Auto security scans after each major change.

## Data Model (high level)

```text
profiles(id → auth.users, name, headline, bio, avatar, skills[])
user_roles(user_id, role)                    -- admin/moderator/user
posts(id, author_id, body, media_url)
post_likes / post_comments / follows
pitches(id, founder_id, title, problem, solution, stage, category, cover_url, status)
pitch_roles(id, pitch_id, title, description, comp_type, comp_details, filled)
applications(id, role_id, applicant_id, message, status, match_score)
pitch_members(pitch_id, user_id, role_id)    -- accepted team
threads / messages                            -- DMs + team chat
tasks(pitch_id, assignee_id, title, done)
```

## Build Phases

1. **Foundation** — Enable Lovable Cloud, design system, auth (email + Google), profile setup, protected routes.
2. **Social layer** — Feed, posts, likes, comments, follows, DMs.
3. **Pitch layer** — Create/browse/filter pitches, roles, applications flow.
4. **Team layer** — Accepted-members workspace, tasks, team chat.
5. **AI layer** — Pitch polisher, role suggester, embedding-based match score, moderation.
6. **Polish & SEO** — Public pitch pages with OG tags, sitemap, landing page, security scan pass.

## Technical Details

- File-based routes under `src/routes/` (public: `/`, `/explore`, `/pitch/$id`, `/u/$username`; gated under `_authenticated/`: `/feed`, `/pitches/new`, `/messages`, `/dashboard`).
- Server functions (`createServerFn`) for all mutations; `requireSupabaseAuth` middleware on user-scoped ones.
- Public read-only pitch pages use a publishable-key server client + narrow anon SELECT policies (so pitches are shareable/indexable).
- AI calls run server-side only (never expose keys) through Lovable AI Gateway with `google/gemini-2.5-flash` as default (free) and embeddings for match scoring.
- Realtime (feed updates, chat) via Supabase Realtime channels.

## What I need from you before building

1. Confirm the stack above (TanStack Start + Lovable Cloud + Lovable AI) — or say if you prefer something else.
2. Pick a **name** (default: IdeaForge) and rough **visual style** (e.g. LinkedIn-clean / dark modern / bold startup).
3. Confirm MVP scope — should I include DMs + team workspace in v1, or ship pitches + applications first and add collaboration next?

Once you confirm, I'll start with Phase 1 (foundation + auth + profiles) and build outward.
