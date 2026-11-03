const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Use placeholders only to prevent module-load crashes when Vercel env vars
// are missing. API routes should check envReady before making database calls.
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
let validSupabaseUrl = false;
try {
  const parsed = new URL(supabaseUrl);
  validSupabaseUrl = parsed.protocol === 'https:' && Boolean(parsed.hostname);
} catch (_) {}
const envReady = validSupabaseUrl && serviceRoleKey.length > 20;
const sb = createClient(
  supabaseUrl || 'https://missing-env.supabase.co',
  serviceRoleKey || 'missing-service-role-key',
  { auth: { persistSession: false } }
);
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Player auth: Bearer token issued at registration; only its hash is stored.
async function auth(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (t.length < 20) return null;
  const { data } = await sb.from('players').select('*').eq('token_hash', hash(t)).maybeSingle();
  return data || null;
}

async function snapshot(p) {
  const [s, r] = await Promise.all([
    sb.from('stamps').select('booth_id,unlocked_at').eq('player_id', p.id),
    sb.from('rewards').select('status,finished_at,redeemed_at,stamp_count,completed_at').eq('player_id', p.id).maybeSingle(),
  ]);
  const stamps = {};
  (s.data || []).forEach((x) => (stamps[x.booth_id] = x.unlocked_at));
  return { id: p.id, name: p.full_name, school: p.school, grade: p.grade, stamps, reward: r.data || null };
}

const log = (player_id, action, details) => sb.from('activity_logs').insert({ player_id, action, details });

function adminOk(req) {
  const k = String(req.headers['x-admin-key'] || '');
  const a = process.env.ADMIN_KEY || '';
  return a.length >= 8 && k.length === a.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(a));
}

module.exports = { sb, hash, auth, snapshot, log, adminOk, envReady, supabaseUrl, serviceRoleKey };