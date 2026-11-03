
const { sb, envReady } = require('../lib/db');

module.exports = async (req, res) => {
  if (!envReady) {
    return res.status(500).json({
      ok: false,
      stage: 'configuration',
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  }

  try {
    const { error } = await sb
      .from('players')
      .select('id')
      .limit(1);

    if (error) {
      console.error('HEALTH SUPABASE ERROR:', error.message);

      return res.status(500).json({
        ok: false,
        stage: 'database',
        message: error.message
      });
    }

    return res.status(200).json({
      ok: true,
      stage: 'connected',
      message: 'Supabase connected'
    });

  } catch (error) {
    console.error('HEALTH NETWORK ERROR:', error.message);

    return res.status(500).json({
      ok: false,
      stage: 'network',
      message: error.message
    });
  }
};
