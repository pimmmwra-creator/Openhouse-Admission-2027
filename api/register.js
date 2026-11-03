const crypto = require('crypto');
const {
  sb,
  hash,
  snapshot,
  log,
  envReady
} = require('../lib/db');

const CONSENT_VERSION = '2026-11-v1'; // bump when the privacy notice text changes

function errorInfo(error) {
  const cause = error && error.cause;
  return {
    name: error && error.name || 'Error',
    code: error && error.code || '',
    message: error && error.message || String(error),
    causeCode: cause && (cause.code || cause.errno) || '',
    causeMessage: cause && cause.message || '',
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!envReady) {
  console.error('REGISTER CONFIG ERROR', {
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });

  return res.status(500).json({
    error: 'Supabase configuration is incomplete'
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
        full_name: name,
        school,
        grade,
        token_hash: hash(token),
        consent_status: true,
        consent_at: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
      })
      .select('id,full_name,school,grade')
      .single();

    if (error) {
      const info = errorInfo(error);
      console.error('REGISTER SUPABASE ERROR:', info);

      const fetchFailed = /fetch failed|network|timeout|ENOTFOUND|ECONN/i.test(
        `${info.message} ${info.causeCode} ${info.causeMessage}`
      );
      return res.status(fetchFailed ? 503 : 500).json({
        error: fetchFailed
          ? 'เซิร์ฟเวอร์เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาแจ้งผู้ดูแลระบบ'
          : 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Database',
        diagnostic: fetchFailed ? 'SUPABASE_NETWORK_ERROR' : 'SUPABASE_DATABASE_ERROR',
      });
    }

    // Registration is already committed. Activity logging is best-effort and
    // must not make the user retry and accidentally create a second account.
    try {
      const { error: logError } = await log(data.id, 'player_registered', { consent: CONSENT_VERSION });
      if (logError) console.error('REGISTER LOG WARNING:', errorInfo(logError));
    } catch (logError) {
      console.error('REGISTER LOG WARNING:', errorInfo(logError));
    }

    // Return the initial player state without issuing extra database requests.
    return res.status(200).json({
      token,
      player: {
        id: data.id,
        name: data.full_name,
        school: data.school,
        grade: data.grade,
        stamps: {},
        reward: null,
      },
    });
  } catch (error) {
    const info = errorInfo(error);
    console.error('REGISTER UNHANDLED ERROR:', info);
    return res.status(500).json({
      error: 'ระบบลงทะเบียนเกิดข้อผิดพลาด กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
      diagnostic: 'REGISTER_UNHANDLED_ERROR',
    });
  }
};
