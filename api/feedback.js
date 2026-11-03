const { sb, auth, snapshot, log } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const p = await auth(req);
  if (!p) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้เล่น' });

  const { data: rw } = await sb.from('rewards').select('status,completed_at').eq('player_id', p.id).maybeSingle();
  if (!rw || rw.status !== 'REDEEMED') return res.status(403).json({ error: 'ต้องรับไอติมก่อนจึงจะส่งความคิดเห็นได้' });
  if (rw.completed_at) return res.status(200).json({ player: await snapshot(p) });

  const b = req.body || {};
  const rating = parseInt(b.rating, 10);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'กรุณาให้คะแนน 1-5 ดาว' });
  const comment = String(b.comment || '').trim().slice(0, 500);

  const { error } = await sb.from('feedback').insert({ player_id: p.id, rating, comment });
  if (error && error.code !== '23505') return res.status(500).json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' });
  await sb.from('rewards').update({ completed_at: new Date().toISOString() }).eq('player_id', p.id).is('completed_at', null);
  await log(p.id, 'feedback_submitted', { rating });
  res.status(200).json({ player: await snapshot(p) });
};
