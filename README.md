# YOUNG BOYZ Distribution V5

## What's new
- **Submit a release** auto-saves everything (fields, cover, audio, tracks) to the artist's account as a draft. Log out and come back: it's all still there (also reachable via *Continue →* in the dashboard).
- Release day: **Release today** or **Choose a date**, plus a time picker. **Saturday & Sunday are holidays** and can't be selected.
- Artist profiles: **Spotify and Apple Music only**. "Existing profile" reveals a link field; "We don't have a profile" creates a request for the team.
- **Add track** opens a full track editor (audio upload, title, version, featured, explicit, language, ISRC, lyrics, any number of credits). Add as many tracks as you need.
- **Admin panel**: shows the artist name/email on every release & request, details of each track, **download buttons for the cover and each audio file**, "Copy all details", status control, and **Create artist login** (generates email + password to hand to the artist, plus *Reset password*).
- Admins get an **Admin view / Artist view** switch; non-admins can't open `/admin` (and RLS blocks the data anyway).

## Setup (once)
1. Supabase > SQL Editor: run `supabase/schema-v2.sql`, `schema-v3.sql`, then **`schema-v4.sql`**.
2. Make yourself admin: `update public.profiles set role='admin' where email='YOUR_EMAIL';`
3. Deploy the edge function (needs the Supabase CLI):
   `supabase functions deploy create-artist`
   (it uses the project's built-in `SUPABASE_SERVICE_ROLE_KEY`; never put that key in the Next.js app).
4. Supabase > Authentication > Providers/Settings: **turn OFF "Allow new users to sign up"** so only accounts you create can log in.
5. Storage limits: Supabase's free plan caps uploads at **50 MB per file**. WAV masters are often larger — raise it under Storage > Settings (Pro plan) or ask artists for MP3/FLAC.
6. Copy `.env.local.example` to `.env.local`, fill your publishable key, `npm install`, `npm run dev`.
