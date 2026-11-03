# Open House Digital Stamp Rally

Frontend (static, `public/`) + serverless API (`api/`, Vercel) + Supabase PostgreSQL.

```
public/index.html     participant app (register once -> booths -> finish -> reward)
public/admin.html     organizer dashboard (not linked anywhere; protected by ADMIN_KEY)
api/register.js       POST  create player, returns a private token
api/me.js             GET   player + stamps + reward (always fresh from DB)
api/unlock.js         POST  check secret code server-side, write stamp, rate limit
api/finish.js         POST  finish event once, creates the reward record
api/admin/players.js  GET   stats, players, logs
api/admin/redeem.js   POST  confirm ice cream (atomic, only once)
lib/db.js             Supabase client + helpers
supabase/schema.sql   tables, constraints, RLS, seed booths
```

## Security model
- Secret codes live only in the `booths` table; the browser never receives them.
- RLS is enabled on every table with no policies, so the public anon key cannot read or write anything. Only the API uses the service role key (env var, server-side).
- One stamp per booth (`UNIQUE(player_id, booth_id)`), one reward per player (`UNIQUE(player_id)`).
- Redeem is one conditional UPDATE (`status = 'NOT_REDEEMED'`), so concurrent confirms cannot both succeed.
- Wrong code rate limit: 5 per minute per player.
- Players are identified by a random token stored in the browser (only its hash is in the DB). Clearing browser data or using another browser creates a new player.

## Setup
1. **Supabase**: create a project, open SQL Editor, run `supabase/schema.sql`. Change the secret codes in the `insert into booths` block first (or edit the `booths` table later).
2. Copy `.env.example` to `.env` for local use and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API) and a long random `ADMIN_KEY`.
3. **GitHub**
   ```bash
   git init && git add . && git commit -m "Open House stamp rally"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/open-house-stamp-rally.git
   git push -u origin main
   ```
4. **Vercel**: Add New > Project > import the repo (Framework Preset: Other). Add the three environment variables, then Deploy.
5. Turn the Vercel URL into a QR code and print it. Organizers open `/admin.html` and enter `ADMIN_KEY`.

## Local development
```bash
npm i -g vercel && npm install && vercel dev
```

## PDPA / privacy
- Registration requires a ticked consent checkbox. The API rejects registration without `consent: true`, and stores `consent_status`, `consent_at` (timestamp) and `consent_version` (bump `CONSENT_VERSION` in `api/register.js` when the notice text changes). The database enforces it with a CHECK constraint.
- Access: players only ever receive their own data (token-authenticated). All tables have RLS with no public policies. Organizers see data only through `/admin.html` with `ADMIN_KEY`; keep that key to the few people who need it.
- Logs contain no names or free text.
- Retention: the notice promises deletion within 90 days after the event. After the event, export the CSV from `/admin.html` for aggregate analysis if needed (strip names/schools), then run in the Supabase SQL Editor: `select purge_personal_data(90);` (deletes players, stamps, rewards, feedback and logs older than 90 days). Schedule it with pg_cron if you want it automatic.
- Deletion on request: the "ลบข้อมูล" button in `/admin.html` removes one player and their related data.
- Review the notice text with your university's data protection contact before launch. Participants under 20 may need parental/guardian consent under PDPA depending on the case.
"# Openhouse-Admission-2027" 
