const crypto = require('crypto');
const { sb, hash, snapshot, log } = require('../lib/db');

const CONSENT_VERSION = '2026-11-v1'; // bump when the privacy notice text changes

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  if (b.consent !== true)
    return res.status(400).json({ error: 'กรุณากดยอมรับการเก็บข้อมูลส่วนบุคคลก่อนลงทะเบียน' });
  const clean = (v, n) => String(v || '').trim().slice(0, n);
  const name = clean(b.name, 100), school = clean(b.school, 100), grade = clean(b.grade, 20);
  if (name.length < 2 || school.length < 2 || !grade)
    return res.status(400).json({ error: 'กรอกชื่อ โรงเรียน และชั้นให้ครบ' });

  const token = crypto.randomBytes(32).toString('hex');
  const { data, error } = await sb
    .from('players')
    .insert({
      full_name: name, school, grade, token_hash: hash(token),
      consent_status: true, consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  await log(data.id, 'player_registered', { consent: CONSENT_VERSION }); // no personal data in logs
  res.status(200).json({ token, player: await snapshot(data) });
};
