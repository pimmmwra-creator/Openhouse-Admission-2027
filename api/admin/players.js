const { sb, adminOk } = require('../../lib/db');

module.exports = async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const [p, s, r, l, f] = await Promise.all([
    sb.from('players').select('id,full_name,school,grade,created_at,consent_status,consent_at').order('created_at', { ascending: false }),
    sb.from('stamps').select('player_id,booth_id'),
    sb.from('rewards').select('player_id,status,stamp_count,finished_at,redeemed_at'),
    sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
    sb.from('feedback').select('rating,comment,created_at').order('created_at', { ascending: false }),
  ]);
  const st = {}; (s.data || []).forEach((x) => (st[x.player_id] = (st[x.player_id] || []).concat(x.booth_id)));
  const rw = {}; (r.data || []).forEach((x) => (rw[x.player_id] = x));
  const players = (p.data || []).map((x) => ({ ...x, stamps: st[x.id] || [], reward: rw[x.id] || null }));
  const rewards = r.data || [];
  res.status(200).json({
    stats: {
      players: players.length,
      stamps: (s.data || []).length,
      finished: rewards.length,
      redeemed: rewards.filter((x) => x.status === 'REDEEMED').length,
    },
    players,
    logs: l.data || [],
    feedback: f.data || [],
  });
};
