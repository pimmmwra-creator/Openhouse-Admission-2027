const { sb, auth, log } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const p = await auth(req);
  if (!p) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้เล่น' });

  const { booth_id, code } = req.body || {};
  const { data: b } = await sb.from('booths').select('id,secret_code,is_active').eq('id', String(booth_id)).maybeSingle();
  if (!b || !b.is_active) return res.status(404).json({ error: 'ไม่พบฐานกิจกรรม' });

  const { data: rw } = await sb.from('rewards').select('id').eq('player_id', p.id).maybeSingle();
  if (rw) return res.status(403).json({ error: 'คุณเสร็จสิ้นกิจกรรมแล้ว ไม่สามารถปลดล็อกเพิ่มได้' });

  // Rate limit: 5 wrong codes per minute per player
  const since = new Date(Date.now() - 60000).toISOString();
  const { count } = await sb.from('activity_logs').select('id', { count: 'exact', head: true })
    .eq('player_id', p.id).eq('action', 'invalid_code').gte('created_at', since);
  if ((count || 0) >= 5) return res.status(429).json({ error: 'กรอกผิดหลายครั้ง กรุณารอ 1 นาทีแล้วลองใหม่' });

  if (String(code || '').trim().toUpperCase() !== b.secret_code.toUpperCase()) {
    await log(p.id, 'invalid_code', { booth: b.id });
    return res.status(400).json({ error: 'รหัสไม่ถูกต้อง กรุณาตรวจสอบกับพี่สตาฟอีกครั้ง' });
  }

  // UNIQUE (player_id, booth_id) makes duplicate unlocks impossible
  const { data, error } = await sb.from('stamps').insert({ player_id: p.id, booth_id: b.id }).select('unlocked_at').single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'คุณได้รับแสตมป์บูธนี้แล้ว' });
    return res.status(500).json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' });
  }
  await log(p.id, 'stamp_unlocked', { booth: b.id });
  res.status(200).json({ unlocked_at: data.unlocked_at });
};
