const crypto = require('crypto');
const { sb, hash, snapshot, log, envReady } = require('../lib/db');

const CONSENT_VERSION = '2026-11-v1'; // bump when the privacy notice text changes

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Give a clear response instead of an opaque Vercel 500 if env vars are missing.
  if (!envReady) {
    console.error('REGISTER CONFIG ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
    return res.status(500).json({
      error: 'ระบบยังไม่ได้ตั้งค่า Supabase บน Vercel กรุณาตรวจสอบ SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน Project Settings > Environment Variables แล้ว Deploy ใหม่'
    });
  }

  try {
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

    if (error) {
      console.error('REGISTER SUPABASE ERROR:', {
        code: error.code, message: error.message, details: error.details, hint: error.hint
      });
      return res.status(500).json({
        error: 'บันทึกข้อมูลลง Supabase ไม่สำเร็จ กรุณาตรวจสอบว่ารันไฟล์ supabase/schema.sql แล้ว และตั้งค่า Service Role Key ถูกต้อง',
        code: error.code || 'SUPABASE_ERROR'
      });
    }

    const logResult = await log(data.id, 'player_registered', { consent: CONSENT_VERSION });
    if (logResult.error) {
      console.error('REGISTER LOG WARNING:', logResult.error.message);
    }

    return res.status(200).json({ token, player: await snapshot(data) });
  } catch (err) {
    console.error('REGISTER UNEXPECTED ERROR:', err);
    return res.status(500).json({
      error: 'เซิร์ฟเวอร์เกิดข้อผิดพลาดระหว่างลงทะเบียน กรุณาตรวจสอบ Vercel Functions Logs',
      code: 'REGISTER_UNEXPECTED_ERROR'
    });
  }
};
