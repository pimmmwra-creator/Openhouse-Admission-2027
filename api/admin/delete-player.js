const { sb, adminOk } = require('../../lib/db');

// PDPA: delete one player's data on request (cascades to stamps, rewards, feedback)
module.exports = async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = String((req.body || {}).player_id || '');
  const { error } = await sb.from('players').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'ลบไม่สำเร็จ' });
  await sb.from('activity_logs').delete().eq('player_id', id);
  await sb.from('activity_logs').insert({ action: 'player_data_deleted', details: {} });
  res.status(200).json({ ok: true });
};
