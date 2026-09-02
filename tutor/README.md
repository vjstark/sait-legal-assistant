# AI Law Study Tutor

A private study app for a small group of law classmates. The admin uploads
course material (textbook PDFs, slides, case briefs, past exams, lecture
recordings, notes, web pages); everyone studies from it through an AI tutor
with four modes — **Teach me** (Socratic), **Look it up** (cited Q&A),
**Quiz me** (graded, tracked per topic), and **Flashcards** — every answer
cited back to the source page, timestamp, or link.

Runs at **$0/month**: hosting, database, and search sit on free tiers, and AI
calls use each person's own keys (BYOK), stored only in their browser.

## One-time setup

1. **Supabase** — create a free project at supabase.com. In the SQL Editor,
   run each file in `supabase/migrations/` in order (0001 through 0005).
2. **Environment** — copy the project's URL and keys (Project Settings → API)
   into `.env.local` (see the existing file for the variable names). On
   Vercel, add the same variables in Project Settings → Environment Variables.
3. **Deploy** — push this folder to its own GitHub repo and import it into
   Vercel (free Hobby plan). Set `NEXT_PUBLIC_SITE_URL` to the deployed URL,
   and add it to Supabase → Authentication → URL Configuration (Site URL +
   Redirect URLs, with `/auth/callback`).
4. **Make yourself admin** — sign in once via the login page (magic link),
   then in the Supabase SQL Editor run:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

   Every later member joins through **Invite classmates** in the app, which
   sets their role automatically.
5. **Keep-alive** — free Supabase projects pause after ~7 idle days. In the
   GitHub repo: Settings → Secrets → Actions, add `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY`; the workflow in
   `.github/workflows/supabase-keepalive.yml` then pings it twice a week.

## API keys (every user, in Settings → API keys)

| Key | Used for | Cost | Required? |
|---|---|---|---|
| Anthropic (console.anthropic.com) | All four study modes | Pay-per-use on your own account | Yes |
| Google Gemini (aistudio.google.com) | All four study modes | Free tier, no card required | Yes (if selected) |
| Voyage AI (voyageai.com) | Search/embeddings (`voyage-law-2`) | Free 200M-token grant | **Optional** — admin-funded fallback |
| Groq (console.groq.com) | Admin only: lecture transcription | Free | Only for audio uploads |

**Voyage is optional.** If a student doesn't add their own key, the app automatically uses an admin-funded server key for embeddings. Students who want control over their own usage (or are outside the admin's scope) can still add their own key.

Keys live in your browser's localStorage only — never in the database, never
in server logs.

## Roles

Every member is an **admin**, a **contributor**, or a **student**, set via
their invite. Admins manage courses and invites, and their uploads are
usable immediately. Contributors can upload material too, but each upload
sits in a per-course review queue until an admin approves it — nothing a
contributor adds is visible to students, or processable into study material,
until that happens. Students just study from whatever's approved.

## Day-to-day

- **Admin**: create a course → open it → Upload material → pick a category →
  Process (needs your Voyage key; audio also needs Groq). Audio files are
  transcribed then deleted; upload recordings in ~20-minute segments to stay
  under Groq's 25MB cap. Watch free-tier headroom under **Usage**.
- **Students**: open a course → Study → pick a mode. Quiz scores and flashcard
  ratings build a per-topic strengths/weaknesses profile (see **Progress**)
  that steers future Teach-me/Quiz-me sessions toward weak spots.

## Improving the tutor

The four mode personalities are plain text in `lib/ai/prompts.ts` — edit and
push, Vercel redeploys. The 👍/👎 on each reply lands in `message_feedback`
so you can see which mode's prompt needs work.

## Local development

```bash
npm install
npm run dev
```
