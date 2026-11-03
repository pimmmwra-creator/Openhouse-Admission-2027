const { sb, auth, snapshot, log, envReady } = require('../lib/db');

// Player confirms the reward themselves (also heals older NOT_REDEEMED rows).
// One conditional UPDATE (status = 'NOT_REDEEMED') so double taps cannot redeem twice.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!envReady) return res.status(503).json({ error: 'ระบบยังไม่พร้อมใช้งานในขณะนี้ กรุณาแจ้งทีมงานเพื่อตรวจสอบ' });
  const p = await auth(req);
  if (!p) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้เล่น' });

  const { data, error } = await sb.from('rewards')
    .update({ status: 'REDEEMED', redeemed_at: new Date().toISOString(), redeemed_by: 'self' })
    .eq('player_id', p.id).eq('status', 'NOT_REDEEMED').select();
  if (error) return res.status(500).json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' });

  if (data && data.length) {
    await log(p.id, 'reward_redeemed', { by: 'self' });
  } else {
    const { data: rw } = await sb.from('rewards').select('status').eq('player_id', p.id).maybeSingle();
    if (!rw) return res.status(403).json({ error: 'ยังไม่พบสิทธิ์รับรางวัล กรุณากดเสร็จสิ้นกิจกรรมก่อน' });
  }
  res.status(200).json({ player: await snapshot(p) });
};