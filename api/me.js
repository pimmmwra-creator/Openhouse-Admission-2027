const { auth, snapshot } = require('../lib/db');

module.exports = async (req, res) => {
  const p = await auth(req);
  if (!p) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้เล่น' });
  res.status(200).json({ player: await snapshot(p) });
};
