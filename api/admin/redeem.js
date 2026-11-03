const { sb, adminOk, log } = require('../../lib/db');

module.exports = async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = String((req.body || {}).player_id || '');
  // Single conditional UPDATE = atomic: if two staff click at once, only one row matches.
  const { data } = await sb.from('rewards')
    .update({ status: 'REDEEMED', redeemed_at: new Date().toISOString(), redeemed_by: 'staff' })
    .eq('player_id', id).eq('status', 'NOT_REDEEMED').select();
  if (!data || !data.length) {
    await log(id, 'failed_redemption', {});
    return res.status(409).json({ error: 'ผู้เล่นรายนี้รับไอติมไปแล้ว หรือยังไม่ได้กดเสร็จสิ้นกิจกรรม' });
  }
  await log(id, 'reward_redeemed', { by: 'staff' });
  res.status(200).json({ ok: true });
};
