const { sb, auth, snapshot, log } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const p = await auth(req);
  if (!p) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้เล่น' });

  const { count } = await sb.from('stamps').select('id', { count: 'exact', head: true }).eq('player_id', p.id);
  // UNIQUE (player_id): second finish fails with 23505 -> we just return the existing reward
  const { error } = await sb.from('rewards').insert({ player_id: p.id, stamp_count: count || 0 });
  if (error && error.code !== '23505') return res.status(500).json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' });
  if (!error) await log(p.id, 'event_finished', { stamps: count || 0 });
  res.status(200).json({ player: await snapshot(p) });
};
